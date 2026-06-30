-- ── PostGrid direct-mail columns for property_inquiries ──────────────
-- The direct-mail send path (src/app/api/inquiry/send/route.ts) and the
-- PostGrid webhook (src/app/api/postgrid/webhook/route.ts) write these
-- columns, but they were never added to the table — so every direct-mail
-- send failed with "column does not exist". This adds them.
--
-- 2026-06-28. Safe + idempotent (IF NOT EXISTS). No data backfill needed.

ALTER TABLE property_inquiries
  ADD COLUMN IF NOT EXISTS mail_provider               text,
  ADD COLUMN IF NOT EXISTS mail_provider_status        text,
  ADD COLUMN IF NOT EXISTS mail_provider_url           text,
  ADD COLUMN IF NOT EXISTS mail_expected_delivery_date timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason              text;

-- Column notes:
--   mail_provider               which mail API sent it (e.g. 'postgrid')
--   mail_provider_status        PostGrid lifecycle: ready → printing →
--                               processed_for_delivery → completed
--   mail_provider_url           signed PDF preview URL from PostGrid
--   mail_expected_delivery_date PostGrid's estimated delivery date
--   failure_reason              error message captured on a failed send
