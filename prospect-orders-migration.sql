-- Prospect Orders Migration
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS prospect_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'processing', 'completed', 'cancelled')),
  address_count int NOT NULL,
  amount_cents int NOT NULL,
  addresses jsonb NOT NULL,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_orders_user ON prospect_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_prospect_orders_status ON prospect_orders(status) WHERE status IN ('pending', 'paid', 'processing');

ALTER TABLE prospect_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own orders" ON prospect_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own orders" ON prospect_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role (admin/webhook) bypasses RLS automatically
