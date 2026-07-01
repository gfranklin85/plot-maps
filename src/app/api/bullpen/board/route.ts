import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { shapeBoardItem } from '@/lib/bullpen/types';

// GET /api/bullpen/board?city=&loanType=&timeline=&q=
//
// The PUBLIC board of buyer positions — the visibility platform. Anyone can
// browse (nobody is excluded; exclusion = favoring). Returns only public,
// open positions, with just the fields a browsing lender needs — never private
// data (contact, personal, who-bid-what). Anonymity is enforced in the shaper.
// (memory/project_bullpen_public_board)

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get('city')?.trim().toLowerCase() || '';
  const loanType = url.searchParams.get('loanType')?.trim() || '';
  const timeline = url.searchParams.get('timeline')?.trim() || '';
  const q = url.searchParams.get('q')?.trim() || '';

  let query = supabaseAdmin
    .from('bullpen_posts')
    .select('id, slug, display_mode, buyer_name, occupation, city, headline, monthly, needs, loan_type, timeline, price_range, military, created_at')
    .eq('is_public', true)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(200);

  if (loanType) query = query.eq('loan_type', loanType);
  if (timeline) query = query.eq('timeline', timeline);
  if (city) query = query.ilike('city', `%${city}%`);
  // Free-text: match occupation OR city.
  if (q) query = query.or(`occupation.ilike.%${q}%,city.ilike.%${q}%`);

  const { data: posts, error } = await query;
  if (error) {
    console.error('bullpen board error:', error.message);
    return NextResponse.json({ error: 'board unavailable' }, { status: 500 });
  }

  const rows = posts ?? [];
  const ids = rows.map((r) => r.id as string);

  // Offer counts per post (one round-trip, counted in memory).
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: offers } = await supabaseAdmin
      .from('bullpen_offers')
      .select('post_id')
      .in('post_id', ids);
    for (const o of offers ?? []) {
      const pid = o.post_id as string;
      counts[pid] = (counts[pid] ?? 0) + 1;
    }
  }

  const items = rows.map((r) =>
    shapeBoardItem(r as Record<string, unknown>, counts[r.id as string] ?? 0),
  );

  return NextResponse.json({ items, total: items.length });
}
