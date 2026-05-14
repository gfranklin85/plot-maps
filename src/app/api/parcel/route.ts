import { NextResponse } from 'next/server';
import { resolveProperty, resolvePropertyByApn } from '@/lib/property-data/resolver';

// Force dynamic — the resolver hits the DB + may call live ArcGIS as
// fallback. Without this Next 14 tries to prerender at build time and
// fails.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const apn = url.searchParams.get('apn');

  // APN lookup is exact — preferred when the caller already knows the
  // parcel (e.g. polygon click on the map). No proximity guessing, no
  // live-source fallback.
  if (apn) {
    const value = await resolvePropertyByApn(apn);
    return NextResponse.json(value);
  }

  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');
  const lat = latStr ? parseFloat(latStr) : NaN;
  const lng = lngStr ? parseFloat(lngStr) : NaN;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng or apn required' }, { status: 400 });
  }

  const value = await resolveProperty(lat, lng);
  return NextResponse.json(value);
}
