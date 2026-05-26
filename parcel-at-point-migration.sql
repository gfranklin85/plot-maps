-- ── Point-in-polygon parcel lookup ──────────────────────────────────────
--
-- Selection on the 3D map needs to answer "what parcel is at this exact
-- lat/lng?" given Map3D's gmp-click events (which give us the click
-- position directly) and the gamepad reticle's ray-cast (which gives us
-- a ground-intercept lat/lng). True point-in-polygon, not nearest-
-- centroid — the click should resolve to the parcel that geometrically
-- CONTAINS the point, even when it's right next to an adjacent parcel.
--
-- The properties.geom GIST index (created in properties-geometry-migration.sql)
-- makes ST_Contains O(log n) here: the bbox prefilter narrows the
-- candidate set to ~1 parcel before the precise containment check runs.
--
-- Returns NULL if the point isn't inside any parcel (e.g. road, water,
-- parking lot, outside the parcel coverage area). Callers should
-- handle null gracefully — clicking empty ground is a valid no-op.
--
-- Single-row return; if a point lands on a boundary shared by two
-- parcels, LIMIT 1 picks deterministically. Plot's assessor data does
-- not produce overlapping parcels in practice, so this is fine.

CREATE OR REPLACE FUNCTION parcel_at_point(
  lng double precision,
  lat double precision
)
RETURNS TABLE (
  id uuid,
  apn text,
  address text,
  city text,
  area_sqm double precision,
  n_points integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- area_sqm + n_points are diagnostic (added 2026-05-26 to chase the
  -- "all clicks resolve to 2000 Leoni Dr" bug). A real residential lot
  -- in Kings County is ~500-3000 sqm and ~5-30 polygon vertices.
  -- If a parcel comes back with area > 50,000 sqm or n_points > 200
  -- its geometry was ingested wrong and overlaps neighbors.
  SELECT
    p.id,
    p.apn,
    p.address,
    p.city,
    ST_Area(p.geom::geography)::double precision AS area_sqm,
    ST_NPoints(p.geom)::integer AS n_points
  FROM properties p
  WHERE p.geom IS NOT NULL
    AND p.geom && ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION parcel_at_point(double precision, double precision)
  TO service_role, authenticated;
