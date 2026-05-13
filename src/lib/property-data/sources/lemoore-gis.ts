// Phase D1: Lemoore GIS adapter.
//
// City of Lemoore publishes their property data on a public ArcGIS server.
// Three layers we consume:
//   - GPLU_Zoning/8        — combined zoning + general plan + parcel basics
//   - Site_Plans_and_Subdivisions/0   — subdivision records
//   - Site_Plans_and_Subdivisions/1   — site plan records
//
// Two adapter modes:
//   - LEMOORE_GIS_LIVE: per-point spatial queries; used as fallback when
//     the local DB doesn't have coverage for a point. Same logic as the
//     pre-D1 /api/parcel route, just behind the PropertyDataSource interface.
//   - LEMOORE_GIS_SNAPSHOT: bulk-pulls all features and upserts into
//     properties + property_layers. Run once via the admin panel to
//     transfer Lemoore from "live passthrough" to "fully owned snapshot".

import type {
  PropertyDataSource,
  PropertyDataContribution,
  SnapshotOpts,
  SnapshotResult,
  ZoningAttrs,
  GeneralPlanAttrs,
  SubdivisionAttrs,
  SitePlanAttrs,
  ParcelBasicsAttrs,
} from '../types';
import { supabaseAdmin } from '@/lib/supabase-server';

const GPLU_ZONING_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/GPLU_Zoning/FeatureServer/8/query';
const SUBDIVISIONS_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/Site_Plans_and_Subdivisions/FeatureServer/0/query';
const SITE_PLANS_URL = 'https://services8.arcgis.com/IX3Ksbq0XGWYwFfK/ArcGIS/rest/services/Site_Plans_and_Subdivisions/FeatureServer/1/query';

const LICENSE = 'public record (CA Govt Code § 6250 et seq.); City of Lemoore GIS';

// ── Helpers ────────────────────────────────────────────────────────────

function s(obj: Record<string, unknown> | null | undefined, k: string): string | null {
  return obj && typeof obj[k] === 'string' ? (obj[k] as string) : null;
}
function n(obj: Record<string, unknown> | null | undefined, k: string): number | null {
  return obj && typeof obj[k] === 'number' ? (obj[k] as number) : null;
}

// Spatial point query — keep the contract identical to the pre-D1 route.
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
    console.error(`Lemoore ArcGIS query failed for ${url}:`, err);
    return null;
  }
}

// Bulk page query for snapshot — pulls all features with pagination.
// ArcGIS FeatureServer caps at 2000 features per page by default; we
// page via resultOffset + resultRecordCount.
async function bulkQuery(url: string, offset: number, count: number): Promise<Array<{ attributes: Record<string, unknown>; geometry?: { x?: number; y?: number; rings?: number[][][] } }>> {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    resultOffset: String(offset),
    resultRecordCount: String(count),
  });
  const res = await fetch(`${url}?${params.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Lemoore ArcGIS bulk query failed: ${res.status}`);
  const data = await res.json() as { features?: Array<{ attributes: Record<string, unknown>; geometry?: { x?: number; y?: number; rings?: number[][][] } }> };
  return data.features || [];
}

// Approximate centroid of a polygon ring. For Lemoore the spatialReference
// is requested as 4326 in the URL so the values are already lat/lng.
function centroidOfRings(rings: number[][][] | undefined): { lat: number; lng: number } | null {
  if (!rings || rings.length === 0 || rings[0].length === 0) return null;
  const ring = rings[0];
  let sumX = 0, sumY = 0, count = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
    count++;
  }
  if (count === 0) return null;
  return { lat: sumY / count, lng: sumX / count };
}

// ── queryPoint translators (per-point → contributions) ───────────────

function zoneAttrsToContributions(a: Record<string, unknown>): PropertyDataContribution[] {
  const out: PropertyDataContribution[] = [];

  const zoning: ZoningAttrs = {
    code: s(a, 'ZONECODE'),
    description: s(a, 'ZONEDESC'),
    hyperlink: s(a, 'HYPRLNKZONE'),
  };
  out.push({ layerType: 'zoning', attrs: zoning });

  const generalPlan: GeneralPlanAttrs = {
    code: s(a, 'LUGPCODE'),
    description: s(a, 'LUGPDESC'),
    hyperlink: s(a, 'HYPRLNKGP'),
  };
  out.push({ layerType: 'general_plan', attrs: generalPlan });

  const parcelBasics: ParcelBasicsAttrs = {
    apn: s(a, 'APN'),
    acres: n(a, 'GIS_AC'),
    use: s(a, 'USE2024'),
    development: s(a, 'DVLP2024'),
    codeHyperlink: s(a, 'HYPRLNKCD'),
  };
  out.push({ layerType: 'parcel_basics', attrs: parcelBasics });

  return out;
}

function subAttrsToContribution(a: Record<string, unknown>): PropertyDataContribution {
  const subdivision: SubdivisionAttrs = {
    name: s(a, 'Subdivision_Name'),
    tract: s(a, 'Title'),
    applicant: s(a, 'Applicant'),
    units: s(a, 'Residential_Units'),
    status: s(a, 'Status'),
  };
  return { layerType: 'subdivision', attrs: subdivision };
}

function planAttrsToContribution(a: Record<string, unknown>): PropertyDataContribution {
  const sitePlan: SitePlanAttrs = {
    projectNumber: s(a, 'PROJECTNUMBER'),
    title: s(a, 'Title'),
    applicant: s(a, 'Applicant'),
    units: s(a, 'Residential_Units'),
    status: s(a, 'Status'),
  };
  return { layerType: 'site_plan', attrs: sitePlan };
}

// ── Live source ────────────────────────────────────────────────────────

