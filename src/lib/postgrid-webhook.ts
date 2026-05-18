/**
 * PostGrid webhook helpers — pure functions, no I/O.
 *
 * The route handler at /api/postgrid/webhook imports these. Kept separate
 * so the security-sensitive bits (signature verification) can be reasoned
 * about and tested in isolation from the database side.
 *
 * Key differences from Lob's webhook model:
 *   - PostGrid fires a single ".updated" event type per resource type
 *     (postcard.updated, letter.updated, etc.) rather than dedicated
 *     per-state events. The lifecycle state lives in the payload's
 *     `status` and `imbStatus` fields.
 *   - PostGrid's status enum: ready | printing | processed_for_delivery | completed | cancelled
 *   - PostGrid's imbStatus enum: entered_mail_stream | out_for_delivery | returned_to_sender
 *   - We map these to our property_inquiries.status + mail_provider_status.
 */

import crypto from 'crypto';

// Replay-window: reject events whose timestamp is more than this far
// from "now". Defeats replay attacks where a captured valid signature
// is re-fired. PostGrid recommends checking, doesn't enforce a window
// themselves. 5 minutes matches Stripe / Lob convention.
const SIGNATURE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export interface SignatureVerification {
  valid: boolean;
  reason: string | null;
}

/**
 * Verify PostGrid's webhook signature.
 *
 * PostGrid (per their docs) signs each delivery with HMAC-SHA256 over
 * the raw request body using the per-webhook signing secret. The
 * signature arrives as a header (PostGrid uses `postgrid-signature`).
 *
 * Some PostGrid setups also include a timestamp header; if present we
 * enforce a replay window. If absent we accept the request based on
 * signature match alone (PostGrid doesn't universally send a timestamp
 * — JSON-format webhooks use signature-only, JWT-format webhooks embed
 * the timestamp in the JWT itself).
 *
 * Returns { valid: false, reason: ... } on any failure path. The reason
 * is for logging only; we always return 200 to PostGrid regardless to
 * avoid signaling to potential attackers what we know.
 */
export function verifyPostGridSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
): SignatureVerification {
  if (!secret) {
    return { valid: false, reason: 'POSTGRID_WEBHOOK_SIGNING_SECRET not configured' };
  }
  if (!signatureHeader) {
    return { valid: false, reason: 'missing postgrid-signature header' };
  }

  // Optional timestamp check — only enforced if PostGrid sent one.
  if (timestampHeader) {
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts)) {
      return { valid: false, reason: 'timestamp header is not a number' };
    }
    const drift = Math.abs(Date.now() - ts);
    if (drift > SIGNATURE_TIMESTAMP_TOLERANCE_MS) {
      return { valid: false, reason: `timestamp drift ${drift}ms exceeds tolerance` };
    }
  }

  // Compute expected HMAC-SHA256 over raw body. Allow either hex or
  // base64-encoded signatures (PostGrid's format varies; check both
  // to be tolerant — we use timingSafeEqual for whichever matches).
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedB64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');

  // Try hex first
  if (signatureHeader.length === expectedHex.length) {
    try {
      const e = Buffer.from(expectedHex, 'hex');
      const r = Buffer.from(signatureHeader, 'hex');
      if (e.length === r.length && crypto.timingSafeEqual(e, r)) {
        return { valid: true, reason: null };
      }
    } catch {
      // fall through to base64 attempt
    }
  }

  // Try base64
  if (signatureHeader.length === expectedB64.length) {
    try {
      const e = Buffer.from(expectedB64, 'base64');
      const r = Buffer.from(signatureHeader, 'base64');
      if (e.length === r.length && crypto.timingSafeEqual(e, r)) {
        return { valid: true, reason: null };
      }
    } catch {
      // signature format unrecognized
    }
  }

  return { valid: false, reason: 'hmac mismatch (tried hex + base64)' };
}

// ── Event payload extraction ─────────────────────────────────────────

export interface ExtractedResource {
  eventId: string | null;       // PostGrid's evt_* id
  eventType: string | null;     // "postcard.updated"
  resourceId: string | null;    // "postcard_..." from data.id
  resourceType: string | null;  // "postcard" | "letter" | "cheque" | ...
  resourceStatus: string | null;    // ready | printing | processed_for_delivery | completed | cancelled
  resourceImbStatus: string | null; // entered_mail_stream | out_for_delivery | returned_to_sender (US only)
}

