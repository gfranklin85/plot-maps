import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { ingestQueueResults, type OrderAddress } from '@/lib/skiptrace-ingest';

// POST /api/admin/skiptrace/backfill
// Body (optional): { orderId?: string }
//
// Reconciles prospect_orders that were submitted to Tracerfy but never
// fulfilled — usually because the webhook URL wasn't configured or the
// webhook delivery failed. Pulls results directly via getQueueResults()
// and runs the same ingestion logic the webhook would have.
//
// With no orderId: processes every order with status='paid' OR 'processing'
// that has a tracerfy_queue_id. With orderId: processes just that one.
export async function POST(req: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminCheck } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as { orderId?: string };

  let query = supabaseAdmin
    .from('prospect_orders')
    .select('id, user_id, addresses, tracerfy_queue_id, status, created_at')
    .not('tracerfy_queue_id', 'is', null)
    .in('status', ['paid', 'processing']);

  if (body.orderId) {
    query = query.eq('id', body.orderId);
  }

  const { data: orders, error } = await query;
  if (error) {
    console.error('Backfill query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const results: { orderId: string; ok: boolean; matched?: number; total?: number; error?: string }[] = [];

  for (const order of (orders || [])) {
    if (!order.tracerfy_queue_id) continue;
    try {
      const summary = await ingestQueueResults({
        queueId: order.tracerfy_queue_id,
        orderId: order.id,
        userId: order.user_id,
        orderAddresses: (order.addresses as OrderAddress[]) || [],
      });
      results.push({ orderId: order.id, ok: true, ...summary });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Backfill failed for order ${order.id}:`, msg);
      results.push({ orderId: order.id, ok: false, error: msg });
    }
  }

  return NextResponse.json({
    processed: results.length,
    ok: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results,
  });
}
