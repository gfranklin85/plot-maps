-- Private beta gate. Closes the app to anyone not explicitly whitelisted.
--
-- Three additions:
--   1. profiles.beta_access boolean — the whitelist flag. Default false
--      so new accounts created any time after this migration land in
--      "waitlist" state until an admin flips them on.
--   2. waitlist table — collects email + optional note from people who
--      tried to sign up after the gate closed, so we have a list to
--      come back to when we open the doors.
--   3. Auto-grant trigger — anyone with is_admin = true automatically
--      has beta_access = true on every read path (the middleware can
--      check either flag). Belt-and-suspenders: even if an admin's
--      profile somehow has beta_access = false, they get through.
--
-- Safe to run multiple times (IF NOT EXISTS everywhere).

-- ── 1. beta_access column ────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS beta_access boolean NOT NULL DEFAULT false;

-- Index for quick allowlist queries (cardinality starts small).
CREATE INDEX IF NOT EXISTS idx_profiles_beta_access
  ON profiles (beta_access)
  WHERE beta_access = true;

-- Auto-grant beta_access to admins on every profile insert/update.
-- This means an admin can't accidentally be locked out of their own
-- app — flipping is_admin always implies beta access.
CREATE OR REPLACE FUNCTION sync_admin_to_beta_access()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_admin = true THEN
    NEW.beta_access := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_admin_to_beta_access ON profiles;
CREATE TRIGGER trg_sync_admin_to_beta_access
  BEFORE INSERT OR UPDATE OF is_admin ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_admin_to_beta_access();

-- Backfill: anyone already marked admin gets beta_access now.
UPDATE profiles SET beta_access = true WHERE is_admin = true;

-- ── 2. Server-side guard: only admins can write beta_access ─────────
-- Same shape as the enable_3d_tiles_admin guard. Client-side UI hides
-- the toggle from non-admins; this trigger enforces the rule at the
-- database in case a tampered client tries to slip through.
CREATE OR REPLACE FUNCTION enforce_beta_access_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.beta_access IS NOT DISTINCT FROM OLD.beta_access THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admin users can change beta_access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_beta_access_write ON profiles;
CREATE TRIGGER trg_enforce_beta_access_write
  BEFORE UPDATE OF beta_access ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_beta_access_write();

-- ── 3. Waitlist table ───────────────────────────────────────────────
-- Anyone who hits the signup page after the gate closes can leave their
-- email. Admin reviews and flips them on when ready.
CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  invited_at timestamptz,
  invited_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_invited_at
  ON waitlist (invited_at)
  WHERE invited_at IS NULL;

-- RLS: anyone (anon included) can INSERT into waitlist. SELECT/UPDATE
-- restricted to admins via service-role API routes.
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waitlist_anon_insert ON waitlist;
CREATE POLICY waitlist_anon_insert ON waitlist
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS waitlist_admin_select ON waitlist;
CREATE POLICY waitlist_admin_select ON waitlist
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS waitlist_admin_update ON waitlist;
CREATE POLICY waitlist_admin_update ON waitlist
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
