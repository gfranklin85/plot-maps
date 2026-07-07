import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic — geographic query.
export const dynamic = 'force-dynamic';

// GET /api/set/build?lat=...&lng=...&n=3
//
// Builds a "PlotMaps set" — the daily prospecting mission. Given an ANCHOR
// point (a listing/house you want to prospect around), returns the N nearest
// properties for a camera run-through. Simple nearest-neighbor: we're the
// ask-and-listen guys, not the data guys — no difficulty scoring, no criteria
// filtering. The set is small (default 3) on purpose: an unintimidating first
// rep that gets an agent comfortable prospecting. memory/the_thesis (gathering
// engine, the set mechanics).

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? '');
  const lng = parseFloat(url.searchParams.get('lng') ?? '');
  const nRaw = parseInt(url.searchParams.get('n') ?? '3', 10);
  const n = Number.isFinite(nRaw) ? Math.min(Math.max(nRaw, 1), 5) : 3;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('nearest_parcels_for_set', {
    _lng: lng,
    _lat: lat,
    _n: n,
  });
  if (error) {
    console.error('nearest_parcels_for_set RPC error:', error.message);
    return NextResponse.json({ error: 'set build failed' }, { status: 500 });
  }

  const stops = (Array.isArray(data) ? data : []).map((row: {
    apn: string; address: string | null; city: string | null;
    lat: number; lng: number; meters: number;
  }) => ({
    apn: row.apn,
    address: row.address,
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    meters: Math.round(row.meters),
  }));

  return NextResponse.json({ anchor: { lat, lng }, stops });
}
