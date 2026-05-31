-- Monument anchor per parcel
--
-- Every parcel gets a pre-computed "backyard" lat/lng where its Plot
-- monument rises out of the ground when selected. The monument is a
-- property OF the parcel (lives in the data), not something spawned at
-- click time — the world is always populated; selection just lifts the
-- curtain. Greg locked 2026-05-30 evening: "each place has its hidden
-- huge slab monument below ready to rise."
--
-- "Backyard" definition: parcel centroid + offset toward the midpoint of
-- the polygon's LONGEST EDGE. The longest edge is almost always the
-- back lot line (opposite the street frontage). Distance from centroid:
-- 40% of the radius from centroid → longest-edge midpoint, so the
-- monument lands solidly inside the back third of the lot without
-- touching the property line. Works cleanly for ~95% of typical
-- residential lots. Corner / flag / irregular parcels: the same math
-- still produces a stable in-polygon point (clamped via ST_ClosestPoint
-- if the offset would go outside the polygon).
--
-- Safe to run multiple times — ADD COLUMN IF NOT EXISTS + CREATE OR
-- REPLACE FUNCTION.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS monument_lat double precision,
  ADD COLUMN IF NOT EXISTS monument_lng double precision;

-- Pure-SQL helper to compute one parcel's monument anchor from its geom.
-- Returns NULL if the geom is null, empty, or degenerate.
CREATE OR REPLACE FUNCTION compute_monument_anchor(g geometry)
RETURNS geometry
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  centroid geometry;
  ring geometry;
  npts integer;
  longest_idx integer := 1;
  longest_len double precision := 0;
  i integer;
  a geometry;
  b geometry;
  seg_len double precision;
  mid_lng double precision;
  mid_lat double precision;
  offset_lng double precision;
  offset_lat double precision;
  anchor geometry;
BEGIN
  IF g IS NULL OR ST_IsEmpty(g) THEN
    RETURN NULL;
  END IF;

  -- Centroid of the parcel (works for Polygon + MultiPolygon)
  centroid := ST_Centroid(g);

  -- Exterior ring of the LARGEST sub-polygon if MultiPolygon; for a
  -- single Polygon this is just its exterior ring.
  IF GeometryType(g) = 'MULTIPOLYGON' THEN
    ring := ST_ExteriorRing((
      SELECT geom FROM (
        SELECT (ST_Dump(g)).geom
      ) sub
      ORDER BY ST_Area(geom) DESC
      LIMIT 1
    ));
  ELSE
    ring := ST_ExteriorRing(g);
  END IF;

  IF ring IS NULL THEN
    RETURN centroid;  -- fall back to centroid; better than nothing
  END IF;

  npts := ST_NPoints(ring);
  IF npts < 4 THEN
    RETURN centroid;  -- triangle or degenerate — centroid is fine
  END IF;

  -- Find the longest edge (segment) of the exterior ring. The last
  -- point repeats the first (closed ring), so we walk 1..npts-1.
  FOR i IN 1..(npts - 1) LOOP
    a := ST_PointN(ring, i);
    b := ST_PointN(ring, i + 1);
    seg_len := ST_Distance(a::geography, b::geography);
    IF seg_len > longest_len THEN
      longest_len := seg_len;
      longest_idx := i;
    END IF;
  END LOOP;

  -- Midpoint of the longest edge
  a := ST_PointN(ring, longest_idx);
  b := ST_PointN(ring, longest_idx + 1);
  mid_lng := (ST_X(a) + ST_X(b)) / 2.0;
  mid_lat := (ST_Y(a) + ST_Y(b)) / 2.0;

  -- Anchor = centroid offset 40% of the way toward longest-edge midpoint
  offset_lng := ST_X(centroid) + (mid_lng - ST_X(centroid)) * 0.40;
  offset_lat := ST_Y(centroid) + (mid_lat - ST_Y(centroid)) * 0.40;
  anchor := ST_SetSRID(ST_MakePoint(offset_lng, offset_lat), 4326);

  -- Safety: if our anchor somehow landed outside the polygon (irregular
  -- shape, narrow flag lot), snap it back to the closest interior point.
  IF NOT ST_Contains(g, anchor) THEN
    anchor := ST_ClosestPoint(g, anchor);
  END IF;

  RETURN anchor;
