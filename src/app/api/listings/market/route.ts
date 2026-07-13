import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET /api/listings/market?city=Lemoore[&state=CA]
//
// The buyer-first Market Snapshot: medians computed LIVE from sold_comps for
// the given city (sold + active + pending). Scales to any city with comps.
// Powers the right sidebar + the per-listing "how this compares" context.
// Greg 2026-07-13.

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const median = (arr: number[]): number | null => {
  const a = arr.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get('city');
  if (!city) return NextResponse.json({ error: 'city required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('sold_comps')
    .select('status, list_price, sold_price, sqft, dom')
    .ilike('city', city)
    .limit(5000);
  if (error) return NextResponse.json({ error: 'could not load' }, { status: 500 });

  const rows = data ?? [];
  const sold = rows.filter((r) => r.status === 'S' && (r.sold_price ?? 0) > 0);
  const active = rows.filter((r) => r.status === 'A');
  const pending = rows.filter((r) => r.status === 'P');

  const ppsf = (r: { sold_price: number | null; list_price: number | null; sqft: number | null }, useSold: boolean) => {
    const p = useSold ? r.sold_price : r.list_price;
    return p && r.sqft ? p / r.sqft : NaN;
  };

  const soldToList = sold
    .map((r) => (r.list_price ? (r.sold_price as number) / r.list_price : NaN))
    .filter((n) => Number.isFinite(n));
  const avgSaleToList = soldToList.length
    ? soldToList.reduce((a, b) => a + b, 0) / soldToList.length
    : null;

  const snapshot = {
    city,
    counts: { sold: sold.length, active: active.length, pending: pending.length },
    sold: {
      medianPrice: median(sold.map((r) => r.sold_price as number)),
      medianDom: median(sold.map((r) => r.dom as number)),
      medianPpsf: median(sold.map((r) => ppsf(r, true))),
      saleToListPct: avgSaleToList != null ? Math.round(avgSaleToList * 1000) / 10 : null,
    },
    active: {
      medianPrice: median(active.map((r) => r.list_price as number)),
      medianDom: median(active.map((r) => r.dom as number)),
      medianPpsf: median(active.map((r) => ppsf(r, false))),
    },
    pending: {
      medianPrice: median(pending.map((r) => r.list_price as number)),
      medianDom: median(pending.map((r) => r.dom as number)),
      medianPpsf: median(pending.map((r) => ppsf(r, false))),
    },
  };

  return NextResponse.json({ snapshot });
}
