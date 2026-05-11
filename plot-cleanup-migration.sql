-- ==========================================
-- Plot Cleanup Migration
-- - Drop deprecated owner_preferences.no_further_inquiries
-- - Add per-property channel-routing flags to leads
-- - Add owner-volunteered notification preferences
-- Run in Supabase Dashboard > SQL Editor AFTER plot-verification-migration.sql
-- ==========================================

-- ==========================================
-- 1. Drop the deprecated owner-wide opt-out
-- ==========================================
-- Plot's stance: owners control what they SAY about their property (status),
-- not whether the property exists on the platform. There is no "remove me"
-- toggle. Per-channel routing signals (text_declined) replace this field.

ALTER TABLE owner_preferences DROP COLUMN IF EXISTS no_further_inquiries;

-- ==========================================
-- 2. Per-property channel-routing flags on leads
-- ==========================================
-- text_declined: set by inbound STOP webhook (any variant). Gates text-invite
-- channel sends.
-- phone_on_record_is_bad: set when a structured-STOP body matches the
-- pattern "<wrong-name> STOP" (the name does NOT match leads.owner_name).
-- Tells future channel selection to prefer postcard over re-skip-trace —
-- the data source hasn't changed, so re-running skip-trace gets the same
-- bad result.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS text_declined boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS text_declined_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_on_record_is_bad boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_on_record_is_bad_at timestamptz;

-- ==========================================
-- 3. Owner-volunteered notification preferences
-- ==========================================
-- contact_phone is owner-provided (not skip-traced). It's a notification
-- routing channel for Plot to ping the owner when they have new activity
-- and aren't on Plot. Hard rule: never exposed to other users on the
-- platform; never used for outbound prospecting outreach (that's what
-- leads.phone is for, which is skip-traced and gated by Lite/Pro tier).
-- contact_phone_kept_private is server-side-enforced true in v1 (no UI).

ALTER TABLE owner_preferences ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE owner_preferences ADD COLUMN IF NOT EXISTS contact_phone_kept_private boolean DEFAULT true;
ALTER TABLE owner_preferences ADD COLUMN IF NOT EXISTS notification_email_enabled boolean DEFAULT true;
ALTER TABLE owner_preferences ADD COLUMN IF NOT EXISTS notification_sms_enabled boolean DEFAULT false;
