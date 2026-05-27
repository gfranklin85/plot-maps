-- ── Plot Address Layer — national clickable addresses ──────────────
--
-- Every US address as a clickable Plot entity. Ingested from
-- OpenAddresses (federally derived, CC0/ODbL). Source of truth for
-- "what's on the ground anywhere in the country."
--
-- Workflow target: click address → skip-trace runs against the address
-- string → owner returned → ammo debited. Same address → Postgrid →
-- postcard mailed. Same address → Batchdata → lead enrichment. All of
-- those tools take address strings, not polygons, so points are enough.
--
-- Polygons are deliberately NOT included — that's a Tier 1 enrichment
-- handled by the existing properties table (county-by-county parcel
-- ingest, Kings done, others later).

CREATE TABLE IF NOT EXISTS addresses (
  id BIGSERIAL PRIMARY KEY,
  -- Parsed components (always present from OpenAddresses normalization).
  street_number TEXT,
  street_name   TEXT,
  unit          TEXT,
  city          TEXT,
  state         TEXT,
  zip           TEXT,
  county        TEXT,
  -- The single rendered string used for skip-trace + mail + display.
  -- Pre-computed at ingest so reads are zero-effort.
  full_address  TEXT NOT NULL,
  -- WGS84 point. The ONLY geometry — no polygons here on purpose.
  geom          GEOMETRY(POINT, 4326) NOT NULL,
  -- Provenance for de-dup + re-ingest later.
  source        TEXT NOT NULL,
  source_id     TEXT,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIST on geom: viewport bbox queries are O(log n) instead of O(n).
-- Required for the "load addresses in current camera view" RPC to
-- stay fast at 165M rows.
CREATE INDEX IF NOT EXISTS addresses_geom_idx
  ON addresses USING GIST (geom);

-- Common filters for search by area.
CREATE INDEX IF NOT EXISTS addresses_zip_idx
  ON addresses (zip);
CREATE INDEX IF NOT EXISTS addresses_city_state_idx
  ON addresses (city, state);

-- De-dup so re-running ingest is idempotent. Same source + source_id
-- means we already have this row; INSERT ... ON CONFLICT DO NOTHING
-- in the ingest script makes incremental imports safe.
CREATE UNIQUE INDEX IF NOT EXISTS addresses_source_dedup
  ON addresses (source, source_id);

-- ── RPC: bbox query for the marker layer ────────────────────────────
-- Returns the N closest-to-bbox-center addresses inside a bounding box.
-- N caps the result so dense areas don't melt the renderer (the
-- AddressMarkerLayer component asks for <=300 markers and culls by
-- altitude before calling this).

CREATE OR REPLACE FUNCTION addresses_in_bbox(
  west  double precision,
  south double precision,
  east  double precision,
  north double precision,
  max_results integer DEFAULT 300
)
RETURNS TABLE (
  id            bigint,
  street_number text,
  street_name   text,
  full_address  text,
  lat           double precision,
  lng           double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH bbox AS (
    SELECT ST_MakeEnvelope(west, south, east, north, 4326) AS env,
           ST_SetSRID(
             ST_MakePoint((west + east) / 2.0, (south + north) / 2.0),
             4326
           ) AS center
  )
  SELECT
    a.id,
    a.street_number,
    a.street_name,
    a.full_address,
    ST_Y(a.geom)::double precision AS lat,
    ST_X(a.geom)::double precision AS lng
  FROM addresses a, bbox
  WHERE a.geom && bbox.env
  ORDER BY a.geom <-> bbox.center
  LIMIT max_results;
$$;

GRANT EXECUTE ON FUNCTION
  addresses_in_bbox(double precision, double precision, double precision, double precision, integer)
  TO service_role, authenticated;

-- ── RPC: closest-address lookup for click resolution ────────────────
-- The unified A-press click resolver calls this with the cursor's
-- ground lat/lng. Returns the single closest address inside the
-- radius, or null if nothing nearby.

CREATE OR REPLACE FUNCTION address_at_point(
  lng       double precision,
  lat       double precision,
  radius_m  double precision DEFAULT 30
)
RETURNS TABLE (
  id            bigint,
  street_number text,
  street_name   text,
  full_address  text,
  city          text,
  state         text,
  zip           text,
  hit_lat       double precision,
  hit_lng       double precision,
  distance_m    double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH p AS (
    SELECT ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography AS pt
  )
  SELECT
    a.id,
    a.street_number,
    a.street_name,
    a.full_address,
    a.city,
    a.state,
    a.zip,
    ST_Y(a.geom)::double precision AS hit_lat,
    ST_X(a.geom)::double precision AS hit_lng,
    ST_Distance(a.geom::geography, p.pt)::double precision AS distance_m
  FROM addresses a, p
  WHERE ST_DWithin(a.geom::geography, p.pt, radius_m)
  ORDER BY a.geom <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION
  address_at_point(double precision, double precision, double precision)
  TO service_role, authenticated;
