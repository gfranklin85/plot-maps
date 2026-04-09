-- Analytics Tables Migration
-- Run this in Supabase Dashboard > SQL Editor

-- ==========================================
-- 1. Anonymous Sessions table
-- ==========================================
CREATE TABLE IF NOT EXISTS anonymous_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  total_sessions integer NOT NULL DEFAULT 1,
  total_pageviews integer NOT NULL DEFAULT 0,
  total_events integer NOT NULL DEFAULT 0,
  landing_page text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  device_type text,
  browser text,
  os text,
  country text,
  region text,
  city text,
  engagement_score real NOT NULL DEFAULT 0,
  converted boolean NOT NULL DEFAULT false,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anon_sessions_anonymous_id ON anonymous_sessions(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_anon_sessions_user_id ON anonymous_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_anon_sessions_last_seen ON anonymous_sessions(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_anon_sessions_engagement ON anonymous_sessions(engagement_score DESC) WHERE NOT converted;
CREATE INDEX IF NOT EXISTS idx_anon_sessions_converted ON anonymous_sessions(converted) WHERE converted;

ALTER TABLE anonymous_sessions ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (via supabaseAdmin in API routes)
-- No public access — all analytics writes go through server-side API
CREATE POLICY "Service role full access on anonymous_sessions"
  ON anonymous_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ==========================================
-- 2. Analytics Events table
-- ==========================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES anonymous_sessions(id) ON DELETE CASCADE,
  anonymous_id text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  page_url text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_anonymous_id ON analytics_events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on analytics_events"
  ON analytics_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ==========================================
-- 3. Engagement score trigger
-- ==========================================
CREATE OR REPLACE FUNCTION compute_engagement_score()
RETURNS trigger AS $$
BEGIN
  NEW.engagement_score := (
    LEAST(NEW.total_pageviews, 50) * 2.0 +
    LEAST(NEW.total_events, 100) * 1.0 +
    LEAST(NEW.total_sessions, 20) * 5.0 +
    CASE WHEN NEW.last_seen > now() - interval '24 hours' THEN 20 ELSE 0 END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_engagement_score
  BEFORE INSERT OR UPDATE ON anonymous_sessions
  FOR EACH ROW EXECUTE FUNCTION compute_engagement_score();
