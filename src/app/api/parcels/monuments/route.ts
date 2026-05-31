import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/parcels/monuments?minLat&minLng&maxLat&maxLng
//
// Returns the monument anchor (apn + lat/lng) for every parcel whose
// geometry intersects the given bbox. Used by PlotMonumentLayer to
// pre-mount one buried monument glb per parcel in the camera radius.
//
// Tiny payload (just apn + 2 floats per parcel) so the client can poll
// this every camera move without hammering bandwidth.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minLat = parseFloat(url.searchParams.get('minLat') ?? 'NaN');
  const minLng = parseFloat(url.searchParams.get('minLng') ?? 'NaN');
  const maxLat = parseFloat(url.searchParams.get('maxLat') ?? 'NaN');
  const maxLng = parseFloat(url.searchParams.get('maxLng') ?? 'NaN');

  if (
    !Number.isFinite(minLat) || !Number.isFinite(minLng) ||
    !Number.isFinite(maxLat) || !Number.isFinite(maxLng)
  ) {
    return NextResponse.json(
      { error: 'minLat, minLng, maxLat, maxLng required' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc('monuments_in_bbox', {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    max_features: 1500,
  });

  if (error) {
    console.error('monuments_in_bbox RPC error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }

  type Row = { apn: string; monument_lat: number; monument_lng: number };
  const monuments = (Array.isArray(data) ? (data as Row[]) : [])
    .filter(r => r.apn && typeof r.monument_lat === 'number' && typeof r.monument_lng === 'number')
    .map(r => ({ apn: r.apn, lat: r.monument_lat, lng: r.monument_lng }));

  return NextResponse.json({ monuments });
}
