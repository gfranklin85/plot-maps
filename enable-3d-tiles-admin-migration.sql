-- Admin-only gate for the Photorealistic 3D Tiles map renderer.
--
-- Flipping this column to true on a profile routes that user into the
-- Map3DElement (gmp-map-3d) surface instead of the standard Maps JS
-- API. Photorealistic 3D Tiles are billed per session against the
-- Google Cloud project, so this is gated to admins for cost-controlled
-- exploration before any user-facing tier model is decided.
--
-- Default false. Set to true via SQL editor for admin users:
--   UPDATE profiles SET enable_3d_tiles_admin = true WHERE email = '...';
--
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS enable_3d_tiles_admin boolean NOT NULL DEFAULT false;

-- Optional convenience: index on the flag so admin-gated queries stay
-- fast even at scale. Cardinality is tiny (basically just Greg) but
-- the index is cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_enable_3d_tiles_admin
  ON profiles (enable_3d_tiles_admin)
  WHERE enable_3d_tiles_admin = true;
