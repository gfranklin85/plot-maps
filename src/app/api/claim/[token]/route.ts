import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';

type SelfScoreState = 'here_to_stay' | 'curious_to_hear_offers' | 'would_sell_if';
type Visibility = 'private_to_initiator' | 'public';
type ClaimantRelationship =
  | 'owner'
  | 'spouse'
  | 'managing_for_owner'
  | 'executor'
  | 'trustee'
  | 'property_manager';

/** Normalize a name for comparison: lowercase, collapse whitespace,
 *  strip non-alphanumeric except spaces. Used for claimant name match
 *  against the deed-of-record on the lead row. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// GET — return property summary for the claim landing page.
// No buyer info ever included; just enough for the owner to recognize their property.
export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const { data: claim } = await supabaseAdmin
    .from('claim_tokens')
    .select('token, lead_id, inquiry_id, expires_at, consumed_at')
    .eq('token', token)
    .maybeSingle();

  if (!claim) return NextResponse.json({ error: 'Invalid claim link' }, { status: 404 });

  if (claim.expires_at && new Date(claim.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Claim link expired' }, { status: 410 });
  }

  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, property_address, city, state, zip')
    .eq('id', claim.lead_id)
    .single();

  return NextResponse.json({
    token: claim.token,
    already_claimed: !!claim.consumed_at,
    expires_at: claim.expires_at,
    property: lead
      ? {
          id: lead.id,
          address: lead.property_address,
          city: lead.city,
          state: lead.state,
          zip: lead.zip,
        }
      : null,
  });
}

// POST — owner submits self-score + destination intent.
// Requires the user to be authenticated (passwordless magic-link signup happens
// before they get here); we bind the score to auth.uid().
export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = (await request.json()) as {
    state: SelfScoreState;
    would_sell_if_condition?: string;
    would_sell_if_freetext?: string;
    destination_city?: string;
    destination_state?: string;
    destination_condition?: string;
    visibility?: Visibility;
    display_name?: string;
    available_to_be_asked?: boolean;
    claimant_name?: string;
    claimant_relationship?: ClaimantRelationship;
    contact_phone?: string;
    notification_email_enabled?: boolean;
    notification_sms_enabled?: boolean;
  };

  if (!payload.state) return NextResponse.json({ error: 'state required' }, { status: 400 });
  if (!payload.claimant_name || !payload.claimant_relationship) {
    return NextResponse.json(
      { error: 'claimant_name and claimant_relationship required' },
      { status: 400 },
    );
  }

  const { data: claim } = await supabaseAdmin
    .from('claim_tokens')
    .select('lead_id, inquiry_id, expires_at, consumed_at')
    .eq('token', token)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: 'Invalid claim link' }, { status: 404 });
  if (claim.expires_at && new Date(claim.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Claim link expired' }, { status: 410 });
  }

  // ── Verification gate ──────────────────────────────────────────────
  // Pull the lead's deed-of-record name to match against. If it's missing
  // (no skip-trace data on file), we can't enforce a strict match — fall
  // through to the manager tier regardless of the claimant's stated role.
  const { data: leadRow } = await supabaseAdmin
    .from('leads')
    .select('owner_name')
    .eq('id', claim.lead_id)
    .single();

  let verificationTier: 'owner' | 'manager' = 'manager';
  let verificationMethod: 'name_match' | 'relationship_disclosed' = 'relationship_disclosed';
  const deedName = leadRow?.owner_name || null;

  if (payload.claimant_relationship === 'owner') {
    if (!deedName) {
      // No deed on file → fall back silently to manager tier. The user
      // self-identified as owner but we have nothing to verify against,
      // so we record their relationship and downgrade the badge.
      verificationTier = 'manager';
      verificationMethod = 'relationship_disclosed';
    } else if (normalizeName(payload.claimant_name) === normalizeName(deedName)) {
      verificationTier = 'owner';
      verificationMethod = 'name_match';
    } else {
      return NextResponse.json(
        {
          error:
            'Name does not match property records. If you manage this property on behalf of someone else, change your relationship selection above.',
          code: 'name_mismatch',
        },
        { status: 422 },
      );
    }
  }

  // Mark previous self_scores for this lead as not current
  await supabaseAdmin
    .from('property_self_scores')
    .update({ is_current: false })
    .eq('lead_id', claim.lead_id)
    .eq('is_current', true);

  // Insert new score (RLS requires owner_user_id = auth.uid(); we use admin client so it bypasses)
  const { error: insertErr } = await supabaseAdmin.from('property_self_scores').insert({
    lead_id: claim.lead_id,
    owner_user_id: user.id,
    state: payload.state,
    would_sell_if_condition: payload.would_sell_if_condition || null,
    would_sell_if_freetext: payload.would_sell_if_freetext || null,
    destination_city: payload.destination_city || null,
    destination_state: payload.destination_state || null,
    destination_condition: payload.destination_condition || null,
    visibility: payload.visibility || 'public',
    triggered_by_inquiry_id: claim.inquiry_id,
    verification_tier: verificationTier,
    verification_method: verificationMethod,
    claimant_name: payload.claimant_name,
    claimant_relationship: payload.claimant_relationship,
    verified_at: new Date().toISOString(),
  });
  if (insertErr) {
    console.error('self-score insert error', insertErr);
    return NextResponse.json({ error: 'Failed to save self-score' }, { status: 500 });
  }

  // Upsert owner_preferences. contact_phone is owner-volunteered notification
  // routing only — never exposed to other users. SMS notifications can only
  // be enabled if a phone is provided.
  const contactPhone = payload.contact_phone?.trim() || null;
  const smsEnabled = contactPhone ? !!payload.notification_sms_enabled : false;
  const emailEnabled = payload.notification_email_enabled !== false; // default true
  await supabaseAdmin
    .from('owner_preferences')
    .upsert(
      {
        owner_user_id: user.id,
        available_to_be_asked: !!payload.available_to_be_asked,
        display_name: payload.display_name || null,
        contact_phone: contactPhone,
        contact_phone_kept_private: true, // server-side enforced in v1
        notification_email_enabled: emailEnabled,
        notification_sms_enabled: smsEnabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_user_id' },
    );

  // Mark claim consumed and inquiry replied
  await supabaseAdmin
    .from('claim_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('token', token);
  if (claim.inquiry_id) {
    await supabaseAdmin
      .from('property_inquiries')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', claim.inquiry_id);
  }

  return NextResponse.json({ ok: true });
}
