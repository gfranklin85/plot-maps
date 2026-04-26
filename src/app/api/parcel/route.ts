import { NextResponse } from 'next/server';

// Public ArcGIS endpoints (City of Lemoore). All polygons in WKID 2228
// (CA State Plane Zone 4 ft) but the API accepts inSR=4326 to spare us
// the projection step.
const GPLU_ZONING_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/GPLU_Zoning/FeatureServer/8/query';
const SUBDIVISIONS_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/Site_Plans_and_Subdivisions/FeatureServer/0/query';
const SITE_PLANS_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/Site_Plans_and_Subdivisions/FeatureServer/1/query';

// Simple in-memory cache. Lemoore's data updates infrequently and a
// single user prospecting a neighborhood will hit ~30 nearby points
// from the same handful of polygons. 24h TTL is generous.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: ParcelResponse; expires: number }>();

interface SubdivisionInfo {
  name: string | null;
  tract: string | null;
  applicant: string | null;
  units: string | null;
  status: string | null;
}

interface SitePlanInfo {
  projectNumber: string | null;
  title: string | null;
  applicant: string | null;
  units: string | null;
  status: string | null;
}

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
  subdivision: SubdivisionInfo | null;
  sitePlan: SitePlanInfo | null;
  hyperlinks: {
    generalPlan: string | null;
    zoning: string | null;
    code: string | null;
  };
  raw: Record<string, unknown>;
}

async function spatialQuery(url: string, lat: number, lng: number): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    f: 'json',
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
  });
  try {
    const res = await fetch(`${url}?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json() as { features?: Array<{ attributes: Record<string, unknown> }> };
    return data.features?.[0]?.attributes || null;
  } catch (err) {
    console.error(`ArcGIS query failed for ${url}:`, err);
    return null;
  }
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

  // Three parallel point-in-polygon queries: zoning, subdivisions, site plans.
  // The zoning layer is the primary "did we find a parcel" signal; subdivision
  // and site plan are extra context that may or may not apply to this point.
  const [zoneAttrs, subAttrs, planAttrs] = await Promise.all([
    spatialQuery(GPLU_ZONING_URL, lat, lng),
    spatialQuery(SUBDIVISIONS_URL, lat, lng),
    spatialQuery(SITE_PLANS_URL, lat, lng),
  ]);

  if (!zoneAttrs) {
    const miss: ParcelResponse = {
      hit: false,
      apn: null, address: null,
      zoningCode: null, zoningDesc: null,
      generalPlanCode: null, generalPlanDesc: null,
      acres: null, use2024: null, development2024: null,
      subdivision: null, sitePlan: null,
      hyperlinks: { generalPlan: null, zoning: null, code: null },
      raw: {},
    };
    cache.set(key, { value: miss, expires: now + CACHE_TTL_MS });
    return NextResponse.json(miss, { headers: { 'X-Parcel-Cache': 'miss' } });
  }

  const a = zoneAttrs;
  const str = (obj: Record<string, unknown> | null, k: string) =>
    obj && typeof obj[k] === 'string' ? (obj[k] as string) : null;
  const num = (obj: Record<string, unknown> | null, k: string) =>
    obj && typeof obj[k] === 'number' ? (obj[k] as number) : null;

  const value: ParcelResponse = {
    hit: true,
    apn: str(a, 'APN'),
    address: [str(a, 'SITEADDRESS1'), str(a, 'SITEADDRESS2')].filter(Boolean).join(' / ') || null,
    zoningCode: str(a, 'ZONECODE'),
    zoningDesc: str(a, 'ZONEDESC'),
    generalPlanCode: str(a, 'LUGPCODE'),
    generalPlanDesc: str(a, 'LUGPDESC'),
    acres: num(a, 'GIS_AC'),
    use2024: str(a, 'USE2024'),
    development2024: str(a, 'DVLP2024'),
    subdivision: subAttrs ? {
      name: str(subAttrs, 'Subdivision_Name'),
      tract: str(subAttrs, 'Title'),
      applicant: str(subAttrs, 'Applicant'),
      units: str(subAttrs, 'Residential_Units'),
      status: str(subAttrs, 'Status'),
    } : null,
    sitePlan: planAttrs ? {
      projectNumber: str(planAttrs, 'PROJECTNUMBER'),
      title: str(planAttrs, 'Title'),
      applicant: str(planAttrs, 'Applicant'),
      units: str(planAttrs, 'Residential_Units'),
      status: str(planAttrs, 'Status'),
    } : null,
    hyperlinks: {
      generalPlan: str(a, 'HYPRLNKGP'),
      zoning: str(a, 'HYPRLNKZONE'),
      code: str(a, 'HYPRLNKCD'),
    },
    raw: a,
  };

  cache.set(key, { value, expires: now + CACHE_TTL_MS });
  return NextResponse.json(value, { headers: { 'X-Parcel-Cache': 'miss' } });
}
