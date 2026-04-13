import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getQueueResults } from '@/lib/tracerfy';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id: queueId, pending, download_url } = body;

    if (pending) {
      // Still processing — ignore
      return NextResponse.json({ ok: true });
    }

    if (!queueId) {
      return NextResponse.json({ error: 'Missing queue ID' }, { status: 400 });
    }

    console.log(`Tracerfy webhook: queue ${queueId} completed, download: ${download_url}`);

    // Find the prospect_order linked to this Tracerfy queue
    const { data: order } = await supabaseAdmin
      .from('prospect_orders')
      .select('id, user_id, addresses')
      .eq('tracerfy_queue_id', queueId)
      .single();

    if (!order) {
      console.error(`No prospect_order found for tracerfy_queue_id ${queueId}`);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Fetch the actual trace results from Tracerfy
    const results = await getQueueResults(queueId);

    if (!results || results.length === 0) {
      console.warn(`Tracerfy queue ${queueId} returned no results`);
      await supabaseAdmin
        .from('prospect_orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', order.id);
      return NextResponse.json({ ok: true, matched: 0 });
    }

    // Match results back to leads by address and update with owner/phone data
    let matched = 0;

    for (const result of results) {
      // Build the full address to match against leads
      const traceAddr = result.address?.trim();
      if (!traceAddr) continue;

      const ownerName = [result.first_name, result.last_name].filter(Boolean).join(' ').trim() || null;

      // Collect phones: primary, mobiles, landlines — take first 3 non-empty
      const allPhones = [
        result.primary_phone,
        result.mobile_1, result.mobile_2, result.mobile_3,
        result.landline_1, result.landline_2,
      ].filter(p => p && p.trim());
      const phones = Array.from(new Set(allPhones)).slice(0, 3); // deduplicate, max 3

      const email = result.email_1?.trim() || null;
      const mailingAddr = [result.mail_address, result.mail_city, result.mail_state].filter(Boolean).join(', ') || null;

      // Find matching lead(s) by address prefix (case-insensitive)
      const addrKey = traceAddr.toUpperCase();
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('user_id', order.user_id)
        .ilike('property_address', `${addrKey}%`)
        .limit(5);

      if (leads && leads.length > 0) {
        for (const lead of leads) {
          await supabaseAdmin
            .from('leads')
            .update({
              owner_name: ownerName || undefined,
              phone: phones[0] || undefined,
              phone_2: phones[1] || undefined,
              phone_3: phones[2] || undefined,
              email: email || undefined,
              mailing_address: mailingAddr || undefined,
            })
            .eq('id', lead.id);
          matched++;
        }
      }
    }

    // Mark order as completed
    await supabaseAdmin
      .from('prospect_orders')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', order.id);

    console.log(`Tracerfy webhook: order ${order.id} fulfilled, ${matched} leads updated`);

    return NextResponse.json({ ok: true, matched });
  } catch (err) {
    console.error('Tracerfy webhook error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
