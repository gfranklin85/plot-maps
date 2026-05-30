import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic — single-record geometry query.
export const dynamic = 'force-dynamic';

// GET /api/parcels/by-apn?apn=...
//
// Returns one parcel's polygon as GeoJSON for the selected-property
// highlight layer. Locked 2026-05-30 evening. Used by
// PlotPropertyHighlight to render the actual lot outline as a
// <gmp-polygon-3d-interactive> over Google's photoreal tiles when the
// property is in a covered county (Kings, Tulare, Fresno, Sacramento).
//
// Requires: parcel_geom_by_apn RPC defined in parcel-by-apn-migration.sql.
//
// Returns { apn, geometry, address, city } on a hit, { apn: null } on
// a miss (apn not in PostGIS — out of coverage or unknown APN).

export async function GET(req: Request) {
  const url = new URL(req.url);
  const apn = url.searchParams.get('apn');
  if (!apn) {
    return NextResponse.json({ error: 'apn required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('parcel_geom_by_apn', {
    apn_in: apn,
  });
  if (error) {
    console.error('parcel_geom_by_apn RPC error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row) {
    return NextResponse.json({ apn: null });
  }

  let geometry: unknown = null;
  try {
    if (row.geom_json) geometry = JSON.parse(row.geom_json);
  } catch { /* skip */ }

  return NextResponse.json({
    apn: row.apn as string,
    address: (row.address as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    geometry,
  });
}
