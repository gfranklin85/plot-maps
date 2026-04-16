-- Campaign System Migration
-- Run in Supabase Dashboard > SQL Editor

-- ─── Campaigns table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    uuid NOT NULL REFERENCES auth.users(id),
  name                       text NOT NULL,
  assistant_name             text NOT NULL DEFAULT 'Morgan',
  campaign_type              text NOT NULL DEFAULT 'circle_prospecting'
    CHECK (campaign_type IN ('circle_prospecting')),
  status                     text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

  reference_lead_ids         uuid[] NOT NULL DEFAULT '{}',
  primary_reference_strategy text NOT NULL DEFAULT 'nearest'
    CHECK (primary_reference_strategy IN ('nearest', 'fixed')),

  allowed_facts              text[] NOT NULL DEFAULT '{}',

  base_prompt                text NOT NULL,
  campaign_injection         text NOT NULL,
  first_message_template     text NOT NULL,
  hook_variants              jsonb NOT NULL DEFAULT '[]',

  voice_provider             text NOT NULL DEFAULT '11labs',
  voice_id                   text NOT NULL DEFAULT 'rachel',

  total_prospects            int NOT NULL DEFAULT 0,
  calls_made                 int NOT NULL DEFAULT 0,
  calls_answered             int NOT NULL DEFAULT 0,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(user_id, status);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own campaigns"
  ON campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own campaigns"
  ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own campaigns"
  ON campaigns FOR UPDATE USING (auth.uid() = user_id);

-- ─── Campaign prospects (junction table) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_prospects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  call_status  text NOT NULL DEFAULT 'pending'
    CHECK (call_status IN ('pending', 'queued', 'calling', 'completed', 'skipped', 'failed')),
  ai_call_id   uuid REFERENCES ai_calls(id),
  call_order   int,
  priority     int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_campaign ON campaign_prospects(campaign_id, call_status);
CREATE INDEX IF NOT EXISTS idx_cp_lead ON campaign_prospects(lead_id);

ALTER TABLE campaign_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own campaign prospects"
  ON campaign_prospects FOR SELECT
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "Users insert own campaign prospects"
  ON campaign_prospects FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));
CREATE POLICY "Users update own campaign prospects"
  ON campaign_prospects FOR UPDATE
  USING (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND c.user_id = auth.uid()));

-- ─── Extend ai_calls for campaign tracking ───────────────────────────────────
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id);
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS reference_lead_id uuid;
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS hook_variant_used text;
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS intent_label text
  CHECK (intent_label IS NULL OR intent_label IN (
    'curious', 'maybe_this_year', 'settled_for_now', 'not_interested',
    'wrong_number', 'call_back_later', 'no_answer', 'voicemail'
  ));
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS intent_confidence float DEFAULT 0.0;
ALTER TABLE ai_calls ADD COLUMN IF NOT EXISTS follow_up_recommendation text;

CREATE INDEX IF NOT EXISTS idx_ai_calls_campaign ON ai_calls(campaign_id);
