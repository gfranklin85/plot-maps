import { NextResponse } from 'next/server';
import { resolveProperty } from '@/lib/property-data/resolver';

// Force dynamic — the resolver hits the DB + may call live ArcGIS as
// fallback. Without this Next 14 tries to prerender at build time and
// fails.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');
  const lat = latStr ? parseFloat(latStr) : NaN;
  const lng = lngStr ? parseFloat(lngStr) : NaN;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  // Resolver handles DB-first lookup, live fallback, write-back, and
  // caching. Response shape is stable across sources.
  const value = await resolveProperty(lat, lng);
  return NextResponse.json(value);
}
