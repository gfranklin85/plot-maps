import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Debug-only diagnostic endpoint for the always-Leoni-Dr bug.
// Returns ALL parcels containing a given point (not LIMIT 1) and their
// bbox sizes, so we can see whether one parcel's geom has eaten the
// neighborhood. Lifecycle: remove once the data bug is fixed.
//
// GET /api/parcels/debug-at-point?lat=...&lng=...

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? 'NaN');
  const lng = parseFloat(url.searchParams.get('lng') ?? 'NaN');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  // Raw SQL via the supabase-js .rpc bypass. Returns up to 10 parcels
  // that ST_Contains this point + their bbox area in square meters.
  const { data, error } = await supabaseAdmin.rpc('debug_parcels_at_point', {
    lng,
    lat,
  });

  if (error) {
    // RPC doesn't exist yet — fall back to a direct query.
    const sql = `
      SELECT
        p.apn,
        p.address,
        p.city,
        ST_AsText(ST_Envelope(p.geom)) AS bbox_wkt,
        ST_Area(p.geom::geography) AS area_sqm,
        ST_NPoints(p.geom) AS n_points
      FROM properties p
      WHERE p.geom IS NOT NULL
        AND p.geom && ST_SetSRID(ST_MakePoint($1, $2), 4326)
        AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326))
      LIMIT 10
    `;
    // Supabase client doesn't expose raw SQL execution; use a custom RPC.
    return NextResponse.json({
      error: 'debug_parcels_at_point RPC missing',
      sqlToRun: sql.replace(/\$1/g, String(lng)).replace(/\$2/g, String(lat)),
      hint: 'Create the RPC in Supabase SQL editor: see the comment in this file',
    }, { status: 501 });
  }

  return NextResponse.json({
    point: { lat, lng },
    matchCount: Array.isArray(data) ? data.length : 0,
    matches: data,
  });
}

// SQL to create the RPC (run in Supabase SQL editor):
//
// CREATE OR REPLACE FUNCTION debug_parcels_at_point(lng float8, lat float8)
// RETURNS TABLE(apn text, address text, city text, bbox_wkt text, area_sqm float8, n_points int)
// LANGUAGE sql STABLE SECURITY DEFINER AS $$
//   SELECT
//     p.apn,
//     p.address,
//     p.city,
//     ST_AsText(ST_Envelope(p.geom))::text,
//     ST_Area(p.geom::geography)::float8,
//     ST_NPoints(p.geom)::int
//   FROM properties p
//   WHERE p.geom IS NOT NULL
//     AND p.geom && ST_SetSRID(ST_MakePoint(lng, lat), 4326)
//     AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
//   LIMIT 10
// $$;
//
// GRANT EXECUTE ON FUNCTION debug_parcels_at_point(float8, float8)
//   TO service_role, authenticated;
