-- ==========================================
-- RLS Security Migration: Replace "Allow all" policies with user-based restrictions
-- Run this in Supabase Dashboard > SQL Editor
-- ==========================================

-- ==========================================
-- 1. Drop existing "Allow all" policies
-- ==========================================

-- Drop policies for leads table
DROP POLICY IF EXISTS "Allow all for leads" ON leads;

-- Drop policies for activities table
DROP POLICY IF EXISTS "Allow all for activities" ON activities;

-- Drop policies for import_templates table
DROP POLICY IF EXISTS "Allow all for import_templates" ON import_templates;

-- Drop policies for market_comps table
DROP POLICY IF EXISTS "Allow all for market_comps" ON market_comps;

-- Drop policies for daily_targets table
DROP POLICY IF EXISTS "Allow all for daily_targets" ON daily_targets;

-- Drop policies for call_scripts table
DROP POLICY IF EXISTS "Allow all for call_scripts" ON call_scripts;

-- Drop policies for call_responses table
DROP POLICY IF EXISTS "Allow all for call_responses" ON call_responses;

-- Drop policies for profiles table (if any "Allow all" exists, though it shouldn't)
DROP POLICY IF EXISTS "Allow all for profiles" ON profiles;

-- Drop policies for usage_tracking table (if any "Allow all" exists, though it shouldn't)
DROP POLICY IF EXISTS "Allow all for usage_tracking" ON usage_tracking;

-- ==========================================
-- 2. Create new user-based RLS policies
-- ==========================================

-- Leads table: Users can only access their own leads
CREATE POLICY "Users manage own leads" ON leads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Activities table: Users can only access activities for their leads
CREATE POLICY "Users manage own activities" ON activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Import templates table: Users can only access their own import templates
CREATE POLICY "Users manage own import_templates" ON import_templates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Market comps table: Users can only access their own market comps
CREATE POLICY "Users manage own market_comps" ON market_comps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Daily targets table: Users can only access their own daily targets
CREATE POLICY "Users manage own daily_targets" ON daily_targets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Call scripts table: Users can only access their own call scripts
CREATE POLICY "Users manage own call_scripts" ON call_scripts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Call responses table: Users can only access responses for their leads
CREATE POLICY "Users manage own call_responses" ON call_responses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Profiles table: Users can only access their own profile
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Usage tracking table: Users can only access their own usage data
CREATE POLICY "Users see own usage" ON usage_tracking
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 3. Ensure all tables have RLS enabled
-- ==========================================

-- Enable RLS on all data tables (should already be enabled, but ensuring)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_comps ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 4. Optional: Backfill user_id for existing data
-- ==========================================
-- If you have existing data without user_id set, you may need to backfill it.
-- This assumes you have a way to determine which user owns which data.
-- Uncomment and modify the following queries as needed:

-- Example backfill (uncomment and modify based on your data):
-- UPDATE leads SET user_id = 'some-user-id' WHERE user_id IS NULL;
-- UPDATE activities SET user_id = 'some-user-id' WHERE user_id IS NULL;
-- UPDATE market_comps SET user_id = 'some-user-id' WHERE user_id IS NULL;
-- UPDATE daily_targets SET user_id = 'some-user-id' WHERE user_id IS NULL;
-- UPDATE import_templates SET user_id = 'some-user-id' WHERE user_id IS NULL;
-- UPDATE call_scripts SET user_id = 'some-user-id' WHERE user_id IS NULL;
-- UPDATE call_responses SET user_id = 'some-user-id' WHERE user_id IS NULL;

-- ==========================================
-- 5. Verification queries (run after migration)
-- ==========================================
-- You can verify the policies are working by running these queries as different users:

-- As user A: SELECT COUNT(*) FROM leads; -- Should only see their leads
-- As user B: SELECT COUNT(*) FROM leads; -- Should only see their leads

-- Test insert as authenticated user:
-- INSERT INTO leads (address, user_id) VALUES ('123 Test St', auth.uid()); -- Should work
-- INSERT INTO leads (address, user_id) VALUES ('456 Test St', 'other-user-id'); -- Should fail</content>
<parameter name="filePath">c:\Users\gregf\OneDrive\Documents\plot-maps\rls-security-migration.sql