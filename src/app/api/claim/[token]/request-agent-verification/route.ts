import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// POST — owner requests an agent attestation for their property.
// Sets leads.verification_requested_at, which colors the pin "Needs
// Verification" on the public map and surfaces the property in the
// agent verification queue. Idempotent.

export async function POST(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: claim } = await supabaseAdmin
    .from('claim_tokens')
    .select('lead_id, expires_at, consumed_at')
    .eq('token', token)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: 'Invalid claim link' }, { status: 404 });

  // Only the current owner_user_id on the property's self-score row can request
  // verification — prevents random claim-link holders from setting the flag.
  const { data: score } = await supabaseAdmin
    .from('property_self_scores')
    .select('owner_user_id')
    .eq('lead_id', claim.lead_id)
    .eq('is_current', true)
    .maybeSingle();
  if (!score || score.owner_user_id !== user.id) {
    return NextResponse.json(
      { error: 'Only the self-scored owner can request agent verification' },
      { status: 403 },
    );
  }

  await supabaseAdmin
    .from('leads')
    .update({ verification_requested_at: new Date().toISOString() })
    .eq('id', claim.lead_id);

  return NextResponse.json({ ok: true });
}
