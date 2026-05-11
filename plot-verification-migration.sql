-- ==========================================
-- Plot Verification Migration — v1
-- Owner-name match + relationship-disclosed manager tier
--   + agent-attestation tier (vouches for owner identity ONLY,
--     never modifies score content)
-- Run in Supabase Dashboard > SQL Editor AFTER plot-platform-migration.sql
-- ==========================================

-- ==========================================
-- 1. property_self_scores — verification metadata columns
-- ==========================================
-- The overarching rule: only the owner can author/modify the public score.
-- These columns describe HOW the claim was verified, not WHAT the claim says.
-- An agent attestation flips verification_tier without touching state /
-- would_sell_if_* / destination_* / visibility — those stay owner-controlled.

ALTER TABLE property_self_scores
  ADD COLUMN IF NOT EXISTS verification_tier text DEFAULT 'unverified'
    CHECK (verification_tier IN ('unverified', 'owner', 'manager', 'agent_attested'));

ALTER TABLE property_self_scores
  ADD COLUMN IF NOT EXISTS verification_method text
    CHECK (verification_method IN ('name_match', 'relationship_disclosed', 'agent_attestation'));

-- claimant_name is stored server-side for audit only. NEVER exposed in UI.
ALTER TABLE property_self_scores
  ADD COLUMN IF NOT EXISTS claimant_name text;

ALTER TABLE property_self_scores
  ADD COLUMN IF NOT EXISTS claimant_relationship text
    CHECK (claimant_relationship IN ('owner', 'spouse', 'managing_for_owner', 'executor', 'trustee', 'property_manager'));

ALTER TABLE property_self_scores
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- ==========================================
-- 2. agent_verifications — audit log of agent attestations
-- ==========================================
-- One row per (lead, agent, attested_at). Each attestation references the
-- agent's DRE (or equivalent) license number captured at attestation time
-- so the audit trail survives even if the agent later changes their profile.

CREATE TABLE IF NOT EXISTS agent_verifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  agent_user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_license_id    text NOT NULL,
  attested_owner_name text NOT NULL,
  attestation_notes   text,
  attested_at         timestamptz DEFAULT now(),
  superseded_at       timestamptz
);
CREATE INDEX IF NOT EXISTS agent_verifications_lead_idx
  ON agent_verifications (lead_id);
CREATE INDEX IF NOT EXISTS agent_verifications_agent_idx
  ON agent_verifications (agent_user_id, attested_at DESC);

ALTER TABLE agent_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read agent_verifications" ON agent_verifications;
CREATE POLICY "Authenticated read agent_verifications" ON agent_verifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Agents insert own attestations" ON agent_verifications;
CREATE POLICY "Agents insert own attestations" ON agent_verifications
  FOR INSERT WITH CHECK (auth.uid() = agent_user_id);

-- ==========================================
-- 3. profiles — DRE license number for agents
-- ==========================================
-- v1 stores the user-entered license id. State DRE API validation is Phase 2.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS dre_license_id text;

-- ==========================================
-- 4. leads — verification request flag
-- ==========================================
-- Set when an owner explicitly requests agent verification. Drives the
-- "Needs Verification" pin color on the public map and the agent
-- verification queue. Cleared when an attestation lands.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz;
