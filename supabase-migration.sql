-- Phase 1 Database Migration
-- Run this in Supabase Dashboard > SQL Editor

-- ==========================================
-- 1. Add columns to leads table
-- ==========================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_2 text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_3 text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailing_address text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailing_city text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailing_state text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mailing_zip text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contact_date timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zip text;

-- ==========================================
-- 2. Create activities table (unified activity log)
-- ==========================================
CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  type text NOT NULL, -- 'call', 'note', 'email', 'letter', 'status_change', 'import'
  title text NOT NULL,
  description text,
  outcome text, -- for calls: 'No Answer', 'Left VM', 'Spoke with Owner', etc.
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- RLS for activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for activities" ON activities FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 3. Create import_templates table
-- ==========================================
CREATE TABLE IF NOT EXISTS import_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source text NOT NULL,
  column_mapping jsonb NOT NULL,
  field_defaults jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for import_templates" ON import_templates FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 4. Create market_comps table
-- ==========================================
CREATE TABLE IF NOT EXISTS market_comps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  address text NOT NULL,
  city text,
  state text,
  zip text,
  latitude double precision,
  longitude double precision,
  sale_price numeric,
  list_price numeric,
  sale_date date,
  sqft integer,
  beds integer,
  baths numeric,
  year_built integer,
  lot_size text,
  comp_type text NOT NULL DEFAULT 'sold', -- 'active', 'sold', 'pending'
  dom integer, -- days on market
  price_per_sqft numeric,
  notes text,
  source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE market_comps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for market_comps" ON market_comps FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 5. Create daily_targets table
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_date date NOT NULL DEFAULT CURRENT_DATE,
  conversations_target integer DEFAULT 25,
  conversations_actual integer DEFAULT 0,
  followups_target integer DEFAULT 8,
  followups_actual integer DEFAULT 0,
  letters_target integer DEFAULT 5,
  letters_actual integer DEFAULT 0,
  new_contacts_target integer DEFAULT 5,
  new_contacts_actual integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(target_date)
);

ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for daily_targets" ON daily_targets FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 6. Ensure leads table has open RLS policies
-- ==========================================
-- (These may already exist - safe to run)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'Allow all for leads') THEN
    CREATE POLICY "Allow all for leads" ON leads FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ==========================================
-- 7. Create call_scripts table (editable question checklists)
-- ==========================================
CREATE TABLE IF NOT EXISTS call_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for call_scripts" ON call_scripts FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 8. Create call_responses table (answers from calls)
-- ==========================================
CREATE TABLE IF NOT EXISTS call_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  script_id uuid REFERENCES call_scripts(id) ON DELETE SET NULL,
  question text NOT NULL,
  answer text,
  call_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for call_responses" ON call_responses FOR ALL USING (true) WITH CHECK (true);
