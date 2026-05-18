-- Rename mail-provider webhook events table + column to be provider-neutral.
--
-- Background: this table was created during the Lob era as
-- `lob_webhook_events` with a `lob_event_id` column. We've since
-- ripped out Lob and switched to PostGrid, but the schema still
-- carries the vendor name. This migration neutralizes the naming
-- so the table honestly represents what it holds: webhook events
-- from whatever mail provider Plot is using.
--
-- Safe to run multiple times (IF EXISTS / IF NOT EXISTS guards).
-- Skipped silently if the rename was already applied.

DO $$
BEGIN
  -- Rename the table if the old name still exists.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'lob_webhook_events') THEN
    ALTER TABLE lob_webhook_events RENAME TO mail_provider_webhook_events;
  END IF;

  -- Rename the column if the old name still exists.
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'mail_provider_webhook_events'
               AND column_name = 'lob_event_id') THEN
    ALTER TABLE mail_provider_webhook_events
      RENAME COLUMN lob_event_id TO provider_event_id;
  END IF;
END $$;

-- Rebuild indexes with new names (Postgres doesn't auto-rename them).
-- Old indexes (created in lob-webhook-events-migration.sql):
--   lob_webhook_events_resource_id_idx
--   lob_webhook_events_inquiry_id_idx
--   lob_webhook_events_invalid_sig_idx
-- After table rename, indexes still reference correct columns but
-- have stale names that include "lob". Drop + recreate with neutral names.

DROP INDEX IF EXISTS lob_webhook_events_resource_id_idx;
DROP INDEX IF EXISTS lob_webhook_events_inquiry_id_idx;
DROP INDEX IF EXISTS lob_webhook_events_invalid_sig_idx;

CREATE INDEX IF NOT EXISTS mail_provider_webhook_events_resource_id_idx
  ON mail_provider_webhook_events (resource_id)
  WHERE resource_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mail_provider_webhook_events_inquiry_id_idx
  ON mail_provider_webhook_events (inquiry_id, received_at DESC)
  WHERE inquiry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mail_provider_webhook_events_invalid_sig_idx
  ON mail_provider_webhook_events (received_at DESC)
  WHERE signature_valid = false;

-- Refresh comments to match the new naming + reflect PostGrid as the
-- current provider.

COMMENT ON TABLE mail_provider_webhook_events IS
  'Immutable audit log of mail-provider webhook deliveries (currently PostGrid). Append-only. Service role only.';

COMMENT ON COLUMN mail_provider_webhook_events.provider_event_id IS
  'The provider''s unique event id (PostGrid: evt_*). Used as the idempotency key — UNIQUE constraint prevents double-processing of retried webhook deliveries.';

COMMENT ON COLUMN mail_provider_webhook_events.signature_valid IS
  'False if HMAC did not match the expected signature. We still insert the row so we can detect spoofing attempts and signing-secret misconfiguration after the fact.';
