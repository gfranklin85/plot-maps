import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET — list threads visible to the current user.
// As inquirer: every lead they sent an inquiry on, with thread + score state.
// As owner: every lead they're the current self-score owner of.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Inquirer threads — properties the user has sent inquiries to
  const { data: inquired } = await supabaseAdmin
    .from('property_inquiries')
    .select('lead_id, channel, status, sent_at')
    .eq('initiator_user_id', user.id)
    .order('sent_at', { ascending: false });

  // Owner threads — properties they self-scored
  const { data: ownedScores } = await supabaseAdmin
    .from('property_self_scores')
    .select('lead_id, state, set_at')
    .eq('owner_user_id', user.id)
    .eq('is_current', true);

  // Collapse to unique lead_ids and pick the most-recent metadata per lead
  const leadMap = new Map<string, { role: 'inquirer' | 'owner'; latest_at: string | null; meta: Record<string, unknown> }>();
  for (const row of inquired || []) {
    leadMap.set(row.lead_id, {
      role: 'inquirer',
      latest_at: row.sent_at,
      meta: { channel: row.channel, status: row.status },
    });
  }
  for (const row of ownedScores || []) {
    leadMap.set(row.lead_id, {
      role: 'owner',
      latest_at: row.set_at,
      meta: { score_state: row.state },
    });
  }

  const leadIds = Array.from(leadMap.keys());
  if (leadIds.length === 0) return NextResponse.json({ threads: [] });

  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('id, property_address, city, state')
    .in('id', leadIds);

  const threads = (leads || []).map(l => {
    const m = leadMap.get(l.id)!;
    return {
      lead_id: l.id,
      address: l.property_address,
      city: l.city,
      state: l.state,
      role: m.role,
      latest_at: m.latest_at,
      ...m.meta,
    };
  });

  return NextResponse.json({ threads });
}
