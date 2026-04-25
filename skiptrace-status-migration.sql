-- Skiptrace status tracking
-- Adds a status column on leads so the UI can render in-progress / completed
-- / not-found states for skiptrace orders. Drives the pulsing pin animation,
-- the popup state, and the realtime update flow.
-- Safe to run multiple times.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS skiptrace_status text;

-- Constrain values via a check (drop existing first so re-runs don't fail)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_skiptrace_status_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_skiptrace_status_check
  CHECK (skiptrace_status IS NULL OR skiptrace_status IN ('pending', 'completed', 'not_found', 'failed'));

-- Partial index — only the small set of pending rows will be indexed,
-- which is what the UI / backfill polls for.
CREATE INDEX IF NOT EXISTS idx_leads_skiptrace_pending
  ON leads (user_id)
  WHERE skiptrace_status = 'pending';
