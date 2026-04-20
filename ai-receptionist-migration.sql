-- AI Receptionist configuration
-- Adds columns on profiles so users can persist their preferred assistant
-- template (tone) and voice for the inbound/opt-in AI caller.
-- Safe to run multiple times.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_default_assistant text DEFAULT 'neighbor_warmth',
  ADD COLUMN IF NOT EXISTS ai_voice_id text DEFAULT 'rachel';
