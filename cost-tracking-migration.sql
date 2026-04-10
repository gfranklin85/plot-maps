-- Cost Tracking Migration
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  service text NOT NULL,
  operation text NOT NULL,
  estimated_cost real NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_events_user ON cost_events(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_service ON cost_events(service);
CREATE INDEX IF NOT EXISTS idx_cost_events_created ON cost_events(created_at DESC);

ALTER TABLE cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on cost_events"
  ON cost_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
