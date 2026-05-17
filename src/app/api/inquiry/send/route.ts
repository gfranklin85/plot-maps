import { NextResponse } from 'next/server';
import twilio from 'twilio';
import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { silentLookup } from '@/lib/skiptrace-silent';
import { reverseGeocodeServer } from '@/lib/geocode-server';
import { logCost } from '@/lib/cost-tracker';
import { sendPostcard, lobEnvironment } from '@/lib/lob';

type Channel = 'text_invite' | 'direct_mail' | 'phone_call';
type Phase = 'primer' | 'fire';

// INVARIANT: the Plot system text invitation body MUST NOT include the
// owner's name, address-specific identity hints, or any other PII that
// the recipient could use to "guess the answer" to the self-score
// claim flow's name-match gate. Skip-trace data is imperfect — sometimes
// a wrong number receives this message — and the message must NOT hand a
// wrong-number recipient enough information to claim the property.
//
// Owner's name on the deed is the lock; we never include it in the message.
// Texts are also platform-templated only — Plot does not accept user-
// composed text bodies on this channel, ever. See the design doc.
// Body invariants (do not change with copy iteration):
//   - No owner name in the body. Hard rule from the verification design.
//   - Body must invite both bare-STOP and structured-STOP (NAME STOP)
//     responses. Otherwise we lose the data-quality signal from
//     wrong-number recipients.
//   - The pitch toward the link is participation-framed, not relief-framed.
//
// Wording is kept short to fit a single SMS segment. Refinement happens
// after implementation.
const TEXT_INVITE_BODY = (claimUrl: string) =>
  `Plot here. A buyer's interested in your property. Tap ${claimUrl} to set your status. STOP for messages off; NAME STOP if wrong person.`;

function newToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions';
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    leadId?: string;
    lat?: number;
    lng?: number;
    placeId?: string | null;
    channel: Channel;
    phase?: Phase;
  };
  const { channel, phase } = body;
  let { leadId } = body;

  if (!channel) {
    return NextResponse.json({ error: 'channel required' }, { status: 400 });
  }
  if (!leadId && (typeof body.lat !== 'number' || typeof body.lng !== 'number')) {
    return NextResponse.json({ error: 'leadId or lat/lng required' }, { status: 400 });
  }
  if (leadId && (typeof body.lat === 'number' || typeof body.lng === 'number')) {
    return NextResponse.json({ error: 'provide leadId OR lat/lng, not both' }, { status: 400 });
  }

  // RESERVED FOR FUTURE: no client path currently calls this with lat/lng.
  // Kept as the server-side foundation for the next click-to-grab feature.
  // The corresponding client-side open-grab UI was reverted; this branch
  // waits for the next attempt.
  //
  // Open-grab path: caller passed lat/lng instead of leadId. Resolve to
  // an existing Lead at that point (de-dupe by user + address), or auto-
  // create one. The placeId, if provided, is logged for analytics but
  // doesn't affect outreach — Plot's outreach target is always the deed
  // owner at the address, never the tenant business at the POI.
  if (!leadId) {
    const lat = body.lat as number;
    const lng = body.lng as number;
    const geocoded = await reverseGeocodeServer(lat, lng, user.id);
    if (!geocoded) {
      return NextResponse.json(
        { error: 'No address at this location', code: 'no_address' },
        { status: 422 },
      );
    }
    // De-dupe: if the same user already has a lead at this address, reuse it.
    const { data: existing } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('user_id', user.id)
      .eq('property_address', geocoded.formatted_address)
      .limit(1)
      .maybeSingle();
    if (existing) {
      leadId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('leads')
        .insert({
          user_id: user.id,
          name: geocoded.formatted_address,
          property_address: geocoded.formatted_address,
          city: geocoded.city,
          state: geocoded.state,
          zip: geocoded.zip,
          latitude: geocoded.lat,
          longitude: geocoded.lng,
          status: 'New',
          source: 'airplane_grab',
        })
        .select('id')
        .single();
      if (insertErr || !inserted) {
        console.error('Lead auto-create failed', insertErr);
        return NextResponse.json({ error: 'Failed to create Lead' }, { status: 500 });
      }
      leadId = inserted.id;
    }
  }

  // Load profile (edition + arming) and the property
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plot_edition, armed_channel, armed_mail_template_id, twilio_phone_number, full_name')
    .eq('id', user.id)
    .single();

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, user_id, property_address, city, state, zip, phone')
    .eq('id', leadId)
    .single();

  if (!lead) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

  const edition = (profile?.plot_edition as 'lite' | 'pro' | null) || 'lite';

  // Channel-specific routing
  if (channel === 'text_invite') {
    return handleTextInvite({ user, edition, lead });
  }
  if (channel === 'direct_mail') {
    return handleDirectMail({ user, edition, lead, profile });
  }
  if (channel === 'phone_call') {
    return handlePhoneCall({ user, edition, lead, phase: phase || 'primer' });
  }
  return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
}

