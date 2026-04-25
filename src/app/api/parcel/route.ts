import { NextResponse } from 'next/server';

// Public ArcGIS endpoint for City of Lemoore's combined General Plan +
// Zoning layer. Polygons cover all parcels within City limits + sphere
// of influence. WKID 2228 (CA State Plane Zone 4 ft).
const GPLU_ZONING_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/GPLU_Zoning/FeatureServer/8/query';

// Simple in-memory cache. Lemoore's data updates infrequently and a
// single user prospecting a neighborhood will hit ~30 nearby points
// from the same handful of polygons. 24h TTL is generous.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: ParcelResponse; expires: number }>();

interface ParcelResponse {
  hit: boolean;
  apn: string | null;
  address: string | null;
  zoningCode: string | null;
  zoningDesc: string | null;
  generalPlanCode: string | null;
  generalPlanDesc: string | null;
  acres: number | null;
  use2024: string | null;
  development2024: string | null;
  hyperlinks: {
    generalPlan: string | null;
    zoning: string | null;
    code: string | null;
  };
  raw: Record<string, unknown>;
}

function cacheKey(lat: number, lng: number): string {
  // Round to ~5 meters to amplify cache hits on neighbor lookups.
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');
  const lat = latStr ? parseFloat(latStr) : NaN;
  const lng = lngStr ? parseFloat(lngStr) : NaN;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const key = cacheKey(lat, lng);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) {
    return NextResponse.json(cached.value, {
      headers: { 'X-Parcel-Cache': 'hit' },
    });
  }

  // Spatial query: point-in-polygon. inSR=4326 lets us pass WGS84 lat/lng
  // directly; outSR=4326 returns geometry in WGS84 too if we ever ask for it.
  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
  });

  let arcgisRes: Response;
  try {
    arcgisRes = await fetch(`${GPLU_ZONING_URL}?${params.toString()}`, {
      // Avoid Next caching the upstream — we cache in-process via `cache` above.
      cache: 'no-store',
    });
  } catch (err) {
    console.error('ArcGIS fetch failed:', err);
    return NextResponse.json({ error: 'GIS service unavailable' }, { status: 502 });
  }

  if (!arcgisRes.ok) {
    return NextResponse.json({ error: 'GIS service error', status: arcgisRes.status }, { status: 502 });
  }

  const data = await arcgisRes.json() as { features?: Array<{ attributes: Record<string, unknown> }> };
  const feature = data.features?.[0];

  if (!feature) {
    const miss: ParcelResponse = {
      hit: false,
      apn: null, address: null,
      zoningCode: null, zoningDesc: null,
      generalPlanCode: null, generalPlanDesc: null,
      acres: null, use2024: null, development2024: null,
      hyperlinks: { generalPlan: null, zoning: null, code: null },
      raw: {},
    };
    cache.set(key, { value: miss, expires: now + CACHE_TTL_MS });
    return NextResponse.json(miss, { headers: { 'X-Parcel-Cache': 'miss' } });
  }

  const a = feature.attributes;
  const str = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : null);
  const num = (k: string) => (typeof a[k] === 'number' ? (a[k] as number) : null);

  const value: ParcelResponse = {
    hit: true,
    apn: str('APN'),
    address: [str('SITEADDRESS1'), str('SITEADDRESS2')].filter(Boolean).join(' / ') || null,
    zoningCode: str('ZONECODE'),
    zoningDesc: str('ZONEDESC'),
    generalPlanCode: str('LUGPCODE'),
    generalPlanDesc: str('LUGPDESC'),
    acres: num('GIS_AC'),
    use2024: str('USE2024'),
    development2024: str('DVLP2024'),
    hyperlinks: {
      generalPlan: str('HYPRLNKGP'),
      zoning: str('HYPRLNKZONE'),
      code: str('HYPRLNKCD'),
    },
    raw: a,
  };

  cache.set(key, { value, expires: now + CACHE_TTL_MS });
  return NextResponse.json(value, { headers: { 'X-Parcel-Cache': 'miss' } });
}