END;
$$;

-- One-shot backfill: populate monument_lat/lng for every parcel that
-- has a geom but no anchor yet. Idempotent — re-running only fills
-- new/changed rows.
UPDATE properties
SET
  monument_lng = ST_X(compute_monument_anchor(geom)),
  monument_lat = ST_Y(compute_monument_anchor(geom))
WHERE geom IS NOT NULL
  AND (monument_lat IS NULL OR monument_lng IS NULL);

-- Future ingest hook: trigger recomputes the anchor whenever geom
-- changes (INSERT or UPDATE). Keeps the column always in sync without
-- the ingest pipeline needing to know about it.
CREATE OR REPLACE FUNCTION refresh_monument_anchor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  anchor geometry;
BEGIN
  IF NEW.geom IS NULL THEN
    NEW.monument_lat := NULL;
    NEW.monument_lng := NULL;
    RETURN NEW;
  END IF;
  -- Skip recompute if geom unchanged on UPDATE
  IF TG_OP = 'UPDATE' AND OLD.geom IS NOT DISTINCT FROM NEW.geom THEN
    RETURN NEW;
  END IF;
  anchor := compute_monument_anchor(NEW.geom);
  IF anchor IS NULL THEN
    NEW.monument_lat := NULL;
    NEW.monument_lng := NULL;
  ELSE
    NEW.monument_lng := ST_X(anchor);
    NEW.monument_lat := ST_Y(anchor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_monument_anchor ON properties;
CREATE TRIGGER trg_refresh_monument_anchor
  BEFORE INSERT OR UPDATE OF geom ON properties
  FOR EACH ROW EXECUTE FUNCTION refresh_monument_anchor();

-- Update parcel_at_point + parcels_in_bbox to surface the anchor.
-- parcel_at_point returns it so a click on a parcel can mount the
-- monument at the stored anchor (NOT the click point). parcels_in_bbox
-- returns it so the viewport renderer can pre-mount every parcel's
-- monument (buried) in the camera radius.

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
  n_points integer,
  monument_lat double precision,
  monument_lng double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.apn,
    p.address,
    p.city,
    ST_Area(p.geom::geography)::double precision AS area_sqm,
    ST_NPoints(p.geom)::integer AS n_points,
    p.monument_lat,
    p.monument_lng
  FROM properties p
  WHERE p.geom IS NOT NULL
    AND p.geom && ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(lng, lat), 4326))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION parcel_at_point(double precision, double precision)
  TO service_role, authenticated;

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
  assessee_name text,
  monument_lat double precision,
  monument_lng double precision
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
    p.assessee_name,
    p.monument_lat,
    p.monument_lng
  FROM properties p
  WHERE p.geom IS NOT NULL
    AND p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  LIMIT max_features;
$$;

GRANT EXECUTE ON FUNCTION parcels_in_bbox(
  double precision, double precision, double precision, double precision, integer
) TO service_role, authenticated;

-- New: monument viewport query. Returns ONLY apn + monument coords for
-- every parcel in the camera radius. Tighter payload than parcels_in_bbox
-- (no geom_json, no property fields) — the renderer just needs to know
-- where to mount each buried monument glb.
CREATE OR REPLACE FUNCTION monuments_in_bbox(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision,
  max_features integer DEFAULT 1500
)
RETURNS TABLE (
  apn text,
  monument_lat double precision,
  monument_lng double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.apn,
    p.monument_lat,
    p.monument_lng
  FROM properties p
  WHERE p.geom IS NOT NULL
    AND p.monument_lat IS NOT NULL
    AND p.monument_lng IS NOT NULL
    AND p.geom && ST_MakeEnvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  LIMIT max_features;
$$;

GRANT EXECUTE ON FUNCTION monuments_in_bbox(
  double precision, double precision, double precision, double precision, integer
) TO service_role, authenticated;