// ── text_invite ──────────────────────────────────────────────────────────
async function handleTextInvite(args: {
  user: { id: string };
  edition: 'lite' | 'pro';
  lead: { id: string; property_address: string | null; city: string | null; state: string | null; zip: string | null };
}) {
  const { user, edition, lead } = args;

  // ── Channel-routing precondition ──────────────────────────────────
  // If this property's phone has already been declined, don't even try
  // to skip-trace + send. Save the user the cost and surface the right
  // alternative channel (mail) in the UI.
  const { data: leadFlags } = await supabaseAdmin
    .from('leads')
    .select('text_declined')
    .eq('id', lead.id)
    .single();
  if (leadFlags?.text_declined) {
    return NextResponse.json(
      {
        error: 'This property has declined text inquiries — try direct mail instead',
        code: 'text_declined',
      },
      { status: 403 },
    );
  }

  const address = lead.property_address || '';
  const city = lead.city || address.split(',')[1]?.trim() || '';
  const state = lead.state || '';

  // Silent lookup — never returns owner info to client
  const lookup = await silentLookup({
    userId: user.id,
    leadId: lead.id,
    address,
    city,
    state,
    zip: lead.zip || undefined,
  });

  if (!lookup.has_phone) {
    return NextResponse.json({ error: 'No phone available for owner' }, { status: 422 });
  }

  // Re-load the phone server-side (silentLookup just persisted it)
  const { data: leadAfter } = await supabaseAdmin
    .from('leads')
    .select('phone')
    .eq('id', lead.id)
    .single();
  const phone = leadAfter?.phone;
  if (!phone) {
    return NextResponse.json({ error: 'Phone unavailable' }, { status: 422 });
  }

  // (Per-property opt-out is enforced above via leads.text_declined.
  //  The deprecated owner_preferences.no_further_inquiries field is gone —
  //  Plot does not offer global opt-out as a concept; the inbox is async
  //  and intrusion is structurally absent.)

  // Create inquiry row first (need its id for the claim token)
  const { data: inquiry, error: inqErr } = await supabaseAdmin
    .from('property_inquiries')
    .insert({
      lead_id: lead.id,
      initiator_user_id: user.id,
      initiator_edition: edition,
      channel: 'text_invite',
      status: 'queued',
    })
    .select('id')
    .single();
  if (inqErr || !inquiry) {
    console.error('inquiry insert error', inqErr);
    return NextResponse.json({ error: 'Failed to record inquiry' }, { status: 500 });
  }

  // Mint a claim token
  const token = newToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(); // 30 days
  await supabaseAdmin.from('claim_tokens').insert({
    token,
    lead_id: lead.id,
    inquiry_id: inquiry.id,
    expires_at: expiresAt,
  });

  const claimUrl = `${appUrl()}/claim/${token}`;
  const body = TEXT_INVITE_BODY(claimUrl);

  // Send SMS via Twilio
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PLOT_INVITE_FROM;
  if (!accountSid || !authToken || !fromNumber) {
    console.error('Twilio plot-invite env not configured');
    await supabaseAdmin
      .from('property_inquiries')
      .update({ status: 'failed' })
      .eq('id', inquiry.id);
    return NextResponse.json({ error: 'Plot SMS not configured' }, { status: 500 });
  }

  try {
    const client = twilio(accountSid, authToken);
    const msg = await client.messages.create({ from: fromNumber, to: phone, body });
    await supabaseAdmin
      .from('property_inquiries')
      .update({ status: 'sent', twilio_sid: msg.sid, sent_at: new Date().toISOString(), cost_cents: 1 })
      .eq('id', inquiry.id);
    logCost(user.id, 'twilio', 'sms_invite', 0.01, 1, { inquiry_id: inquiry.id });
  } catch (err) {
    console.error('Twilio send error', err);
    await supabaseAdmin
      .from('property_inquiries')
      .update({ status: 'failed' })
      .eq('id', inquiry.id);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 502 });
  }

  return NextResponse.json({ inquiry_id: inquiry.id, status: 'sent' });
}

