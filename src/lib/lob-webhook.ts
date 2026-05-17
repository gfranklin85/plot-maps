/**
 * Lob webhook helpers — pure functions, no I/O.
 *
 * The route handler at /api/lob/webhook imports these. Kept separate so
 * the security-sensitive bits (signature verification, replay window)
 * can be reasoned about and tested in isolation from the database side.
 */

import crypto from 'crypto';

// Replay-window: reject events whose timestamp is more than this far
// from "now". Lob's signature only proves authenticity at the time it
// was signed; without a timestamp check, a replayed valid signature
// could re-fire events forever. 5 minutes matches Stripe's default
// and is generous enough for legitimate Lob retries.
const SIGNATURE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export interface SignatureVerification {
  valid: boolean;
  reason: string | null;
}

/**
 * Verify Lob's webhook signature.
 *
 * Lob signs each delivery with HMAC-SHA256 over `{timestamp}.{rawBody}`
 * using the per-webhook signing secret. We use timingSafeEqual to defeat
 * timing-attack inference and enforce a replay window via the timestamp.
 *
 * Returns { valid: false, reason: ... } on any failure path. The reason
 * is for logging only and never echoed to the client (we always 200 to
 * Lob regardless to avoid signaling to attackers).
 */
export function verifyLobSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
): SignatureVerification {
  if (!secret) {
    return { valid: false, reason: 'LOB_WEBHOOK_SIGNING_SECRET not configured' };
  }
  if (!signatureHeader || !timestampHeader) {
    return { valid: false, reason: 'missing lob-signature or lob-signature-timestamp header' };
  }

  // Lob's timestamp is Unix milliseconds. Reject anything outside the window.
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: 'timestamp header is not a number' };
  }
  const drift = Math.abs(Date.now() - ts);
  if (drift > SIGNATURE_TIMESTAMP_TOLERANCE_MS) {
    return { valid: false, reason: `timestamp drift ${drift}ms exceeds tolerance` };
  }

  // Signed payload is "{timestamp}.{body}" per Lob's convention (same as Stripe).
  const signedPayload = `${timestampHeader}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(signatureHeader, 'hex');

  if (expectedBuf.length !== receivedBuf.length) {
    return { valid: false, reason: 'signature length mismatch' };
  }
  const match = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  return match ? { valid: true, reason: null } : { valid: false, reason: 'hmac mismatch' };
}

// ── Event payload extraction ─────────────────────────────────────────

export interface ExtractedResource {
  eventId: string | null;        // Lob's evt_* id
  eventType: string | null;      // "postcard.delivered"
  resourceId: string | null;     // "psc_..." from event.body.id
  resourceType: string | null;   // "postcard" | "letter" | "self_mailer" | ...
}

/**
 * Pull the bits we care about out of Lob's event payload.
 *
 * Lob's event shape (per their public OpenAPI):
 *   {
 *     id: "evt_...",
 *     event_type: { id: "postcard.delivered" },
 *     body: { id: "psc_...", object: "postcard", ... },
 *     date_created: "...",
 *     reference_id: "psc_..."
 *   }
 *
 * Tolerant of shape variation — returns nulls on anything missing rather
 * than throwing.
 */
export function extractResource(payload: unknown): ExtractedResource {
  if (!payload || typeof payload !== 'object') {
    return { eventId: null, eventType: null, resourceId: null, resourceType: null };
  }
  const p = payload as Record<string, unknown>;
  const eventId = typeof p.id === 'string' ? p.id : null;

  // event_type can come through as either a string or { id: string }.
  let eventType: string | null = null;
  if (typeof p.event_type === 'string') {
    eventType = p.event_type;
  } else if (p.event_type && typeof p.event_type === 'object') {
    const et = p.event_type as Record<string, unknown>;
    if (typeof et.id === 'string') eventType = et.id;
  }

  // Resource: prefer event.body, fall back to event.reference_id.
  let resourceId: string | null = null;
  let resourceType: string | null = null;
  if (p.body && typeof p.body === 'object') {
    const body = p.body as Record<string, unknown>;
    if (typeof body.id === 'string') resourceId = body.id;
    if (typeof body.object === 'string') resourceType = body.object;
  }
  if (!resourceId && typeof p.reference_id === 'string') {
    resourceId = p.reference_id;
  }

  return { eventId, eventType, resourceId, resourceType };
}

// ── Event → inquiry update mapping ──────────────────────────────────

export interface InquiryUpdate {
  /** New value for property_inquiries.mail_provider_status (always set). */
  mailProviderStatus: string;
  /** New value for property_inquiries.status (only set if not null). */
  status: 'sent' | 'delivered' | 'failed' | 'replied' | 'opted_out' | null;
  /** Whether to stamp delivered_at = now(). */
  setDeliveredAt: boolean;
}

/**
 * Map a Lob postcard event type to the patch we apply on the inquiry row.
 *
 * Postcard event types (per Lob docs):
 *   postcard.created                     — we usually receive this first
 *   postcard.rendered_pdf                — PDF rendered, queued for print
 *   postcard.in_transit                  — handed to USPS
 *   postcard.in_local_area               — near recipient's facility
 *   postcard.processed_for_delivery      — out for delivery
 *   postcard.re-routed                   — USPS forwarded (NCOA, etc.)
 *   postcard.returned_to_sender          — undeliverable
 *   postcard.delivered                   — final positive outcome
 *   postcard.failed                      — production failed at Lob
 *   postcard.deleted                     — canceled
 *
 * Unknown / new event types are mapped to a status-only update so we
 * still record the latest provider status without false claims about
 * top-level inquiry status.
 */
export function mapLobEventToInquiryUpdate(eventType: string): InquiryUpdate {
  switch (eventType) {
    case 'postcard.delivered':
      return { mailProviderStatus: eventType, status: 'delivered', setDeliveredAt: true };
    case 'postcard.returned_to_sender':
    case 'postcard.failed':
      return { mailProviderStatus: eventType, status: 'failed', setDeliveredAt: false };
    case 'postcard.deleted':
      // Operator canceled within Lob — surface as failed so the UI doesn't
      // imply mail is in flight when it isn't.
      return { mailProviderStatus: eventType, status: 'failed', setDeliveredAt: false };
    case 'postcard.in_transit':
    case 'postcard.in_local_area':
    case 'postcard.processed_for_delivery':
    case 'postcard.re-routed':
    case 'postcard.rendered_pdf':
    case 'postcard.created':
      // Intermediate states — refresh provider status but don't change
      // top-level inquiry status (it's already 'sent').
      return { mailProviderStatus: eventType, status: null, setDeliveredAt: false };
    default:
      return { mailProviderStatus: eventType, status: null, setDeliveredAt: false };
  }
}
