import { supabaseAdmin } from '@/lib/supabase-server';

/**
 * Log a billable API cost event. Fire-and-forget — never blocks the request.
 */
export function logCost(
  userId: string | null,
  service: string,
  operation: string,
  estimatedCost: number,
  quantity = 1,
  metadata?: Record<string, unknown>
) {
  supabaseAdmin
    .from('cost_events')
    .insert({
      user_id: userId,
      service,
      operation,
      estimated_cost: estimatedCost,
      quantity,
      metadata: metadata || {},
    })
    .then(({ error }) => {
      if (error) console.error('Cost tracking error:', error);
    });
}
