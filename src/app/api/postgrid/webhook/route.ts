/**
 * PostGrid webhook receiver — POST /api/postgrid/webhook
 *
 * Verifies HMAC signature, dedupes by PostGrid event id, records every
 * event (valid OR invalid signature) into the lob_webhook_events audit
 * log (table is provider-agnostic; rename pending in a follow-up
 * migration), and updates the corresponding property_inquiries row's
 * status and mail_provider_status.
 *
 * Configuration:
 *   - Add POSTGRID_WEBHOOK_SIGNING_SECRET to .env.local (from PostGrid
 *     dashboard when you create the webhook)
 *   - Configure the webhook URL in PostGrid dashboard:
 *       https://<your domain>/api/postgrid/webhook
 *   - Set Payload Format = JSON in the PostGrid create-webhook UI
 *     (we don't support JWT format — would require different code)
 *
 * Same operational rules as the Lob handler had:
 *   1) ALWAYS respond 200. Non-2xx makes PostGrid retry indefinitely;
 *      a buggy handler would denial-of-service us with our own retry
 *      storm. We log failures so an operator can replay them later.
 *   2) NEVER throw before recording. Even invalid-signature events get
 *      inserted (signature_valid=false) so spoofing attempts and
 *      misconfigured secrets show up in the audit log.
 *   3) Idempotent. lob_event_id is UNIQUE — re-deliveries from PostGrid's
 *      retry path become no-ops at insert time.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import {
  verifyPostGridSignature,
  mapPostGridEventToInquiryUpdate,
  extractResource,
} from '@/lib/postgrid-webhook';

export const runtime = 'nodejs'; // crypto.timingSafeEqual is Node-only

export async function POST(request: Request) {
  // Read the raw body BEFORE parsing — HMAC verification needs the exact bytes.
  const rawBody = await request.text();
  const sigHeader = request.headers.get('postgrid-signature');
  const tsHeader = request.headers.get('postgrid-signature-timestamp');
  const secret = process.env.POSTGRID_WEBHOOK_SIGNING_SECRET || '';

  const verification = verifyPostGridSignature(rawBody, sigHeader, tsHeader, secret);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await recordEvent({
      eventId: `unparseable-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      eventType: 'unknown.unparseable_payload',
      resourceId: null,
      resourceType: null,
      inquiryId: null,
      payload: { raw_body_preview: rawBody.slice(0, 500) },
      signatureValid: verification.valid,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { eventId, eventType, resourceId, resourceType, resourceStatus, resourceImbStatus } =
    extractResource(payload);

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
    eventId: eventId || `no-event-id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    eventType: eventType || 'unknown',
    resourceId,
    resourceType,
    inquiryId,
    payload,
    signatureValid: verification.valid,
  });

  if (!verification.valid) {
    console.warn('[postgrid-webhook] signature verification failed:', verification.reason);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Duplicate delivery (same event id as one we've already processed).
  if (recordResult.alreadyRecorded) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  // Apply the status update for postcard events. PostGrid fires
  // postcard.created (initial) and postcard.updated (every status change).
  if (resourceType === 'postcard' && inquiryId) {
    const update = mapPostGridEventToInquiryUpdate(resourceStatus, resourceImbStatus);
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
      console.error('[postgrid-webhook] failed to update inquiry', inquiryId, updErr);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

interface RecordEventArgs {
  eventId: string;
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
  const { error } = await supabaseAdmin.from('mail_provider_webhook_events').insert({
    provider_event_id: args.eventId,
    event_type: args.eventType,
    resource_id: args.resourceId,
    resource_type: args.resourceType,
    inquiry_id: args.inquiryId,
    payload: args.payload,
    signature_valid: args.signatureValid,
  });

  if (error) {
    // 23505 = unique_violation on provider_event_id → idempotent re-delivery.
    if ((error as { code?: string }).code === '23505') {
      return { alreadyRecorded: true };
    }
    console.error('[postgrid-webhook] failed to insert audit row', error);
  }
  return { alreadyRecorded: false };
}
