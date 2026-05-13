-- Phase D1: Plot-owned property data layer
--
-- Three tables. `properties` is the spine (one row per real-world parcel).
-- `property_layers` is the flexible fact store (zoning/general-plan/
-- subdivision/site-plan/etc., one row per fact per source). `property_data_
-- ingests` is the audit log — every batch of data we ingest, where it came
-- from, license reference, count. This is what answers "where did this
-- record come from" at audit time.
--
-- Safe to run multiple times — every CREATE uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apn text,                          -- assessor parcel number (preferred ID)
  fips_county_code text,
  address text,
  city text,
  state text,
  zip text,
  lat numeric,
  lng numeric,
  property_type text,
  lot_sqft numeric,
  building_sqft numeric,
  bedrooms integer,
  bathrooms numeric,
  year_built integer,
  spine_source text,                 -- 'lemoore-gis:snapshot:2026-05', 'regrid:kings-ca:2026-05', etc.
  spine_acquired_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_apn ON properties(apn) WHERE apn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng ON properties(lat, lng);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city, state);

-- Each row is one fact about one parcel from one source. Adding a city
-- or a new layer type means inserting rows, not altering columns.
CREATE TABLE IF NOT EXISTS property_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  layer_type text NOT NULL,          -- 'zoning' | 'general_plan' | 'subdivision' | 'site_plan' | 'parcel_basics' | 'sale' | 'permit'
  source_id text NOT NULL,           -- 'lemoore-gis' | 'regrid-kings-2026-q1' | ...
  attrs jsonb NOT NULL,              -- shape defined per layer_type in TS, not in DB
  acquired_at timestamptz NOT NULL DEFAULT now(),
  source_url text,
  effective_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_player_property_layer ON property_layers(property_id, layer_type);
CREATE INDEX IF NOT EXISTS idx_player_source ON property_layers(source_id);

-- The audit receipt. Every batch ingest writes one row here. Any record
-- in property_layers traces back via source_id to a row here, which
-- carries the license_reference.
CREATE TABLE IF NOT EXISTS property_data_ingests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL,
  source_kind text NOT NULL,         -- 'arcgis_live' | 'arcgis_snapshot' | 'regrid_bulk' | 'csv_import'
  source_description text,
  records_ingested integer,
  records_updated integer,
  license_reference text,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ingests_source ON property_data_ingests(source_id, created_at DESC);

-- RLS — admin-only writes; reads are open to authenticated users (the
-- parcel popup serves data to whoever's signed in).
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_data_ingests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read properties" ON properties;
CREATE POLICY "Authenticated read properties" ON properties
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated read property_layers" ON property_layers;
CREATE POLICY "Authenticated read property_layers" ON property_layers
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin read property_data_ingests" ON property_data_ingests;
CREATE POLICY "Admin read property_data_ingests" ON property_data_ingests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Service role (used by supabaseAdmin in API routes) bypasses RLS, so
-- all snapshot writes / resolver write-backs go through that path.
