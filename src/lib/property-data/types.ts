// Phase D1: Plot-owned property data layer
//
// Types shared by the adapter pattern and the resolver. Adding a new
// source = implementing PropertyDataSource. Adding a new layer kind =
// extending the unions here + documenting the attrs shape inline.

export type PropertyLayerType =
  | 'zoning'
  | 'general_plan'
  | 'subdivision'
  | 'site_plan'
  | 'parcel_basics'
  | 'sale'
  | 'permit';

export type SourceKind =
  | 'arcgis_live'
  | 'arcgis_snapshot'
  | 'regrid_bulk'
  | 'csv_import';

// Each layer type carries its own attrs shape. We document the shape
// here as a discriminated union so the resolver and the UI can pick
// fields without crawling jsonb at the call site.

export interface ZoningAttrs {
  code: string | null;          // e.g. 'R-1'
  description: string | null;   // e.g. 'Single Family Residential'
  overlayDistrict?: string | null;
  hyperlink?: string | null;    // URL to the zoning code section
}

export interface GeneralPlanAttrs {
  code: string | null;          // e.g. 'LDR'
  description: string | null;   // e.g. 'Low Density Residential'
  hyperlink?: string | null;
}

export interface SubdivisionAttrs {
  name: string | null;
  tract: string | null;
  applicant: string | null;
  units: string | null;
  status: string | null;
}

export interface SitePlanAttrs {
  projectNumber: string | null;
  title: string | null;
  applicant: string | null;
  units: string | null;
  status: string | null;
}

export interface ParcelBasicsAttrs {
  apn?: string | null;
  acres?: number | null;
  use?: string | null;          // current use code/description from county
  development?: string | null;  // current development status
  codeHyperlink?: string | null;
  // ── County assessor extensions (Kings County etc) ─────────────────
  // All public-record fields. No contact data here.
  assesseeName?: string | null;
  landUseCode?: string | null;
  zoningCode?: string | null;   // assessor's zoning code (may differ from
                                // municipal zoning layer)
  taxabilityFull?: string | null;
  tra?: string | null;          // tax rate area
  netValue?: number | null;
  landValue?: number | null;
  structureValue?: number | null;
  community?: string | null;    // community/city per assessor
  mailingAddress1?: string | null;
  mailingAddress2?: string | null;
  mailingAddress3?: string | null;
  mailingAddress4?: string | null;
  situsAddress1?: string | null;
  situsAddress2?: string | null;
  // Structure fields
  yearBuilt?: string | number | null;
  effectiveYear?: string | number | null;
  buildingType?: string | null;
  buildingSize?: number | null;
  buildingUsedFor?: string | null;
  storiesCount?: string | number | null;
  unitsCount?: string | number | null;
  condition?: string | null;
  qualityClass?: string | null;
  bedrooms?: string | number | null;
  bathrooms?: string | number | null;
  halfBaths?: string | number | null;
  construction?: string | null;
  foundation?: string | null;
  exteriorType?: string | null;
  roofCover?: string | null;
  heating?: string | null;
  coolingCentral?: string | null;
  fireplace?: string | null;
  garage?: string | null;
  attachGarageSqft?: number | null;
  detachGarageSqft?: number | null;
  poolSpa?: string | null;
  solar?: string | null;
  hasWell?: string | null;
  hasOrchard?: string | null;
  hasVineyard?: string | null;
  subdivisionName?: string | null;
  // Agricultural
  homesiteAcres?: string | number | null;
  growingAcres?: string | number | null;
  primeAcres?: string | number | null;
  openSpaceAcres?: string | number | null;
  urbanAcres?: string | number | null;
  // Misc
  neighborhoodCode?: string | null;
  waterSource?: string | null;
  sewerCode?: string | null;
}

// One fact-contribution returned by a source for a single point.
// Combined into a ResolvedProperty by the resolver.
export interface PropertyDataContribution {
  layerType: PropertyLayerType;
  attrs:
    | ZoningAttrs
    | GeneralPlanAttrs
    | SubdivisionAttrs
    | SitePlanAttrs
    | ParcelBasicsAttrs
    | Record<string, unknown>; // forward-compat for layers we add later
  effective_at?: string;
  source_url?: string;
}

export interface PropertyDataSource {
  id: string;
  description: string;
  kind: SourceKind;
  licenseReference: string;
  contributes: PropertyLayerType[];
  /**
   * Pull data for a single point. Returns contributions for that point,
   * or null if the point is outside this source's coverage. The resolver
   * decides whether to call this (DB miss / no-coverage / stale).
   */
  queryPoint(lat: number, lng: number): Promise<PropertyDataContribution[] | null>;
  /**
   * Optional bulk-snapshot. Pulls everything this source has and writes
   * to properties + property_layers, logging one row to
   * property_data_ingests. Implemented by sources that support it (e.g.
   * arcgis_snapshot, regrid_bulk). queryPoint-only sources don't define
   * this.
   */
  snapshot?(opts: SnapshotOpts): Promise<SnapshotResult>;
}