export const LEMOORE_GIS_LIVE: PropertyDataSource = {
  id: 'lemoore-gis-live',
  description: 'City of Lemoore ArcGIS — live point queries (fallback path)',
  kind: 'arcgis_live',
  licenseReference: LICENSE,
  contributes: ['zoning', 'general_plan', 'parcel_basics', 'subdivision', 'site_plan'],

  async queryPoint(lat: number, lng: number): Promise<PropertyDataContribution[] | null> {
    const [zoneAttrs, subAttrs, planAttrs] = await Promise.all([
      spatialQuery(GPLU_ZONING_URL, lat, lng),
      spatialQuery(SUBDIVISIONS_URL, lat, lng),
      spatialQuery(SITE_PLANS_URL, lat, lng),
    ]);

    if (!zoneAttrs) return null; // outside Lemoore city limits

    const contributions: PropertyDataContribution[] = zoneAttrsToContributions(zoneAttrs);
    if (subAttrs) contributions.push(subAttrsToContribution(subAttrs));
    if (planAttrs) contributions.push(planAttrsToContribution(planAttrs));
    return contributions;
  },
};

// ── Snapshot source ───────────────────────────────────────────────────

export const LEMOORE_GIS_SNAPSHOT: PropertyDataSource = {
  ...LEMOORE_GIS_LIVE,
  id: 'lemoore-gis-snapshot',
  description: 'City of Lemoore ArcGIS — full bulk snapshot into local DB',
  kind: 'arcgis_snapshot',

  async snapshot({ ingestId, onProgress }: SnapshotOpts): Promise<SnapshotResult> {
    // Pull the GPLU_Zoning layer in pages. Each parcel feature has its
    // own polygon; we use the centroid for the spine row's lat/lng and
    // store the full attrs as a parcel_basics + zoning + general_plan
    // contribution. Subdivisions and site plans are looser polygons that
    // may cover many parcels — we ingest them separately, then in a
    // second pass we point-in-polygon them against the parcels we
    // ingested in pass 1.
    let offset = 0;
    const pageSize = 1000;
    let totalIngested = 0;
    let totalUpdated = 0;

    // ── Pass 1: parcels (zoning + general_plan + parcel_basics) ──────
    while (true) {
      const features = await bulkQuery(GPLU_ZONING_URL, offset, pageSize);
      if (features.length === 0) break;

      for (const feature of features) {
        const a = feature.attributes;
        const apn = s(a, 'APN');
        const centroid = centroidOfRings(feature.geometry?.rings);
        if (!apn && !centroid) continue;

        const propertyRow = {
          apn,
          fips_county_code: '06031', // Kings County, CA
          address: [s(a, 'SITEADDRESS1'), s(a, 'SITEADDRESS2')].filter(Boolean).join(' / ') || null,
          city: 'Lemoore',
          state: 'CA',
          zip: null as string | null,
          lat: centroid?.lat ?? null,
          lng: centroid?.lng ?? null,
          spine_source: `lemoore-gis-snapshot:${ingestId}`,
          spine_acquired_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Upsert spine row keyed on APN.
        let propertyId: string | null = null;
        if (apn) {
          const { data: existing } = await supabaseAdmin
            .from('properties')
            .select('id')
            .eq('apn', apn)
            .maybeSingle();
          if (existing?.id) {
            propertyId = existing.id;
            await supabaseAdmin.from('properties').update(propertyRow).eq('id', propertyId);
            totalUpdated++;
          } else {
            const { data: inserted } = await supabaseAdmin
              .from('properties')
              .insert(propertyRow)
              .select('id')
              .single();
            propertyId = inserted?.id ?? null;
            if (propertyId) totalIngested++;
          }
        }

        if (!propertyId) continue;

        // Replace this source's layers for this property in one pass.
        await supabaseAdmin
          .from('property_layers')
          .delete()
          .eq('property_id', propertyId)
          .eq('source_id', 'lemoore-gis-snapshot');

        const contributions = zoneAttrsToContributions(a);
        const rows = contributions.map(c => ({
          property_id: propertyId,
          layer_type: c.layerType,
          source_id: 'lemoore-gis-snapshot',
          attrs: c.attrs,
          source_url: c.source_url ?? null,
          effective_at: c.effective_at ?? null,
          acquired_at: new Date().toISOString(),
        }));
        if (rows.length > 0) {
          await supabaseAdmin.from('property_layers').insert(rows);
        }
      }

      offset += features.length;
      onProgress?.(offset);
      if (features.length < pageSize) break;
    }

    // ── Pass 2: subdivisions ─────────────────────────────────────────
    // Each subdivision polygon may cover many parcels. We pull them as
    // a small set (Lemoore has dozens, not thousands) and intersect via
    // ArcGIS point queries we already cache against centroids — for the
    // first cut we ignore intersection and just attach the subdivision
    // record to any parcel whose centroid falls inside the subdivision
    // polygon. Simpler approach: we punt on the join here and rely on
    // the live source to attach subdivision/site_plan on read. Pass 2
    // is left as a future enhancement; documented in plan.
    //
    // For Phase D1 the snapshot covers the per-parcel layers (zoning,
    // general_plan, parcel_basics). Subdivisions + site plans still
    // resolve via the live source on demand. This keeps D1 shippable
    // and ~10K parcel writes finite. D2 can fold subdivision/site_plan
    // snapshotting in with the same pattern.

    return { recordsIngested: totalIngested, recordsUpdated: totalUpdated };
  },
};

// Registered sources for this module. The resolver imports REGISTERED
// to know what's live, and the admin panel uses the same list to know
// what snapshots can be run.
export const LEMOORE_SOURCES = [LEMOORE_GIS_LIVE, LEMOORE_GIS_SNAPSHOT];
