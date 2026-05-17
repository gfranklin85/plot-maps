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

-- ── Server-side guard: only admins can write enable_3d_tiles_admin ──
-- The UI in settings/page.tsx hides the toggle from non-admins, but
-- that's client-side. This trigger enforces the rule at the database
-- so a tampered client can't slip the flag on for a non-admin. Same
-- shape as a CHECK on UPDATE: if the new value differs from the old
-- AND the calling profile isn't admin, the write is rejected.
--
-- Service-role writes (server-to-server admin code, migrations, etc.)
-- still pass because they don't have an auth.uid().

CREATE OR REPLACE FUNCTION enforce_3d_tiles_admin_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- No-op when the value isn't changing.
  IF NEW.enable_3d_tiles_admin IS NOT DISTINCT FROM OLD.enable_3d_tiles_admin THEN
    RETURN NEW;
  END IF;
  -- Service-role / no-auth context: allow.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- The caller must themselves be an admin.
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admin users can change enable_3d_tiles_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_3d_tiles_admin_write ON profiles;
CREATE TRIGGER trg_enforce_3d_tiles_admin_write
  BEFORE UPDATE OF enable_3d_tiles_admin ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_3d_tiles_admin_write();
