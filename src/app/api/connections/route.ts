import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
// Next patches global fetch and can cache the PostgREST GET behind supabase-js
// (.select is a GET; .rpc is a POST — which is why chains were fresh while the
// wants list served stale). Force every fetch in this route to skip the cache.
export const fetchCache = 'force-no-store';

// GET /api/connections
//
// The Connection Board data: all public wants (the pins) + the computed
// connections between them (the animated arcs). memory/the_thesis (the
// connection engine — post enough wants, the map connects the dots; Commercial
// #1 "Post What You Want").

export async function GET() {
  const [wantsRes, connRes, chainsRes] = await Promise.all([
    supabaseAdmin
      .from('wants')
      .select('id, owner_name, from_label, from_lat, from_lng, to_label, status, ' +
        'acres_min, waterfront, no_hoa, has_shop, pool, near_military_base, ' +
        'target_monthly, max_price, beds_min, move_condition')
      .eq('visibility', 'public'),
    supabaseAdmin.rpc('wants_connections', { _radius_km: 1200 }),
    // Multi-party WEBS (connections are webs, not swaps): closed loops of 3-4
    // people where no two directly matched but everyone can move. Tighter
    // radius — a chain hop should be a real "that's where I'm going."
    supabaseAdmin.rpc('connection_chains', { _radius_km: 400, _max_len: 4 }),
  ]);

  if (wantsRes.error) {
    console.error('wants error:', wantsRes.error.message);
    return NextResponse.json({ error: 'wants load failed' }, { status: 500 });
  }

  const wants = wantsRes.data ?? [];
  const connections = (connRes.data ?? []) as Array<{
    a_id: string; a_label: string; a_lat: number; a_lng: number; a_to_label: string;
    b_id: string; b_label: string; b_lat: number; b_lng: number; b_to_label: string;
    match_pct: number; status: string; mutual: boolean; shared_tags: string[] | null;
  }>;

  // Dedupe symmetric pairs (A↔B and B↔A) — keep the higher match.
  const seen = new Map<string, (typeof connections)[number]>();
  for (const c of connections) {
    const key = [c.a_id, c.b_id].sort().join('|');
    const prev = seen.get(key);
    if (!prev || c.match_pct > prev.match_pct) seen.set(key, c);
  }
  const deduped = Array.from(seen.values());

  const counts = {
    activeWants: wants.length,
    newMatches: deduped.filter((c) => c.status === 'new' || c.status === 'possible_match').length,
    byStatus: {
      new: deduped.filter((c) => c.status === 'new').length,
      possible_match: deduped.filter((c) => c.status === 'possible_match').length,
      in_progress: deduped.filter((c) => c.status === 'in_progress').length,
      completed: deduped.filter((c) => c.status === 'completed').length,
    },
    total: deduped.length,
  };

  const chains = (chainsRes.data ?? []) as Array<{
    chain: string[]; labels: string[]; chain_len: number; avg_hop_km: number;
  }>;

  return NextResponse.json({ wants, connections: deduped, chains, counts });
}
