import { NextResponse } from 'next/server';
import twilio from 'twilio';
import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { silentLookup } from '@/lib/skiptrace-silent';
import { logCost } from '@/lib/cost-tracker';

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

  const { leadId, channel, phase } = (await request.json()) as {
    leadId: string;
    channel: Channel;
    phase?: Phase;
  };

  if (!leadId || !channel) {
    return NextResponse.json({ error: 'leadId and channel required' }, { status: 400 });
  }

  // Load profile (edition + arming) and the property
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('plot_edition, armed_channel, armed_mail_template_id, twilio_phone_number')
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
async function handleDirectMail(args: {
  user: { id: string };
  edition: 'lite' | 'pro';
  lead: { id: string; property_address: string | null; city: string | null; state: string | null; zip: string | null };
  profile: { armed_mail_template_id?: string | null } | null;
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
  if (!lead.property_address) {
    return NextResponse.json({ error: 'No mailing address available' }, { status: 422 });
  }

  // Phase 1: stub the provider call. Provider integration (Lob/PostGrid/Click2Mail)
  // wires into mail_provider_id later; for now we record the inquiry as queued so the
  // marker overlay paints and the user-facing flow works end to end.
  const { data: inquiry, error: inqErr } = await supabaseAdmin
    .from('property_inquiries')
    .insert({
      lead_id: lead.id,
      initiator_user_id: user.id,
      initiator_edition: edition,
      channel: 'direct_mail',
      status: 'queued',
      template_id: template.id,
      sent_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (inqErr || !inquiry) {
    return NextResponse.json({ error: 'Failed to record inquiry' }, { status: 500 });
  }
  return NextResponse.json({ inquiry_id: inquiry.id, status: 'queued' });
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
