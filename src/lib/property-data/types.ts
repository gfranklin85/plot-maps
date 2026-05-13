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
// this view.
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
    raw: {},
  };
}
