-- AI Caller (VAPI) Migration
-- Run this in Supabase Dashboard > SQL Editor

-- 1) Track AI call minute usage per month
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS ai_minutes_used numeric(10, 2) DEFAULT 0;
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS ai_minutes_limit integer DEFAULT 0;

-- 2) Per-user AI caller customization (override the default opening line)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_custom_opening text;

-- 3) AI call records — one row per VAPI call
CREATE TABLE IF NOT EXISTS ai_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  vapi_call_id text UNIQUE,
  assistant_id text NOT NULL,
  assistant_key text,
  assistant_name text,
  phone_called text NOT NULL,
  status text NOT NULL DEFAULT 'initiating'
    CHECK (status IN ('initiating', 'ringing', 'in-call', 'ended', 'failed')),
  duration_seconds integer DEFAULT 0,
  minutes_billed numeric(10, 2) DEFAULT 0,
  from_included integer DEFAULT 0,
  from_overage_cents integer DEFAULT 0,
  outcome text,
  transcript jsonb,
  summary text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_calls_user ON ai_calls(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_calls_lead ON ai_calls(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_vapi ON ai_calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_ai_calls_status ON ai_calls(status) WHERE status IN ('initiating', 'ringing', 'in-call');

ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own AI calls"
  ON ai_calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own AI calls"
  ON ai_calls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS automatically for webhook updates
