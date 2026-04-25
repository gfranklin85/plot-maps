import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { ingestQueueResults, type OrderAddress } from '@/lib/skiptrace-ingest';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id: queueId, pending, download_url } = body;

    if (pending) {
      // Tracerfy may ping mid-flight; ignore until completed.
      return NextResponse.json({ ok: true });
    }

    if (!queueId) {
      return NextResponse.json({ error: 'Missing queue ID' }, { status: 400 });
    }

    console.log(`Tracerfy webhook: queue ${queueId} completed, download: ${download_url}`);

    const { data: order } = await supabaseAdmin
      .from('prospect_orders')
      .select('id, user_id, addresses')
      .eq('tracerfy_queue_id', queueId)
      .single();

    if (!order) {
      console.error(`No prospect_order found for tracerfy_queue_id ${queueId}`);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const summary = await ingestQueueResults({
      queueId,
      orderId: order.id,
      userId: order.user_id,
      orderAddresses: (order.addresses as OrderAddress[]) || [],
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error('Tracerfy webhook error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
