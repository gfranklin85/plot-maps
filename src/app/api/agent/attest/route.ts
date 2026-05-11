import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// POST — agent attests to the IDENTITY of a property's self-scored owner.
//
// IMPORTANT: this endpoint NEVER writes to score-content fields
// (state, would_sell_if_*, destination_*, visibility). Those are owner-
// authored and stay owner-controlled. The attestation only flips
// verification metadata: tier, method, verified_at, plus an audit row
// in agent_verifications.
//
// Two preconditions, both rejected with 422 if not met:
//   1. The property has a current self-score row (something to attest to).
//   2. leads.verification_requested_at is set (owner explicitly asked).

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leadId, attestedOwnerName, notes } = (await request.json()) as {
    leadId: string;
    attestedOwnerName: string;
    notes?: string;
  };
  if (!leadId || !attestedOwnerName) {
    return NextResponse.json(
      { error: 'leadId and attestedOwnerName required' },
      { status: 400 },
    );
  }

  // Agent's license id must be on file
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('dre_license_id')
    .eq('id', user.id)
    .single();
  if (!profile?.dre_license_id) {
    return NextResponse.json(
      { error: 'Set your DRE license id at /dashboard/agent/verifications first' },
      { status: 403 },
    );
  }

  // Precondition 1: property has a current self-score row.
  const { data: score } = await supabaseAdmin
    .from('property_self_scores')
    .select('id, state')
    .eq('lead_id', leadId)
    .eq('is_current', true)
    .maybeSingle();
  if (!score) {
    return NextResponse.json(
      {
        error:
          'Property has no current owner self-score. An agent cannot attest until the owner has self-scored.',
        code: 'no_self_score',
      },
      { status: 422 },
    );
  }

  // Precondition 2: owner has explicitly requested agent verification.
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('verification_requested_at')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead?.verification_requested_at) {
    return NextResponse.json(
      {
        error:
          'Owner has not requested agent verification on this property.',
        code: 'no_verification_request',
      },
      { status: 422 },
    );
  }

  // Insert the attestation audit row
  const { error: insertErr } = await supabaseAdmin.from('agent_verifications').insert({
    lead_id: leadId,
    agent_user_id: user.id,
    agent_license_id: profile.dre_license_id,
    attested_owner_name: attestedOwnerName,
    attestation_notes: notes || null,
  });
  if (insertErr) {
    console.error('agent_verifications insert error', insertErr);
    return NextResponse.json({ error: 'Failed to record attestation' }, { status: 500 });
  }

  // Update ONLY verification metadata on the self-score row.
  // Score-content fields (state, would_sell_if_*, destination_*, visibility)
  // are intentionally left untouched.
  await supabaseAdmin
    .from('property_self_scores')
    .update({
      verification_tier: 'agent_attested',
      verification_method: 'agent_attestation',
      verified_at: new Date().toISOString(),
    })
    .eq('id', score.id);

  // Clear the request flag — the property is now verified, no more
  // "Needs Verification" beacon for it.
  await supabaseAdmin
    .from('leads')
    .update({ verification_requested_at: null })
    .eq('id', leadId);

  return NextResponse.json({ ok: true });
}
