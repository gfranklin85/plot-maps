// Phase D2: Kings County, CA parcel adapter.
//
// Reads from a local shapefile bundle (.shp + .dbf + .prj) that was pulled
// directly from the Kings County Assessor's office. The file is a one-time
// purchase by Greg (a licensed Realtor with legitimate access); ingest is
// pure transformation from a flat file into our normalized properties +
// property_layers schema.
//
// What this gives Plot:
//   - ~52K parcel rows covering all of Kings County (city of Lemoore plus
//     unincorporated + Hanford, Corcoran, Avenal, etc.)
//   - Full structure data per parcel — year built, sqft, beds, baths,
//     condition, construction, heating/cooling, etc.
//   - Assessor net value, land value, structure value
//   - Owner-of-record name (public record)
//   - Mailing + situs addresses
//
// What it does NOT give:
//   - Contact data (no phone, no email — Tracerfy still owns that)
//   - MLS listing status (separate workflow via Greg's MLS membership)
//
// Source provenance:
//   - One-time purchase from Kings County Assessor, May 11 2026 export.
//   - Public records under CA Govt Code § 6250 et seq.
//   - Local path expected at data/kings-parcels/KingsCountyParcels_5_11_26.*
//     Override via env var PLOT_KINGS_PARCELS_PATH if needed.

import path from 'path';
import { promises as fs } from 'fs';
import * as shapefile from 'shapefile';
import type {
  PropertyDataSource,
  PropertyDataContribution,
  ParcelBasicsAttrs,
  SnapshotOpts,
  SnapshotResult,
} from '../types';
import { supabaseAdmin } from '@/lib/supabase-server';

const LICENSE = 'public record (CA Govt Code § 6250 et seq.); Kings County Assessor — purchased flat-file export 2026-05-11';
const DEFAULT_BASENAME = 'KingsCountyParcels_5_11_26';

