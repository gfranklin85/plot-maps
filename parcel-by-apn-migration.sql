-- parcel-by-apn-migration.sql
--
-- Adds parcel_geom_by_apn(apn text) RPC for the selected-property
-- highlight layer. Returns the single parcel's polygon as GeoJSON.
-- Locked 2026-05-30 evening. Used by /api/parcels/by-apn which feeds
-- PlotPropertyHighlight (gmp-polygon-3d-interactive over the lot).
--
-- Run once against the production Supabase database. Idempotent (CREATE
-- OR REPLACE).

CREATE OR REPLACE FUNCTION parcel_geom_by_apn(apn_in text)
RETURNS TABLE (
  id uuid,
  apn text,
  geom_json text,
  address text,
  city text
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
    p.city
  FROM properties p
  WHERE p.apn = apn_in
    AND p.geom IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION parcel_geom_by_apn(text)
  TO service_role, authenticated, anon;
