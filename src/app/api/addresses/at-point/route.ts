import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET /api/addresses/at-point?lat=&lng=&radius=
//
// Closest-address lookup for the unified click resolver. Returns the
// single nearest address inside `radius` meters of the click point,
// or { id: null } if nothing is nearby.

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? 'NaN');
  const lng = parseFloat(url.searchParams.get('lng') ?? 'NaN');
  const radius = Math.max(1, Math.min(500, parseFloat(url.searchParams.get('radius') ?? '30')));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('address_at_point', {
    lat, lng, radius_m: radius,
  });

  if (error) {
    console.error('address_at_point RPC error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) {
    return NextResponse.json({ id: null, lat, lng });
  }
  return NextResponse.json({
    id: row.id,
    streetNumber: row.street_number,
    streetName: row.street_name,
    fullAddress: row.full_address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    lat: row.hit_lat,
    lng: row.hit_lng,
    distanceM: row.distance_m,
  });
}
