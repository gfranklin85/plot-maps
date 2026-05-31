import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic — geographic query, no useful prerendered version.
export const dynamic = 'force-dynamic';

// GET /api/parcels/at-point?lat=...&lng=...
//
// True point-in-polygon parcel lookup, backed by PostGIS ST_Contains
// against properties.geom. Used by:
//   - the 3D map's gmp-click handler (Map3D gives us click lat/lng
//     directly; we resolve to a parcel server-side)
//   - the gamepad reticle's A-press (ray-cast in MapView3D gives us
//     a ground-intercept lat/lng; same resolver)
//
// Returns { apn, address, city, lat, lng } on a hit, { apn: null } on
// a miss (click landed outside any parcel — road, water, parking lot,
// or outside coverage). 200 in both cases; callers branch on apn.
//
// The lat/lng passed back is the CLICK position, not the parcel
// centroid — page.tsx uses it as the popup anchor point so the popup
// opens where the user clicked, not at the parcel's middle.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');
  const lat = latStr ? parseFloat(latStr) : NaN;
  const lng = lngStr ? parseFloat(lngStr) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('parcel_at_point', {
    lng,
    lat,
  });
  if (error) {
    console.error('parcel_at_point RPC error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row || !row.apn) {
    return NextResponse.json({ apn: null, lat, lng });
  }
  // Defensive runaway-polygon clamp. Some ingested rows (the "always-
  // Leoni-Dr" bug, 2026-05-26) have a corrupted geom that covers the
  // entire neighborhood instead of a single lot, so ST_Contains matches
  // them for every click in town. Reject anything larger than a
  // residential lot until the bad geom is fixed at the DB layer.
  // Threshold: 50,000 sqm = ~12 acres. Real residential parcels are
  // 500-3000 sqm; large commercial up to ~20,000 sqm. Anything over
  // 50k is corrupted geometry, not a real parcel.
  const RUNAWAY_AREA_SQM = 50_000;
  const areaSqm = typeof row.area_sqm === 'number' ? row.area_sqm : null;
  if (areaSqm !== null && areaSqm > RUNAWAY_AREA_SQM) {
    console.warn(
      `[parcel_at_point] rejecting runaway parcel ${row.apn} (area=${areaSqm.toFixed(0)} sqm) at ${lat},${lng}`,
    );
    return NextResponse.json({ apn: null, lat, lng, rejectedRunaway: true });
  }
  return NextResponse.json({
    apn: row.apn as string,
    address: (row.address as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    areaSqm,
    nPoints: typeof row.n_points === 'number' ? row.n_points : null,
    lat,
    lng,
  });
}