export interface SnapshotOpts {
  ingestId: string;
  onProgress?: (n: number) => void;
}

export interface SnapshotResult {
  recordsIngested: number;
  recordsUpdated: number;
}

// What the resolver returns to the route — the shape PropertyPopup
// expects. Stable across sources; resolver flattens contributions into
// this view. Assessor extensions (assesseeName, yearBuilt, bedrooms,
// etc.) are surfaced when a richer source like Kings County contributes
// them; older sources just leave them null.
export interface ResolvedProperty {
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
  subdivision: SubdivisionAttrs | null;
  sitePlan: SitePlanAttrs | null;
  hyperlinks: {
    generalPlan: string | null;
    zoning: string | null;
    code: string | null;
  };
  // Assessor extensions — populated when a county-data source contributes
  // them via parcel_basics. Optional on the popup side. Names mirror the
  // ParcelBasicsAttrs shape so the resolver fold is mechanical.
  assesseeName: string | null;
  // Owner mailing address (where the tax bill goes). When mailing !=
  // situs, the parcel is owned by someone who doesn't live there — the
  // popup surfaces an "absentee" badge for Pro users.
  mailingAddress1: string | null;
  mailingAddress2: string | null;
  mailingAddress3: string | null;
  mailingAddress4: string | null;
  // Structure
  yearBuilt: string | number | null;
  effectiveYear: string | number | null;
  buildingSize: number | null;
  buildingType: string | null;
  buildingUsedFor: string | null;
  storiesCount: string | number | null;
  unitsCount: string | number | null;
  bedrooms: string | number | null;
  bathrooms: string | number | null;
  halfBaths: string | number | null;
  condition: string | null;
  qualityClass: string | null;
  construction: string | null;
  foundation: string | null;
  exteriorType: string | null;
  roofCover: string | null;
  // Mechanical / amenities
  heating: string | null;
  coolingCentral: string | null;
  fireplace: string | null;
  garage: string | null;
  attachGarageSqft: number | null;
  detachGarageSqft: number | null;
  poolSpa: string | null;
  solar: string | null;
  // Land / agricultural
  hasWell: string | null;
  hasOrchard: string | null;
  hasVineyard: string | null;
  homesiteAcres: string | number | null;
  growingAcres: string | number | null;
  primeAcres: string | number | null;
  openSpaceAcres: string | number | null;
  urbanAcres: string | number | null;
  // Utility / infrastructure
  waterSource: string | null;
  sewerCode: string | null;
  // Valuation breakdown
  landValue: number | null;
  structureValue: number | null;
  netValue: number | null;
  tra: string | null;
  taxabilityFull: string | null;
  // Subdivision per assessor (separate from municipal subdivision pipeline)
  subdivisionName: string | null;
  raw: Record<string, unknown>;
}

export function emptyResolvedProperty(): ResolvedProperty {
  return {
    hit: false,
    apn: null,
    address: null,
    zoningCode: null,
    zoningDesc: null,
    generalPlanCode: null,
    generalPlanDesc: null,
    acres: null,
    use2024: null,
    development2024: null,
    subdivision: null,
    sitePlan: null,
    hyperlinks: { generalPlan: null, zoning: null, code: null },
    assesseeName: null,
    mailingAddress1: null,
    mailingAddress2: null,
    mailingAddress3: null,
    mailingAddress4: null,
    yearBuilt: null,
    effectiveYear: null,
    buildingSize: null,
    buildingType: null,
    buildingUsedFor: null,
    storiesCount: null,
    unitsCount: null,
    bedrooms: null,
    bathrooms: null,
    halfBaths: null,
    condition: null,
    qualityClass: null,
    construction: null,
    foundation: null,
    exteriorType: null,
    roofCover: null,
    heating: null,
    coolingCentral: null,
    fireplace: null,
    garage: null,
    attachGarageSqft: null,
    detachGarageSqft: null,
    poolSpa: null,
    solar: null,
    hasWell: null,
    hasOrchard: null,
    hasVineyard: null,
    homesiteAcres: null,
    growingAcres: null,
    primeAcres: null,
    openSpaceAcres: null,
    urbanAcres: null,
    waterSource: null,
    sewerCode: null,
    landValue: null,
    structureValue: null,
    netValue: null,
    tra: null,
    taxabilityFull: null,
    subdivisionName: null,
    raw: {},
  };
}
