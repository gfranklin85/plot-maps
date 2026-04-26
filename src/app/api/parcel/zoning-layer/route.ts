import { NextResponse } from 'next/server';

// Force dynamic — this route fetches a live ArcGIS service. Without this
// flag Next 14 attempts to prerender it at build time and emits a noisy
// "DYNAMIC_SERVER_USAGE" error in the build log even though the route
// works fine at runtime.
export const dynamic = 'force-dynamic';

// Returns the entire Lemoore GPLU_Zoning polygon set as GeoJSON, suitable
// for direct ingestion by google.maps.Data.addGeoJson(). Cached aggressively
// in-process — this dataset rarely changes and is ~9MB raw.

const GPLU_ZONING_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/GPLU_Zoning/FeatureServer/8/query';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

let cached: { value: unknown; expires: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cached && cached.expires > now) {
    return NextResponse.json(cached.value, {
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'X-Zoning-Cache': 'hit',
      },
    });
  }

  const params = new URLSearchParams({
    f: 'geojson',
    where: '1=1',
    outFields: 'OBJECTID,APN,SITEADDRESS1,ZONECODE,ZONEDESC,LUGPCODE,LUGPDESC,GIS_AC,USE2024,DVLP2024',
    returnGeometry: 'true',
    outSR: '4326',
    resultRecordCount: '5000',
  });

  let res: Response;
  try {
    res = await fetch(`${GPLU_ZONING_URL}?${params.toString()}`, { cache: 'no-store' });
  } catch (err) {
    console.error('ArcGIS zoning layer fetch failed:', err);
    return NextResponse.json({ error: 'GIS service unavailable' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'GIS service error', status: res.status }, { status: 502 });
  }

  const geojson = await res.json();
  cached = { value: geojson, expires: now + CACHE_TTL_MS };

  return NextResponse.json(geojson, {
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'X-Zoning-Cache': 'miss',
    },
  });
}
