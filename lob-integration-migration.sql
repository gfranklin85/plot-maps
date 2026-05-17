-- Lob integration: extend property_inquiries with provider metadata
--
-- The base table already has `mail_provider_id` (the postcard ID from
-- the provider), but we need to capture more about the send so:
--   1) Webhook events can reconcile lifecycle (queued → rendered →
--      in_transit → delivered / returned_to_sender).
--   2) The UI can link directly to Lob's signed PDF preview.
--   3) Failed sends carry the reason without us re-calling Lob.
--   4) We can show expected delivery dates in the inbox.
--
-- All columns are nullable / additive so this is safe to run on a
-- table with existing rows (none of which will have Lob data yet).
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE property_inquiries
  ADD COLUMN IF NOT EXISTS mail_provider              text,
  ADD COLUMN IF NOT EXISTS mail_provider_url          text,
  ADD COLUMN IF NOT EXISTS mail_provider_status       text,
  ADD COLUMN IF NOT EXISTS mail_expected_delivery_date date,
  ADD COLUMN IF NOT EXISTS failure_reason             text;

-- Soft constraint on provider value — keep open-ended for future
-- providers (PostGrid, Click2Mail) without needing another migration.
-- We pre-seed only "lob" today.
COMMENT ON COLUMN property_inquiries.mail_provider IS
  'Name of the print-and-mail provider. Currently always "lob". Other candidates: postgrid, click2mail.';

COMMENT ON COLUMN property_inquiries.mail_provider_url IS
  'Signed URL to the rendered PDF of the postcard. Lob URLs expire ~30 days; regenerate via the provider API if needed.';

COMMENT ON COLUMN property_inquiries.mail_provider_status IS
  'Lifecycle string from provider webhooks. For Lob: postcard.created | postcard.rendered_pdf | postcard.in_transit | postcard.in_local_area | postcard.processed_for_delivery | postcard.delivered | postcard.returned_to_sender | postcard.failed.';

-- Index on provider_id for fast webhook → inquiry resolution. Without
-- this, every webhook event scans the table. Cardinality is high
-- (one row per send) so a btree index is the right shape.
CREATE INDEX IF NOT EXISTS property_inquiries_mail_provider_id_idx
  ON property_inquiries (mail_provider_id)
  WHERE mail_provider_id IS NOT NULL;