// ── direct_mail ──────────────────────────────────────────────────────────

// Plot's return address. TEMPORARY — Greg's home address used while
// we're in test mode (Lob never actually mails anything in test). Swap
// to a PO Box / virtual mailbox before flipping LOB_ENVIRONMENT=live.
// Search for "PLOT_RETURN_ADDRESS" to find the swap point when ready.
const PLOT_RETURN_ADDRESS = {
  name: 'PLOT MAPS',
  address_line1: '523 PUFFIN LANE',
  address_city: 'LEMOORE',
  address_state: 'CA',
  address_zip: '93245',
};

// Parse "123 Main St, Lemoore, CA 93245" style into street + city + state + zip,
// preferring explicit lead columns when present. Lob requires components, not
// a single formatted line.
function splitMailingAddress(
  lead: { property_address: string | null; city: string | null; state: string | null; zip: string | null }
): { line1: string; city: string; state: string; zip: string } | null {
  if (!lead.property_address) return null;
  const parts = lead.property_address.split(',').map((s) => s.trim());
  // line1 is everything before the first comma; the rest may have city/state-zip.
  const line1 = parts[0];
  // Prefer explicit columns; fall back to parsing.
  const city = lead.city || parts[1] || '';
  // state + zip are reassigned inside the parts[2] block below; city is not.
  let state = lead.state || '';
  let zip = lead.zip || '';
  if (parts[2]) {
    const m = parts[2].match(/([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/i);
    if (m) {
      state = state || m[1].toUpperCase();
      zip = zip || m[2];
    }
  }
  if (!line1 || !city || !state || !zip) return null;
  return { line1, city, state, zip };
}

async function handleDirectMail(args: {
  user: { id: string };
  edition: 'lite' | 'pro';
  lead: { id: string; property_address: string | null; city: string | null; state: string | null; zip: string | null };
  profile: { armed_mail_template_id?: string | null; full_name?: string | null } | null;
}) {
  const { user, edition, lead, profile } = args;

  const templateId = profile?.armed_mail_template_id;
  if (!templateId) {
    return NextResponse.json({ error: 'No armed mail template — visit /dashboard/arming' }, { status: 400 });
  }
  const { data: template } = await supabaseAdmin
    .from('mail_templates')
    .select('id, body_text')
    .eq('id', templateId)
    .eq('user_id', user.id)
    .single();
  if (!template) {
    return NextResponse.json({ error: 'Armed template not found' }, { status: 404 });
  }

  // Decompose mailing address into Lob's component fields. Bail with a
  // useful error rather than letting Lob fail with a cryptic 422.
  const mailingAddress = splitMailingAddress(lead);
  if (!mailingAddress) {
    return NextResponse.json(
      { error: 'Property address is incomplete (needs street, city, state, zip)' },
      { status: 422 }
    );
  }

  // 1) Record the inquiry first (queued). We need its id to mint a
  //    claim token, and we want the row to exist even if the Lob send
  //    later fails so the failure_reason captures something useful.
  const { data: inquiry, error: inqErr } = await supabaseAdmin
    .from('property_inquiries')
    .insert({
      lead_id: lead.id,
      initiator_user_id: user.id,
      initiator_edition: edition,
      channel: 'direct_mail',
      status: 'queued',
      template_id: template.id,
      mail_provider: 'lob',
    })
    .select('id')
    .single();
  if (inqErr || !inquiry) {
    console.error('inquiry insert error', inqErr);
    return NextResponse.json({ error: 'Failed to record inquiry' }, { status: 500 });
  }

  // 2) Mint a claim token (same flow as text_invite — the postcard
  //    links the owner to the same self-score page).
  const token = newToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(); // 60 days for mail
  await supabaseAdmin.from('claim_tokens').insert({
    token,
    lead_id: lead.id,
    inquiry_id: inquiry.id,
    expires_at: expiresAt,
  });
  const claimUrl = `${appUrl()}/claim/${token}`;

  // 3) Compose the postcard. v1 templates are intentionally minimal —
  //    the production-grade Surveyor-voiced template is a separate
  //    design workstream (see brand/ docs). For now, body_text from the
  //    user's armed template renders on the back; the front is a simple
  //    title block. Both are inline HTML for max merge-var flexibility.
  const senderName = profile?.full_name || 'A Surveyor';
  const front = renderPostcardFrontHtml({ senderName });
  const back = renderPostcardBackHtml({
    bodyText: template.body_text,
    claimUrl,
    senderName,
  });

  // 4) Send via Lob. Test mode by default; throws on Lob error.
  try {
    const result = await sendPostcard({
      to: {
        name: 'Property Owner', // We deliberately omit the owner's name from the postcard outer — see TEXT_INVITE_BODY invariant.
        address_line1: mailingAddress.line1,
        address_city: mailingAddress.city,
        address_state: mailingAddress.state,
        address_zip: mailingAddress.zip,
      },
      from: PLOT_RETURN_ADDRESS,
      front,
      back,
      size: '4x6',
      mailType: 'usps_first_class',
      useType: 'marketing',
      description: `Plot status inquiry — lead ${lead.id}`,
      metadata: {
        inquiry_id: inquiry.id,
        lead_id: lead.id,
        user_id: user.id,
        plot_env: lobEnvironment(),
      },
      userId: user.id,
    });

    // 5) Reconcile inquiry with provider response.
    await supabaseAdmin
      .from('property_inquiries')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        mail_provider_id: result.id,
        mail_provider_url: result.url,
        mail_provider_status: 'postcard.created',
        mail_expected_delivery_date: result.expectedDeliveryDate,
        // ~$0.92 per 4x6 first-class, tracked in cents
        cost_cents: 92,
      })
      .eq('id', inquiry.id);

    return NextResponse.json({
      inquiry_id: inquiry.id,
      status: 'sent',
      lob_postcard_id: result.id,
      preview_url: result.url,
      expected_delivery_date: result.expectedDeliveryDate,
      environment: result.environment,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.error('Lob send error', err);
    await supabaseAdmin
      .from('property_inquiries')
      .update({ status: 'failed', failure_reason: reason })
      .eq('id', inquiry.id);
    return NextResponse.json({ error: reason, code: 'lob_send_failed' }, { status: 502 });
  }
}

// ── Postcard HTML templates (v1, intentionally minimal) ──────────────
// The production artwork is a separate design workstream. v1 just
// needs to be valid Lob HTML at the right dimensions (4x6 → 1275x1875
// at 300 DPI rendered surface). Handlebars-style {{merge}} variables
// are passed via mergeVariables in sendPostcard (not used in v1
// because we render the strings server-side — kept inline for clarity).
function renderPostcardFrontHtml(args: { senderName: string }): string {
  // Front side: address is auto-overlaid by Lob; we just need a hero block.
  // 4x6 inches at 300 DPI = 1275 x 1875 pixels (with 1/8" bleed per side).
  // Lob's template guide: https://docs.lob.com/#tag/Postcards
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @page { size: 6.25in 4.25in; margin: 0; }
  body { margin: 0; padding: 0.5in 0.5in 0.5in 0.5in; font-family: Georgia, serif;
         color: #1A1F2E; background: #F4EAD5; width: 5.25in; height: 3.25in;
         display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
  .mark { font-size: 14pt; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.55; margin-bottom: 0.3in; }
  .headline { font-size: 36pt; font-weight: 800; line-height: 1.1; margin: 0; color: #C8553D; }
  .sub { font-size: 14pt; margin-top: 0.25in; opacity: 0.7; }
</style></head>
<body>
  <div class="mark">Plot · Survey No. 79-22</div>
  <div class="headline">A Surveyor is<br/>mapping your neighborhood.</div>
  <div class="sub">From the desk of ${escapeHtml(args.senderName)}</div>
</body></html>`;
}

function renderPostcardBackHtml(args: { bodyText: string; claimUrl: string; senderName: string }): string {
  // Back side: Lob requires leaving room for address block + barcode.
  // Per Lob's 4x6 template, address block lives in the lower-right
  // and the upper-left ~3in x 4in is safe artwork area.
  const bodyHtml = escapeHtml(args.bodyText).replace(/\n/g, '<br/>');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @page { size: 6.25in 4.25in; margin: 0; }
  body { margin: 0; padding: 0; font-family: Georgia, serif;
         color: #1A1F2E; background: #FBF5E6; width: 6.25in; height: 4.25in; position: relative; }
  .pad { padding: 0.4in 0.5in; width: 3.25in; }
  .body-text { font-size: 11pt; line-height: 1.4; margin: 0 0 0.2in 0; }
  .cta { font-size: 12pt; font-weight: 700; color: #C8553D; margin-top: 0.15in; }
  .url { font-family: 'Courier New', monospace; font-size: 9pt; word-break: break-all; }
  .sig { margin-top: 0.25in; font-size: 10pt; opacity: 0.7; font-style: italic; }
</style></head>
<body>
  <div class="pad">
    <p class="body-text">${bodyHtml}</p>
    <div class="cta">Tell us what you'd do:</div>
    <div class="url">${escapeHtml(args.claimUrl)}</div>
    <div class="sig">— ${escapeHtml(args.senderName)}, via Plot</div>
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── phone_call ───────────────────────────────────────────────────────────
async function handlePhoneCall(args: {
  user: { id: string };
  edition: 'lite' | 'pro';
  lead: { id: string; property_address: string | null; city: string | null; state: string | null; zip: string | null };
  phase: Phase;
}) {
  const { user, edition, lead, phase } = args;

  // Lite gating: must have available_to_be_asked owner OR a-la-carte fee paid (deferred).
  if (edition === 'lite') {
    const { data: existingScore } = await supabaseAdmin
      .from('property_self_scores')
      .select('owner_user_id')
      .eq('lead_id', lead.id)
      .eq('is_current', true)
      .maybeSingle();
    let canDial = false;
    if (existingScore?.owner_user_id) {
      const { data: prefs } = await supabaseAdmin
        .from('owner_preferences')
        .select('available_to_be_asked')
        .eq('owner_user_id', existingScore.owner_user_id)
        .maybeSingle();
      canDial = !!prefs?.available_to_be_asked;
    }
    if (!canDial) {
      return NextResponse.json({ error: 'Lite: dial not available for this property' }, { status: 403 });
    }
  }

  if (phase === 'primer') {
    const address = lead.property_address || '';
    const city = lead.city || address.split(',')[1]?.trim() || '';
    const state = lead.state || '';
    const lookup = await silentLookup({
      userId: user.id,
      leadId: lead.id,
      address,
      city,
      state,
      zip: lead.zip || undefined,
    });

    // Record the primer as a queued phone_call inquiry so the marker can show
    // "ready to dial" and we have a trail of intent.
    const { data: inquiry } = await supabaseAdmin
      .from('property_inquiries')
      .insert({
        lead_id: lead.id,
        initiator_user_id: user.id,
        initiator_edition: edition,
        channel: 'phone_call',
        status: 'queued',
      })
      .select('id')
      .single();
    return NextResponse.json({
      inquiry_id: inquiry?.id || null,
      can_dial: lookup.has_phone,
    });
  }

  // phase === 'fire'
  // The browser dials via the Twilio Voice SDK already wired at /api/twilio/token.
  // This endpoint records the fire intent (so we can mark the inquiry as sent and
  // paint the marker) and returns a token request URL the client can hit. The
  // actual call placement happens through Twilio's WebRTC bridge — never returning
  // the owner's phone number to the client.
  const { data: inquiry } = await supabaseAdmin
    .from('property_inquiries')
    .insert({
      lead_id: lead.id,
      initiator_user_id: user.id,
      initiator_edition: edition,
      channel: 'phone_call',
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  return NextResponse.json({ inquiry_id: inquiry?.id || null, status: 'sent' });
}
