-- Lob webhook events: immutable audit log of every event Lob sends us.
--
-- Why a separate table from property_inquiries.mail_provider_status:
--   - property_inquiries tracks the LATEST state of each postcard.
--     This table tracks the FULL HISTORY of every event Lob has sent us
--     about every postcard. Useful for debugging, support, and replaying
--     state if we ever change how we interpret events.
--   - Webhook deliveries can be retried by Lob — we use lob_event_id as
--     a uniqueness key so re-deliveries are idempotent (we record once,
--     additional fires are no-ops).
--   - On any "wait, why does this inquiry show 'returned' but the user
--     never saw a returned-to-sender event?" question, this table is the
--     ground-truth ledger.
--
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS lob_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lob_event_id    text NOT NULL UNIQUE,                  -- Lob's evt_* id; idempotency key
  event_type      text NOT NULL,                          -- "postcard.delivered" etc.
  resource_id     text,                                   -- psc_* id from event.body.id (or letter, etc.)
  resource_type   text,                                   -- "postcard" | "letter" | "self_mailer" | ...
  inquiry_id      uuid REFERENCES property_inquiries(id) ON DELETE SET NULL,
  payload         jsonb NOT NULL,                         -- raw event payload, verbatim
  signature_valid boolean NOT NULL,                       -- false if HMAC didn't match (still recorded for forensics)
  received_at     timestamptz NOT NULL DEFAULT now()
);

-- Quick lookups by postcard id (covers most operator queries: "what
-- happened to this postcard?").
CREATE INDEX IF NOT EXISTS lob_webhook_events_resource_id_idx
  ON lob_webhook_events (resource_id) WHERE resource_id IS NOT NULL;

-- Quick lookups by inquiry (covers UI queries: "show me the full
-- delivery history for this lead").
CREATE INDEX IF NOT EXISTS lob_webhook_events_inquiry_id_idx
  ON lob_webhook_events (inquiry_id, received_at DESC) WHERE inquiry_id IS NOT NULL;

-- Anomaly detection: list invalid-signature events.
CREATE INDEX IF NOT EXISTS lob_webhook_events_invalid_sig_idx
  ON lob_webhook_events (received_at DESC) WHERE signature_valid = false;

-- Hard rule: this table is append-only. We never delete or update rows.
-- Enforced via RLS — service role bypasses, no other policy allows
-- write paths other than insert. Frontend never sees these.
ALTER TABLE lob_webhook_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE lob_webhook_events IS
  'Immutable audit log of Lob webhook deliveries. Append-only. Service role only.';

COMMENT ON COLUMN lob_webhook_events.signature_valid IS
  'False if HMAC did not match the expected signature. We still insert the row so we can detect spoofing attempts after the fact.';
