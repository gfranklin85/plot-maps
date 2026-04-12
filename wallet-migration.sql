-- Wallet System Migration
-- Run this in Supabase Dashboard > SQL Editor

-- User wallets — one per user
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  balance_cents int NOT NULL DEFAULT 0,
  total_deposited_cents int NOT NULL DEFAULT 0,
  total_spent_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Transaction history — deposits and spends
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('deposit', 'spend')),
  amount_cents int NOT NULL,
  balance_after_cents int NOT NULL,
  description text,
  stripe_payment_intent_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at DESC);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own transactions" ON wallet_transactions
  FOR SELECT USING (auth.uid() = user_id);