/**
 * Pull the bits we care about out of PostGrid's event payload.
 *
 * PostGrid's event shape (per their public docs):
 *   {
 *     id: "evt_...",
 *     type: "postcard.updated",  // or "postcard.created", etc.
 *     data: {
 *       id: "postcard_...",
 *       object: "postcard",
 *       status: "ready" | "printing" | "processed_for_delivery" | "completed" | "cancelled",
 *       imbStatus: "entered_mail_stream" | "out_for_delivery" | "returned_to_sender",
 *       ...
 *     },
 *     createdAt: "...",
 *   }
 *
 * Tolerant of shape variation — returns nulls on anything missing rather
 * than throwing.
 */
export function extractResource(payload: unknown): ExtractedResource {
  if (!payload || typeof payload !== 'object') {
    return {
      eventId: null,
      eventType: null,
      resourceId: null,
      resourceType: null,
      resourceStatus: null,
      resourceImbStatus: null,
    };
  }
  const p = payload as Record<string, unknown>;
  const eventId = typeof p.id === 'string' ? p.id : null;
  const eventType = typeof p.type === 'string' ? p.type : null;

  let resourceId: string | null = null;
  let resourceType: string | null = null;
  let resourceStatus: string | null = null;
  let resourceImbStatus: string | null = null;

  if (p.data && typeof p.data === 'object') {
    const d = p.data as Record<string, unknown>;
    if (typeof d.id === 'string') resourceId = d.id;
    if (typeof d.object === 'string') resourceType = d.object;
    if (typeof d.status === 'string') resourceStatus = d.status;
    if (typeof d.imbStatus === 'string') resourceImbStatus = d.imbStatus;
  }

  return { eventId, eventType, resourceId, resourceType, resourceStatus, resourceImbStatus };
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
 * Map a PostGrid postcard event to the patch we apply on the inquiry row.
 *
 * PostGrid's lifecycle (status field):
 *   ready                    → just created, before printing
 *   printing                 → handed to printer
 *   processed_for_delivery   → handed to postal service
 *   completed                → believed delivered (approximation)
 *   cancelled                → never sent
 *
 * PostGrid's IMB lifecycle (imbStatus field, US live orders only):
 *   entered_mail_stream      → scanned at USPS facility
 *   out_for_delivery         → final USPS facility, will deliver today/tomorrow
 *   returned_to_sender       → undeliverable
 *
 * We blend both into a single mailProviderStatus string for clarity in
 * the audit log and the inbox UI. The top-level inquiry.status only
 * flips on terminal outcomes (delivered, returned, cancelled).
 */
export function mapPostGridEventToInquiryUpdate(
  resourceStatus: string | null,
  imbStatus: string | null,
): InquiryUpdate {
  // imbStatus takes precedence when present — it represents real-world
  // USPS scans which are more meaningful than PostGrid's internal status.
  if (imbStatus === 'returned_to_sender') {
    return { mailProviderStatus: 'imb.returned_to_sender', status: 'failed', setDeliveredAt: false };
  }
  if (imbStatus === 'out_for_delivery') {
    return { mailProviderStatus: 'imb.out_for_delivery', status: null, setDeliveredAt: false };
  }
  if (imbStatus === 'entered_mail_stream') {
    return { mailProviderStatus: 'imb.entered_mail_stream', status: null, setDeliveredAt: false };
  }

  // Otherwise fall back to PostGrid's lifecycle status.
  switch (resourceStatus) {
    case 'completed':
      return { mailProviderStatus: 'completed', status: 'delivered', setDeliveredAt: true };
    case 'cancelled':
      return { mailProviderStatus: 'cancelled', status: 'failed', setDeliveredAt: false };
    case 'processed_for_delivery':
    case 'printing':
    case 'ready':
      // Intermediate states — refresh provider status but don't change
      // top-level inquiry status (it's already 'sent').
      return { mailProviderStatus: resourceStatus, status: null, setDeliveredAt: false };
    default:
      // Unknown / future status values — record verbatim, top-level untouched.
      return {
        mailProviderStatus: resourceStatus || 'unknown',
        status: null,
        setDeliveredAt: false,
      };
  }
}