// Helper: pull a string field tolerantly. DBF text fields often arrive
// padded with spaces, so trim and normalize empty → null.
function s(props: Record<string, unknown>, key: string): string | null {
  const v = props[key];
  if (v == null) return null;
  if (typeof v !== 'string') return String(v).trim() || null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

// Helper: pull a number field tolerantly. Some Kings columns are typed as
// Double in the DBF but others are Text strings holding numeric values
// ("1985"). Accept either.
function n(props: Record<string, unknown>, key: string): number | null {
  const v = props[key];
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const parsed = parseFloat(t);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickPath(): { shpPath: string; dbfPath: string } {
  const base = process.env.PLOT_KINGS_PARCELS_PATH
    || path.join(process.cwd(), 'data', 'kings-parcels', DEFAULT_BASENAME);
  return { shpPath: `${base}.shp`, dbfPath: `${base}.dbf` };
}

async function pathExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

// Translate one Kings County DBF record into a parcel_basics contribution
// carrying every useful assessor field. Spine fields (APN, address, lat/lng)
// are pulled out separately by the snapshot loop.
function buildParcelBasics(props: Record<string, unknown>): ParcelBasicsAttrs {
  return {
    apn: s(props, 'APN'),
    acres: n(props, 'Acres'),
    assesseeName: s(props, 'AssesseeNa'),
    landUseCode: s(props, 'LandUseCod'),
    zoningCode: s(props, 'AsmtZoning'),
    taxabilityFull: s(props, 'AsmtTaxabi'),
    tra: s(props, 'AsmtTRA'),
    netValue: n(props, 'NetValue'),
    landValue: n(props, 'land'),
    structureValue: n(props, 'Structure'),
    community: s(props, 'Community'),
    mailingAddress1: s(props, 'Address1'),
    mailingAddress2: s(props, 'Address2'),
    mailingAddress3: s(props, 'Address3'),
    mailingAddress4: s(props, 'Address4'),
    situsAddress1: s(props, 'FormattedS'),
    situsAddress2: s(props, 'Formatte_1'),
    yearBuilt: s(props, 'YearBuilt'),
    effectiveYear: s(props, 'EffectiveY'),
    buildingType: s(props, 'BuildingTy'),
    buildingSize: n(props, 'BuildingSi'),
    buildingUsedFor: s(props, 'BuildingUs'),
    storiesCount: s(props, 'StoriesCnt'),
    unitsCount: s(props, 'UnitsCnt'),
    condition: s(props, 'Condition'),
    qualityClass: s(props, 'QualityCla'),
    bedrooms: s(props, 'BedRooms'),
    bathrooms: s(props, 'BathRooms'),
    halfBaths: s(props, 'HalfBaths'),
    construction: s(props, 'Constructi'),
    foundation: s(props, 'Foundation'),
    exteriorType: s(props, 'ExteriorTy'),
    roofCover: s(props, 'RoofCover'),
    heating: s(props, 'Heating'),
    coolingCentral: s(props, 'CoolingCen'),
    fireplace: s(props, 'FirePlace'),
    garage: s(props, 'Garage'),
    attachGarageSqft: n(props, 'AttachGara'),
    detachGarageSqft: n(props, 'DetachGara'),
    poolSpa: s(props, 'PoolSpa'),
    solar: s(props, 'Solar'),
    hasWell: s(props, 'HasWell'),
    hasOrchard: s(props, 'HasOrchard'),
    hasVineyard: s(props, 'HasVineYar'),
    subdivisionName: s(props, 'SubdivName'),
    homesiteAcres: s(props, 'Homesite_A'),
    growingAcres: s(props, 'Growing_Ac'),
    primeAcres: s(props, 'Prime_Acre'),
    openSpaceAcres: s(props, 'Open_Space'),
    urbanAcres: s(props, 'Urban_Acre'),
    neighborhoodCode: s(props, 'Neighborho'),
    waterSource: s(props, 'WaterSourc'),
    sewerCode: s(props, 'SewerCode'),
  };
}

// Best-effort lat/lng from a Kings County DBF record. The export includes
// pre-computed Longitude/Latitude strings derived from the centroid of the
// parcel polygon — using those avoids us having to reproject from State
// Plane Zone 4 for every parcel. When those columns are blank (rare, e.g.
// for some weird condo records) we fall back to the geometry centroid in
// WGS84 — but the .prj is State Plane and we'd need proj4 to convert. For
// the first pass we just skip those rows; we can revisit if there are
// many. In testing on Kings the pre-computed lat/lng covered ~99%.
function pickLatLng(props: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = n(props, 'Latitude');
  const lng = n(props, 'Longitude');
  if (lat == null || lng == null) return null;
  // Sanity bounds. Kings County is roughly lat 35.7-36.4, lng -120.5 to -119.4.
  // Reject anything wildly outside California so we don't pollute the spine
  // with garbage coords from bad source rows.
  if (lat < 32 || lat > 43) return null;
  if (lng < -125 || lng > -114) return null;
  return { lat, lng };
}

// Spine address — prefer situs (the actual property address) over mailing.
function pickAddress(props: Record<string, unknown>): string | null {
  const situs1 = s(props, 'FormattedS');
  const situs2 = s(props, 'Formatte_1');
  if (situs1 || situs2) return [situs1, situs2].filter(Boolean).join(' / ');
  return s(props, 'Address1');
}

export const KINGS_COUNTY_SHAPEFILE: PropertyDataSource = {
  id: 'kings-county-assessor-2026-05',
  description: 'Kings County, CA Assessor parcel export (May 11 2026 snapshot)',
  kind: 'csv_import',
  licenseReference: LICENSE,
  contributes: ['parcel_basics'],

  // No live point queries — this is a bulk-snapshot source only. The
  // resolver still hits the DB first, so once the snapshot has run, popups
  // anywhere in Kings County serve from local rows.
  async queryPoint(): Promise<PropertyDataContribution[] | null> {
    return null;
  },

  async snapshot({ onProgress }: SnapshotOpts): Promise<SnapshotResult> {
    const { shpPath, dbfPath } = pickPath();

    if (!(await pathExists(shpPath)) || !(await pathExists(dbfPath))) {
      throw new Error(
        `Kings County shapefile not found at ${shpPath}. ` +
        `Set PLOT_KINGS_PARCELS_PATH or place files under data/kings-parcels/.`,
      );
    }

    const source = await shapefile.open(shpPath, dbfPath);

    let totalIngested = 0;
    // totalUpdated stays at 0 in v1 — Supabase upsert doesn't distinguish
    // insert from update in the returned rows. Operators can inspect the
    // property_data_ingests row + a follow-up `select count(*)` on the
    // spine if precise insert/update accounting is needed. Documented in
    // comment further down.
    const totalUpdated = 0;
    let read = 0;

    // Two-queue batching strategy: the spine row needs to exist before we
    // can attach layer rows that reference its id. So we batch APN-keyed
    // spine upserts, recover the resulting ids, then batch insert the
    // corresponding parcel_basics layer rows. Keeps memory bounded at
    // ~BATCH_SIZE * row-size, and keeps round-trips reasonable.
    const BATCH_SIZE = 500;

    type SpinePending = {
      apn: string;
      row: Record<string, unknown>;
      basics: ParcelBasicsAttrs;
    };
    let queue: SpinePending[] = [];

    const flush = async () => {
      if (queue.length === 0) return;

      // Step 1: upsert spine rows in one round trip per batch.
      // Supabase upsert on a unique APN key. We use insert with
      // onConflict to merge.
      const spineRows = queue.map(q => q.row);
      const { data: upserted, error: upsertErr } = await supabaseAdmin
        .from('properties')
        .upsert(spineRows, { onConflict: 'apn' })
        .select('id, apn');
      if (upsertErr) throw new Error(`Spine upsert failed: ${upsertErr.message}`);

      const idByApn = new Map<string, string>();
      for (const row of upserted ?? []) {
        if (row.apn) idByApn.set(row.apn, row.id);
      }

      // We can't cheaply distinguish ingest vs update from upsert results —
      // Supabase returns the row either way. We approximate by checking
      // whether the row had a created_at within the last few seconds, but
      // that's fragile. Simpler: count all as ingested on first run, and
      // operators can re-check via property_data_ingests. For now, treat
      // every flush as `ingested` and let updated stay at 0. We can improve
      // counting after we see a real run.
      totalIngested += spineRows.length;

      // Step 2: clear existing layers from this source for these
      // properties, then insert fresh parcel_basics rows.
      const propertyIds = Array.from(idByApn.values());
      if (propertyIds.length > 0) {
        await supabaseAdmin
          .from('property_layers')
          .delete()
          .in('property_id', propertyIds)
          .eq('source_id', KINGS_COUNTY_SHAPEFILE.id);

        const layerRows = queue
          .map(q => {
            const pid = q.apn ? idByApn.get(q.apn) : null;
            if (!pid) return null;
            return {
              property_id: pid,
              layer_type: 'parcel_basics' as const,
              source_id: KINGS_COUNTY_SHAPEFILE.id,
              attrs: q.basics,
              acquired_at: new Date().toISOString(),
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (layerRows.length > 0) {
          const { error: layerErr } = await supabaseAdmin
            .from('property_layers')
            .insert(layerRows);
          if (layerErr) throw new Error(`Layer insert failed: ${layerErr.message}`);
        }
      }

      queue = [];
    };

    // Main read loop.
    while (true) {
      const result = await source.read();
      if (result.done) break;
      const feature = result.value;
      if (!feature || !feature.properties) continue;

      const props = feature.properties;
      const apn = s(props, 'APN');
      if (!apn) continue; // can't dedupe without an APN; skip
      const latlng = pickLatLng(props);
      // Allow apn-only rows in the spine (we just won't render them on the
      // map, but they're queryable by APN search later).
      const basics = buildParcelBasics(props);
      const spineRow: Record<string, unknown> = {
        apn,
        fips_county_code: '06031', // Kings County, CA
        address: pickAddress(props),
        city: s(props, 'Community'),
        state: 'CA',
        zip: null,
        lat: latlng?.lat ?? null,
        lng: latlng?.lng ?? null,
        property_type: s(props, 'LandUseCod'),
        lot_sqft: n(props, 'LandSqFt'),
        building_sqft: n(props, 'BuildingSi'),
        bedrooms: (() => {
          const v = s(props, 'BedRooms');
          if (!v) return null;
          const parsed = parseInt(v, 10);
          return Number.isFinite(parsed) ? parsed : null;
        })(),
        bathrooms: n(props, 'BathRooms'),
        year_built: (() => {
          const v = s(props, 'YearBuilt');
          if (!v) return null;
          const parsed = parseInt(v, 10);
          return Number.isFinite(parsed) && parsed > 1700 && parsed < 2100 ? parsed : null;
        })(),
        assessee_name: s(props, 'AssesseeNa'),
        spine_source: KINGS_COUNTY_SHAPEFILE.id,
        spine_acquired_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queue.push({ apn, row: spineRow, basics });
      read++;
      if (queue.length >= BATCH_SIZE) {
        await flush();
        onProgress?.(read);
      }
    }

    if (queue.length > 0) {
      await flush();
      onProgress?.(read);
    }

    return { recordsIngested: totalIngested, recordsUpdated: totalUpdated };
  },
};
