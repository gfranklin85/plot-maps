-- Auto-Target Requests Migration
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS auto_target_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  reference_lead_id uuid NOT NULL REFERENCES leads(id),
  reference_address text NOT NULL,
  reference_lat double precision NOT NULL,
  reference_lng double precision NOT NULL,
  radius_miles double precision NOT NULL DEFAULT 0.25,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  prospects_created int NOT NULL DEFAULT 0,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_auto_target_user ON auto_target_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_target_status ON auto_target_requests(status) WHERE status IN ('pending', 'processing');

ALTER TABLE auto_target_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own requests" ON auto_target_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own requests" ON auto_target_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role (admin API routes) bypasses RLS automatically
