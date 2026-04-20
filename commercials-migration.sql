-- Commercials Migration
-- Reusable spoken commercials users build via the voice commercial builder.
-- Run this in Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS commercials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  script_text text NOT NULL,
  audio_url text NOT NULL,
  audio_duration_seconds integer NOT NULL DEFAULT 0,
  voice_id text NOT NULL,
  voice_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commercials_user ON commercials(user_id, created_at DESC);

ALTER TABLE commercials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own commercials" ON commercials;
CREATE POLICY "Users see own commercials" ON commercials
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own commercials" ON commercials;
CREATE POLICY "Users insert own commercials" ON commercials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own commercials" ON commercials;
CREATE POLICY "Users update own commercials" ON commercials
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own commercials" ON commercials;
CREATE POLICY "Users delete own commercials" ON commercials
  FOR DELETE USING (auth.uid() = user_id);
