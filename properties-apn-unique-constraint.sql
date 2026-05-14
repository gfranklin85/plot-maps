-- Phase D2 follow-up: promote the APN partial unique index to a true
-- unique constraint.
--
-- The original properties-migration.sql created:
--   CREATE UNIQUE INDEX idx_properties_apn ON properties(apn) WHERE apn IS NOT NULL;
--
-- That partial index works fine for read-side uniqueness, but Supabase's
-- .upsert({ onConflict: 'apn' }) requires a real UNIQUE constraint to
-- target — Postgres rejects ON CONFLICT against a partial index unless
-- the upsert itself supplies a matching WHERE clause, which the JS
-- client doesn't expose.
--
-- Replacing the partial index with a UNIQUE constraint:
--   - keeps APN-having rows unique (same as before)
--   - allows multiple NULL APN rows (Postgres treats NULLs as distinct
--     in unique constraints by default — same behavior as the partial
--     index gave us)
--   - lets the Kings County snapshot run a normal upsert
--
-- Run after properties-migration.sql and properties-assessee-migration.sql.

DROP INDEX IF EXISTS idx_properties_apn;

ALTER TABLE properties
  ADD CONSTRAINT properties_apn_unique UNIQUE (apn);
