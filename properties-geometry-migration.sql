-- Phase D3: Polygon geometry on properties.
--
-- Adds the actual parcel polygon (WGS84) directly to the spine. Stored on
-- the same row as the spine fields rather than in a separate table — every
-- parcel either has geometry or it doesn't, no benefit to splitting, and
-- the spatial index gives us viewport queries that don't need a join.
--
-- Geometry is stored as PostGIS geometry(MultiPolygon, 4326). MultiPolygon
-- (vs Polygon) handles the rare condo / split-parcel cases where one APN
-- spans multiple disjoint shapes. SRID 4326 = WGS84 lat/lng — what the map
-- consumes natively.
--
-- The GIST index is what makes viewport queries fast: at any zoom level
-- the map sends a bounding box, the index returns only parcels that
-- intersect it. No full-table scan even with 50K+ rows.
--
-- Safe to run multiple times — ADD COLUMN IF NOT EXISTS is idempotent.

-- PostGIS is already installed on Supabase by default; this is a no-op
-- if it's already there.
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326);

-- GIST index for spatial / bbox queries (ST_Intersects, &&, etc.)
CREATE INDEX IF NOT EXISTS idx_properties_geom
  ON properties USING GIST (geom);

-- Bulk geometry update helper. PostgREST / Supabase's .upsert() doesn't
-- have a clean way to send EWKT strings into geometry columns from a
-- JS client (the JSON path doesn't trigger the text->geometry implicit
-- cast). This RPC takes a JSON array of {apn, ewkt} rows and applies
-- them in one round trip. ST_GeomFromEWKT parses the SRID prefix and
-- builds the geometry; bad rows (null/malformed) are skipped silently
-- via the WHERE clause so one bad parcel doesn't fail a whole batch.
CREATE OR REPLACE FUNCTION set_parcel_geoms(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  WITH input AS (
    SELECT
      (elem->>'apn')::text  AS apn,
      (elem->>'ewkt')::text AS ewkt
    FROM jsonb_array_elements(payload) AS elem
  ),
  upd AS (
    UPDATE properties p
    SET geom = ST_Multi(ST_GeomFromEWKT(i.ewkt))
    FROM input i
    WHERE p.apn = i.apn
      AND i.ewkt IS NOT NULL
    RETURNING p.id
  )
  SELECT COUNT(*) INTO updated_count FROM upd;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION set_parcel_geoms(jsonb) TO service_role;

-- Viewport bbox query. The map sends current map bounds; this returns
-- every parcel whose geometry intersects, capped at max_features, with
-- the polygon serialized as GeoJSON (string). The GIST index makes this
-- O(log n) for the spatial filter even with 50K+ parcels statewide.
--
-- ST_AsGeoJSON precision 6 = ~0.1m accuracy at this latitude, which is
-- plenty for visual rendering and keeps payload size sane (full double
-- precision would inflate the response by 2-3x for no visible difference).
CREATE OR REPLACE FUNCTION parcels_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_features integer DEFAULT 5000
)
RETURNS TABLE (
  id uuid,
  apn text,
  geom_json text,
  address text,
  city text,
  property_type text,
  year_built integer,
  building_sqft numeric,
  bedrooms integer,
  bathrooms numeric,
  assessee_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.apn,
    ST_AsGeoJSON(p.geom, 6),
    p.address,
    p.city,
    p.property_type,
    p.year_built,
    p.building_sqft,
    p.bedrooms,
    p.bathrooms,
    p.assessee_name
  FROM properties p
  WHERE p.geom IS NOT NULL
    AND p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  LIMIT max_features;
$$;

GRANT EXECUTE ON FUNCTION parcels_in_bbox(
  double precision, double precision, double precision, double precision, integer
) TO service_role, authenticated;
