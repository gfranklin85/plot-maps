import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Force dynamic — bbox-driven, no useful prerendered version.
export const dynamic = 'force-dynamic';

// GET /api/parcels/viewport?bbox=minLng,minLat,maxLng,maxLat&zoom=14
//
// Returns a GeoJSON FeatureCollection of parcel polygons intersecting the
// viewport. Each feature carries enough properties on it to drive the
// color overlays directly (no extra fetch needed when switching layers).
//
// Zoom-gated: at low zoom levels we'd return 50K+ polygons and the
// browser would melt. We refuse anything below MIN_ZOOM and cap results
// at MAX_FEATURES. Caller is expected to read the response status — if
// 200 with truncated=true, refine the viewport or zoom in.

const MIN_ZOOM = 14;
const MAX_FEATURES = 5000;

// Calls a PostGIS-backed RPC to fetch the viewport intersect in a single
// round trip with the geometry already in GeoJSON form. Defined in the
// geometry migration's companion RPC.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const bboxStr = url.searchParams.get('bbox');
  const zoomStr = url.searchParams.get('zoom');
  if (!bboxStr) {
    return NextResponse.json({ error: 'bbox required' }, { status: 400 });
  }
  const parts = bboxStr.split(',').map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isFinite(p))) {
    return NextResponse.json({ error: 'bbox must be 4 numbers' }, { status: 400 });
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  const zoom = zoomStr ? parseFloat(zoomStr) : MIN_ZOOM;
  if (zoom < MIN_ZOOM) {
    return NextResponse.json({
      type: 'FeatureCollection',
      features: [],
      truncated: false,
      reason: 'zoom_too_low',
      minZoom: MIN_ZOOM,
    });
  }

  // RPC returns one row per parcel: id, apn, geom_json (GeoJSON geometry
  // string), and the few attributes we want to drive the color overlays
  // without making the client fetch anything else. We cap rows; if the
  // viewport contains more than MAX_FEATURES parcels, we return the cap
  // and tell the client it was truncated.
  const { data, error } = await supabaseAdmin.rpc('parcels_in_bbox', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    max_features: MAX_FEATURES,
  });

  if (error) {
    console.error('parcels_in_bbox RPC error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  type Row = {
    id: string;
    apn: string | null;
    geom_json: string;
    address: string | null;
    city: string | null;
    property_type: string | null;
    year_built: number | null;
    building_sqft: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    assessee_name: string | null;
  };
  const rows: Row[] = (data as Row[]) ?? [];
  const truncated = rows.length >= MAX_FEATURES;

  // Pull the assessor net_value from property_layers in a second query.
  // Keeping it out of the primary RPC keeps that query lean (just spine
  // columns + geom). For viewports that return thousands of features
  // this is one round trip not N.
  const ids = rows.map(r => r.id);
  const netValueByApn = new Map<string, number>();
  if (ids.length > 0) {
    const { data: layerRows } = await supabaseAdmin
      .from('property_layers')
      .select('property_id, attrs')
      .in('property_id', ids)
      .eq('layer_type', 'parcel_basics');
    if (layerRows) {
      const apnById = new Map(rows.map(r => [r.id, r.apn]));
      for (const lr of layerRows as { property_id: string; attrs: Record<string, unknown> }[]) {
        const apn = apnById.get(lr.property_id);
        const nv = lr.attrs?.netValue;
        if (apn && typeof nv === 'number') netValueByApn.set(apn, nv);
      }
    }
  }

  const features = rows.map(r => {
    let geometry: unknown = null;
    try { geometry = JSON.parse(r.geom_json); } catch { /* skip */ }
    return {
      type: 'Feature' as const,
      id: r.id,
      geometry,
      properties: {
        apn: r.apn,
        address: r.address,
        city: r.city,
        propertyType: r.property_type,
        yearBuilt: r.year_built,
        buildingSqft: r.building_sqft,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        assesseeName: r.assessee_name,
        netValue: r.apn ? netValueByApn.get(r.apn) ?? null : null,
      },
    };
  });

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    truncated,
  });
}
