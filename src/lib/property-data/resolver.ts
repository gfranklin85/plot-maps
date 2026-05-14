// Phase D1: Property data resolver.
//
// Single entry point for "give me everything we know about the parcel
// at this lat/lng." Order:
//   1. DB hit — find nearest property row within radius; load its layers.
//   2. If we have at least zoning OR parcel_basics from the DB, return.
//   3. Otherwise call configured live sources; first hit wins per layer.
//   4. Write-back: if a live source returns anything, upsert into DB so
//      next time it's a DB hit.
//
// Returns the legacy ParcelResponse-compatible shape so /api/parcel
// doesn't need a caller-side migration.

import { supabaseAdmin } from '@/lib/supabase-server';
import { getLiveSources } from './registry';
import {
  type PropertyDataContribution,
  type ResolvedProperty,
  emptyResolvedProperty,
  type ZoningAttrs,
  type GeneralPlanAttrs,
  type SubdivisionAttrs,
  type SitePlanAttrs,
  type ParcelBasicsAttrs,
} from './types';

// In-memory per-process cache keyed by rounded lat/lng. Matches the
// 24h TTL the pre-D1 route used. Keeps the popup snappy even on first
// hit when we have to fall back to live sources.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: ResolvedProperty; expires: number }>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

// Radius for "nearest property in the DB" lookup. ~50m at the equator.
// Smaller than typical parcel size; tightens to "this parcel, not its
// neighbor." If the DB has the right parcel for this point, the
// centroid is within ~50m for the typical residential lot in Lemoore.
const DB_LOOKUP_RADIUS_DEG = 0.00045;

interface PropertyRow {
  id: string;
  apn: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

interface LayerRow {
  layer_type: string;
  attrs: Record<string, unknown>;
  source_id: string;
  source_url: string | null;
}

// Flatten contributions (from DB or live) into the ResolvedProperty shape.
function fold(contributions: PropertyDataContribution[]): Omit<ResolvedProperty, 'hit'> {
  const out: Omit<ResolvedProperty, 'hit'> = {
    apn: null, address: null,
    zoningCode: null, zoningDesc: null,
    generalPlanCode: null, generalPlanDesc: null,
    acres: null, use2024: null, development2024: null,
    subdivision: null, sitePlan: null,
    hyperlinks: { generalPlan: null, zoning: null, code: null },
    assesseeName: null, yearBuilt: null, buildingSize: null,
    bedrooms: null, bathrooms: null, buildingType: null, netValue: null,
    raw: {},
  };

  for (const c of contributions) {
    if (c.layerType === 'zoning') {
      const a = c.attrs as ZoningAttrs;
      out.zoningCode = a.code ?? out.zoningCode;
      out.zoningDesc = a.description ?? out.zoningDesc;
      out.hyperlinks.zoning = a.hyperlink ?? out.hyperlinks.zoning;
    } else if (c.layerType === 'general_plan') {
      const a = c.attrs as GeneralPlanAttrs;
      out.generalPlanCode = a.code ?? out.generalPlanCode;
      out.generalPlanDesc = a.description ?? out.generalPlanDesc;
      out.hyperlinks.generalPlan = a.hyperlink ?? out.hyperlinks.generalPlan;
    } else if (c.layerType === 'parcel_basics') {
      const a = c.attrs as ParcelBasicsAttrs;
      out.apn = a.apn ?? out.apn;
      out.acres = a.acres ?? out.acres;
      out.use2024 = a.use ?? out.use2024;
      out.development2024 = a.development ?? out.development2024;
      out.hyperlinks.code = a.codeHyperlink ?? out.hyperlinks.code;
      // Assessor extensions — populated from richer county sources like
      // Kings County. Older sources leave these undefined and we keep null.
      out.assesseeName = a.assesseeName ?? out.assesseeName;
      out.yearBuilt = a.yearBuilt ?? out.yearBuilt;
      out.buildingSize = a.buildingSize ?? out.buildingSize;
      out.bedrooms = a.bedrooms ?? out.bedrooms;
      out.bathrooms = a.bathrooms ?? out.bathrooms;
      out.buildingType = a.buildingType ?? out.buildingType;
      out.netValue = a.netValue ?? out.netValue;
    } else if (c.layerType === 'subdivision') {
      out.subdivision = c.attrs as SubdivisionAttrs;
    } else if (c.layerType === 'site_plan') {
      out.sitePlan = c.attrs as SitePlanAttrs;
    }
  }

  return out;
}

async function findPropertyByPoint(lat: number, lng: number): Promise<PropertyRow | null> {
  // Bounding-box query first (cheap), then pick the nearest centroid.
  // Postgres can do this faster with PostGIS but the table is small
  // enough that a box query + JS distance is fine for Phase D1.
  const minLat = lat - DB_LOOKUP_RADIUS_DEG;
  const maxLat = lat + DB_LOOKUP_RADIUS_DEG;
  const minLng = lng - DB_LOOKUP_RADIUS_DEG;
  const maxLng = lng + DB_LOOKUP_RADIUS_DEG;

  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('id, apn, address, lat, lng')
    .gte('lat', minLat)
    .lte('lat', maxLat)
    .gte('lng', minLng)
    .lte('lng', maxLng);

  if (error || !data || data.length === 0) return null;

  let best: PropertyRow | null = null;
  let bestDist = Infinity;
  for (const row of data as PropertyRow[]) {
    if (row.lat == null || row.lng == null) continue;
    const dLat = row.lat - lat;
    const dLng = row.lng - lng;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestDist) {
      bestDist = d;
      best = row;
    }
  }
  return best;
}

