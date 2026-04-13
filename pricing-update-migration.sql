-- Pricing Update Migration: Add skip trace tracking to usage_tracking
-- Run this in Supabase Dashboard > SQL Editor

ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS skip_traces_used integer DEFAULT 0;
ALTER TABLE usage_tracking ADD COLUMN IF NOT EXISTS skip_traces_limit integer DEFAULT 50;
