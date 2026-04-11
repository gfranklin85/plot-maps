-- Geocode Cache Migration
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS geocode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key text NOT NULL UNIQUE,
  formatted_address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  city text,
  state text,
  zip text,
  source text NOT NULL DEFAULT 'google',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geocode_cache_key ON geocode_cache(address_key);

ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on geocode_cache"
  ON geocode_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