async function loadLayersFor(propertyId: string): Promise<PropertyDataContribution[]> {
  const { data } = await supabaseAdmin
    .from('property_layers')
    .select('layer_type, attrs, source_id, source_url')
    .eq('property_id', propertyId);
  if (!data) return [];
  return (data as LayerRow[]).map(r => ({
    layerType: r.layer_type as PropertyDataContribution['layerType'],
    attrs: r.attrs,
    source_url: r.source_url ?? undefined,
  }));
}

// Write live contributions back to the DB so this point becomes a DB
// hit next time. Best-effort; failures are logged but don't break the
// read path.
async function writeBack(
  lat: number,
  lng: number,
  contributions: PropertyDataContribution[],
  sourceId: string,
): Promise<void> {
  try {
    // Find or create the spine row. Prefer APN match if a contribution
    // carries one; otherwise create a fresh row keyed on lat/lng.
    const parcelBasics = contributions.find(c => c.layerType === 'parcel_basics');
    const apn = parcelBasics ? (parcelBasics.attrs as ParcelBasicsAttrs).apn : null;

    let propertyId: string | null = null;
    if (apn) {
      const { data: existing } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('apn', apn)
        .maybeSingle();
      if (existing?.id) propertyId = existing.id;
    }
    if (!propertyId) {
      const { data: inserted } = await supabaseAdmin
        .from('properties')
        .insert({
          apn,
          lat,
          lng,
          spine_source: `${sourceId}:resolver-writeback`,
          spine_acquired_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      propertyId = inserted?.id ?? null;
    }
    if (!propertyId) return;

    // Replace this source's layers for this property.
    await supabaseAdmin
      .from('property_layers')
      .delete()
      .eq('property_id', propertyId)
      .eq('source_id', sourceId);

    const rows = contributions.map(c => ({
      property_id: propertyId,
      layer_type: c.layerType,
      source_id: sourceId,
      attrs: c.attrs,
      source_url: c.source_url ?? null,
      acquired_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      await supabaseAdmin.from('property_layers').insert(rows);
    }
  } catch (err) {
    console.error('Property resolver write-back failed:', err);
  }
}

export async function resolveProperty(lat: number, lng: number): Promise<ResolvedProperty> {
  const key = cacheKey(lat, lng);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expires > now) return cached.value;

  // 1. DB-first.
  const row = await findPropertyByPoint(lat, lng);
  if (row) {
    const layers = await loadLayersFor(row.id);
    if (layers.length > 0) {
      const folded = fold(layers);
      const value: ResolvedProperty = {
        hit: true,
        ...folded,
        apn: folded.apn ?? row.apn,
        address: folded.address ?? row.address,
      };
      cache.set(key, { value, expires: now + CACHE_TTL_MS });
      return value;
    }
  }

  // 2. Live source fallback.
  for (const source of getLiveSources()) {
    const contributions = await source.queryPoint(lat, lng);
    if (contributions && contributions.length > 0) {
      const folded = fold(contributions);
      const value: ResolvedProperty = { hit: true, ...folded };
      // Best-effort write-back so next call is a DB hit. Don't await —
      // popup doesn't need to wait for storage.
      void writeBack(lat, lng, contributions, source.id);
      cache.set(key, { value, expires: now + CACHE_TTL_MS });
      return value;
    }
  }

  // 3. No coverage anywhere.
  const miss = emptyResolvedProperty();
  cache.set(key, { value: miss, expires: now + CACHE_TTL_MS });
  return miss;
}
