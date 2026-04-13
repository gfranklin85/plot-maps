-- Tracerfy Integration Migration
-- Run this in Supabase Dashboard > SQL Editor

-- Add tracerfy queue tracking to prospect_orders
ALTER TABLE prospect_orders ADD COLUMN IF NOT EXISTS tracerfy_queue_id integer;
ALTER TABLE prospect_orders ADD COLUMN IF NOT EXISTS tracerfy_trace_type text DEFAULT 'advanced';

CREATE INDEX IF NOT EXISTS idx_prospect_orders_tracerfy ON prospect_orders(tracerfy_queue_id) WHERE tracerfy_queue_id IS NOT NULL;
