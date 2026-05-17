/**
 * Lob webhook receiver — POST /api/lob/webhook
 *
 * Verifies HMAC signature, dedupes by Lob event id, records every event
 * (valid OR invalid signature) into the lob_webhook_events audit log,
 * and updates the corresponding property_inquiries row's status and
 * mail_provider_status.
 *
 * Configuration:
 *   - Add LOB_WEBHOOK_SIGNING_SECRET to .env.local (from Lob dashboard).
 *   - Configure the webhook URL in Lob dashboard:
 *       https://<your domain>/api/lob/webhook
 *
 * Design choices:
 *
 *   1) ALWAYS respond 200. Non-2xx makes Lob retry indefinitely; a buggy
 *      handler would denial-of-service us with our own retry storm. We
 *      log failures verbatim so an operator can replay them later.
 *
 *   2) NEVER throw before recording. Even invalid-signature events get
 *      inserted (with signature_valid=false) so spoofing attempts and
 *      misconfigured secrets show up in the audit log.
 *
 *   3) Idempotent. lob_webhook_events.lob_event_id is UNIQUE — re-deliveries
 *      from Lob's retry path become no-ops at insert time.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  verifyLobSignature,
  mapLobEventToInquiryUpdate,
  extractResource,
} from '@/lib/lob-webhook';

// crypto.timingSafeEqual is Node-only — the Edge runtime would crash.
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Read the raw body BEFORE parsing — HMAC verification needs the exact bytes.
  const rawBody = await request.text();
  const sigHeader = request.headers.get('lob-signature');
  const tsHeader = request.headers.get('lob-signature-timestamp');
  const secret = process.env.LOB_WEBHOOK_SIGNING_SECRET || '';

  const verification = verifyLobSignature(rawBody, sigHeader, tsHeader, secret);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Unparseable JSON — record what we can and 200. Lob retrying doesn't help.
    await recordEvent({
      lobEventId: `unparseable-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      eventType: 'unknown.unparseable_payload',
      resourceId: null,
      resourceType: null,
      inquiryId: null,
      payload: { raw_body_preview: rawBody.slice(0, 500) },
      signatureValid: verification.valid,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { eventId, eventType, resourceId, resourceType } = extractResource(payload);

  // Look up the matching inquiry (if any) so the audit row is linked.
  let inquiryId: string | null = null;
  if (resourceId) {
    const { data } = await supabaseAdmin
      .from('property_inquiries')
      .select('id')
      .eq('mail_provider_id', resourceId)
      .maybeSingle();
    inquiryId = data?.id ?? null;
  }

  // Always record — even if signature failed. This is forensic data.
  const recordResult = await recordEvent({
    lobEventId: eventId || `no-event-id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    eventType: eventType || 'unknown',
    resourceId,
    resourceType,
    inquiryId,
    payload,
    signatureValid: verification.valid,
  });

  if (!verification.valid) {
    console.warn('[lob-webhook] signature verification failed:', verification.reason);
    // Still 200 — don't tell attackers what we know about their probe.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Duplicate delivery (same lob_event_id as one we've already processed).
  // Skip the status update to keep the operation idempotent.
  if (recordResult.alreadyRecorded) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  // Apply the status update for postcard events we recognize.
  if (resourceType === 'postcard' && eventType && inquiryId) {
    const update = mapLobEventToInquiryUpdate(eventType);
    const patch: Record<string, unknown> = {
      mail_provider_status: update.mailProviderStatus,
    };
    if (update.status !== null) patch.status = update.status;
    if (update.setDeliveredAt) patch.delivered_at = new Date().toISOString();

    const { error: updErr } = await supabaseAdmin
      .from('property_inquiries')
      .update(patch)
      .eq('id', inquiryId);

    if (updErr) {
      console.error('[lob-webhook] failed to update inquiry', inquiryId, updErr);
      // Already recorded in audit log; do not retry-via-non-200.
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

interface RecordEventArgs {
  lobEventId: string;
  eventType: string;
  resourceId: string | null;
  resourceType: string | null;
  inquiryId: string | null;
  payload: unknown;
  signatureValid: boolean;
}

interface RecordEventResult {
  alreadyRecorded: boolean;
}

async function recordEvent(args: RecordEventArgs): Promise<RecordEventResult> {
  const { error } = await supabaseAdmin.from('lob_webhook_events').insert({
    lob_event_id: args.lobEventId,
    event_type: args.eventType,
    resource_id: args.resourceId,
    resource_type: args.resourceType,
    inquiry_id: args.inquiryId,
    payload: args.payload,
    signature_valid: args.signatureValid,
  });

  if (error) {
    // 23505 = unique_violation on lob_event_id → idempotent re-delivery.
    if ((error as { code?: string }).code === '23505') {
      return { alreadyRecorded: true };
    }
    console.error('[lob-webhook] failed to insert audit row', error);
  }
  return { alreadyRecorded: false };
}
