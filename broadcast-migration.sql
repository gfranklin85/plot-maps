-- Broadcast Engine Migration
-- Run this in Supabase Dashboard > SQL Editor

-- Broadcasts — one row per broadcast campaign
CREATE TABLE IF NOT EXISTS broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'circle_prospecting'
    CHECK (type IN ('circle_prospecting', 'market_snapshot', 'multi_property')),
  reference_pack jsonb NOT NULL,
  script_text text NOT NULL,
  audio_url text,
  audio_duration_seconds integer,
  voicemail_audio_url text,
  voicemail_duration_seconds integer,
  script_hash text,
  cta_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating_audio', 'ready', 'queued', 'sending', 'paused', 'completed', 'failed')),
  total_calls integer DEFAULT 0,
  total_answered integer DEFAULT 0,
  total_heard integer DEFAULT 0,
  total_press_1 integer DEFAULT 0,
  total_press_2 integer DEFAULT 0,
  total_press_3 integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  completed_at timestamptz
);

-- Individual call records for each prospect in a broadcast
CREATE TABLE IF NOT EXISTS broadcast_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  prospect_phone text NOT NULL,
  prospect_name text,
  prospect_address text,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  twilio_call_sid text UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dialing', 'answered', 'voicemail', 'no_answer', 'busy', 'failed', 'completed')),
  dtmf_response text,
  intent text,
  duration_seconds integer DEFAULT 0,
  actual_duration_seconds integer DEFAULT 0,
  heard_audio boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  completed_at timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcasts_user ON broadcasts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON broadcasts(status) WHERE status IN ('queued', 'sending', 'paused');
CREATE INDEX IF NOT EXISTS idx_broadcast_calls_broadcast ON broadcast_calls(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_calls_sid ON broadcast_calls(twilio_call_sid);
CREATE INDEX IF NOT EXISTS idx_broadcast_calls_intent ON broadcast_calls(intent) WHERE intent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_broadcast_calls_status ON broadcast_calls(broadcast_id, status);

-- RLS
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own broadcasts" ON broadcasts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own broadcasts" ON broadcasts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE broadcast_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own broadcast calls" ON broadcast_calls
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (webhooks, queue worker) bypasses RLS automatically

-- Add broadcast calls to usage_tracking
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS broadcast_calls_used integer DEFAULT 0;
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS broadcast_calls_limit integer DEFAULT 0;
