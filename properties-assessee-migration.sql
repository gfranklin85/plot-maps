-- Phase D2 (Kings County prep): add assessee_name to the properties spine.
--
-- The assessee_name is the owner-of-record from public county assessor
-- records. It's *not* contact data — there's no phone or email here, just
-- the name on the deed as filed with the county. Public information; safe
-- to display.
--
-- Storing on the spine for fast joins. Full provenance still lives in
-- property_layers.parcel_basics.attrs.assessee_name so audits can trace
-- which ingest contributed which row.
--
-- Safe to run multiple times.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS assessee_name text;

CREATE INDEX IF NOT EXISTS idx_properties_assessee_name
  ON properties(lower(assessee_name))
  WHERE assessee_name IS NOT NULL;
