-- ==========================================
-- Plot Platform Migration — Phase 1
-- Buyer-side outreach + owner self-score
-- Run in Supabase Dashboard > SQL Editor
-- ==========================================

-- ==========================================
-- 1. Profile additions (edition + armed channel)
-- ==========================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plot_edition text DEFAULT 'lite'
  CHECK (plot_edition IN ('lite', 'pro'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS armed_channel text
  CHECK (armed_channel IN ('text_invite', 'direct_mail', 'phone_call'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS armed_mail_template_id uuid;

-- ==========================================
-- 2. mail_templates — user-authored direct mail
-- ==========================================
CREATE TABLE IF NOT EXISTS mail_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  body_text   text NOT NULL,
  variables   jsonb,
  is_default  boolean DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mail_templates_user_id_idx ON mail_templates (user_id);

ALTER TABLE mail_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own mail_templates" ON mail_templates;
CREATE POLICY "Users manage own mail_templates" ON mail_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Now that mail_templates exists, add the FK on profiles.armed_mail_template_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_armed_mail_template_id_fkey'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_armed_mail_template_id_fkey
      FOREIGN KEY (armed_mail_template_id) REFERENCES mail_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ==========================================
-- 3. property_inquiries — every outbound contact attempt
-- ==========================================
CREATE TABLE IF NOT EXISTS property_inquiries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  initiator_user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initiator_edition   text CHECK (initiator_edition IN ('lite', 'pro')),
  channel             text NOT NULL CHECK (channel IN ('text_invite', 'direct_mail', 'phone_call')),
  status              text NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'replied', 'opted_out')),
  twilio_sid          text,
  mail_provider_id    text,
  template_id         uuid REFERENCES mail_templates(id) ON DELETE SET NULL,
  cost_cents          int,
  sent_at             timestamptz,
  delivered_at        timestamptz,
  replied_at          timestamptz,
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_inquiries_lead_id_idx ON property_inquiries (lead_id);
CREATE INDEX IF NOT EXISTS property_inquiries_initiator_idx
  ON property_inquiries (initiator_user_id, created_at DESC);

ALTER TABLE property_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own property_inquiries" ON property_inquiries;
CREATE POLICY "Users manage own property_inquiries" ON property_inquiries
  FOR ALL USING (auth.uid() = initiator_user_id)
  WITH CHECK (auth.uid() = initiator_user_id);

-- ==========================================
-- 4. property_self_scores — owner's named-state response
-- ==========================================
CREATE TABLE IF NOT EXISTS property_self_scores (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                  uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  owner_user_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  state                    text NOT NULL
                             CHECK (state IN ('here_to_stay', 'curious_to_hear_offers', 'would_sell_if')),
  would_sell_if_condition  text,
  would_sell_if_freetext   text,
  destination_city         text,
  destination_state        text,
  destination_condition    text,
  visibility               text NOT NULL DEFAULT 'public'
                             CHECK (visibility IN ('private_to_initiator', 'public')),
  triggered_by_inquiry_id  uuid REFERENCES property_inquiries(id) ON DELETE SET NULL,
  set_at                   timestamptz DEFAULT now(),
  is_current               boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS property_self_scores_current_idx
  ON property_self_scores (lead_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS property_self_scores_owner_idx
  ON property_self_scores (owner_user_id);
CREATE INDEX IF NOT EXISTS property_self_scores_destination_idx
  ON property_self_scores (destination_city, destination_state) WHERE is_current = true;

ALTER TABLE property_self_scores ENABLE ROW LEVEL SECURITY;

-- Read policy: owner sees their own; public scores readable by any authenticated user;
-- private_to_initiator readable by the inquiry initiator.
DROP POLICY IF EXISTS "Read property_self_scores" ON property_self_scores;
CREATE POLICY "Read property_self_scores" ON property_self_scores
  FOR SELECT USING (
    auth.uid() = owner_user_id
    OR visibility = 'public'
    OR (
      visibility = 'private_to_initiator'
      AND triggered_by_inquiry_id IN (
        SELECT id FROM property_inquiries WHERE initiator_user_id = auth.uid()
      )
    )
  );

-- Owner can insert their own self-score
DROP POLICY IF EXISTS "Owner inserts own self-score" ON property_self_scores;
CREATE POLICY "Owner inserts own self-score" ON property_self_scores
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

-- Owner can update their own (used to flip is_current = false on previous versions)
DROP POLICY IF EXISTS "Owner updates own self-score" ON property_self_scores;
CREATE POLICY "Owner updates own self-score" ON property_self_scores
  FOR UPDATE USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

-- ==========================================
-- 5. owner_preferences — contact + routing prefs
-- ==========================================
CREATE TABLE IF NOT EXISTS owner_preferences (
  owner_user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  available_to_be_asked  boolean DEFAULT false,
  no_further_inquiries   boolean DEFAULT false,
  inquiry_revenue_share  boolean DEFAULT false,
  display_name           text,
  preferred_channel      text CHECK (preferred_channel IN ('text', 'plot_messaging', 'none')),
  updated_at             timestamptz DEFAULT now()
);

ALTER TABLE owner_preferences ENABLE ROW LEVEL SECURITY;

-- Owner manages their own
DROP POLICY IF EXISTS "Owner manages own preferences" ON owner_preferences;
CREATE POLICY "Owner manages own preferences" ON owner_preferences
  FOR ALL USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Any authenticated user can read available_to_be_asked status (needed for Lite gating).
-- We expose the whole row read; display_name is intentionally non-PII (avatar name).
DROP POLICY IF EXISTS "Authenticated read owner_preferences" ON owner_preferences;
CREATE POLICY "Authenticated read owner_preferences" ON owner_preferences
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 6. property_messages — Plot internal messaging inbox
-- ==========================================
CREATE TABLE IF NOT EXISTS property_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  thread_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role     text NOT NULL CHECK (sender_role IN ('inquirer', 'owner', 'system')),
  body            text NOT NULL,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS property_messages_thread_idx
  ON property_messages (lead_id, thread_user_id, created_at);
CREATE INDEX IF NOT EXISTS property_messages_owner_idx
  ON property_messages (owner_user_id, created_at DESC);

ALTER TABLE property_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Thread participants read property_messages" ON property_messages;
CREATE POLICY "Thread participants read property_messages" ON property_messages
  FOR SELECT USING (auth.uid() = thread_user_id OR auth.uid() = owner_user_id);
DROP POLICY IF EXISTS "Thread participants insert property_messages" ON property_messages;
CREATE POLICY "Thread participants insert property_messages" ON property_messages
  FOR INSERT WITH CHECK (auth.uid() = thread_user_id OR auth.uid() = owner_user_id);

-- ==========================================
-- 7. claim_tokens — one-time owner-claim tokens in invite links
-- ==========================================
CREATE TABLE IF NOT EXISTS claim_tokens (
  token        text PRIMARY KEY,
  lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  inquiry_id   uuid REFERENCES property_inquiries(id) ON DELETE CASCADE,
  expires_at   timestamptz,
  consumed_at  timestamptz,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claim_tokens_lead_idx ON claim_tokens (lead_id);

-- No RLS — tokens are validated server-side via service role only; clients never query directly.
-- Disabled RLS and revoking grants makes this explicit.
ALTER TABLE claim_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Server-only claim_tokens" ON claim_tokens;
-- No SELECT/INSERT/UPDATE policies → only service role (which bypasses RLS) can touch this table.
