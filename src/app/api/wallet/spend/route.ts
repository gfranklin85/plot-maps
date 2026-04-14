import { NextResponse } from 'next/server';
import { getAuthUser, getTierForUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { batchTrace } from '@/lib/tracerfy';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.FROM_EMAIL || 'greg@plot.solutions';
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'gregfranklin523@gmail.com';

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface AddressItem {
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { addresses } = await request.json() as { addresses: AddressItem[] };

  if (!addresses || addresses.length === 0) {
    return NextResponse.json({ error: 'addresses required' }, { status: 400 });
  }

  const tier = await getTierForUser(user.id);
  const month = getCurrentMonth();
  const isFree = tier.key === 'free';

  // Check monthly skip trace allocation
  let usedCount = 0;
  if (isFree) {
    const { data: allUsage } = await supabaseAdmin
      .from('usage_tracking')
      .select('skip_traces_used')
      .eq('user_id', user.id);
    usedCount = (allUsage || []).reduce((s, r) => s + (r.skip_traces_used || 0), 0);
  } else {
    const { data: usage } = await supabaseAdmin
      .from('usage_tracking')
      .select('skip_traces_used')
      .eq('user_id', user.id)
      .eq('month', month)
      .single();
    usedCount = usage?.skip_traces_used || 0;
  }

  const remaining = tier.skipTraces - usedCount;

  if (addresses.length > remaining) {
    return NextResponse.json({
      error: 'limit_exceeded',
      message: `You have ${remaining} skip traces remaining this month. This order needs ${addresses.length}.`,
      upgrade: true,
      tier: tier.key,
      skip_traces_remaining: remaining,
      skip_traces_limit: tier.skipTraces,
      order_size: addresses.length,
    }, { status: 402 });
  }

  // Increment skip trace usage
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('id, skip_traces_used')
    .eq('user_id', user.id)
    .eq('month', month)
    .single();

  if (usage) {
    await supabaseAdmin.from('usage_tracking')
      .update({ skip_traces_used: (usage.skip_traces_used || 0) + addresses.length, updated_at: new Date().toISOString() })
      .eq('id', usage.id);
  } else {
    await supabaseAdmin.from('usage_tracking')
      .insert({ user_id: user.id, month, skip_traces_used: addresses.length, geocodes_used: 0, geocodes_limit: tier.geocodes, skip_traces_limit: tier.skipTraces });
  }

  // Create prospect order
  const { data: order } = await supabaseAdmin
    .from('prospect_orders')
    .insert({
      user_id: user.id,
      status: 'paid',
      address_count: addresses.length,
      amount_cents: 0, // included in plan
      addresses,
    })
    .select('id')
    .single();

  // Auto-submit to Tracerfy
  let tracerfyQueued = false;
  if (order) {
    try {
      const traceResult = await batchTrace(
        addresses.map(a => ({
          address: a.address,
          city: a.city || '',
          state: a.state || 'CA',
          zip: a.zip || '',
        })),
        'advanced'
      );

      await supabaseAdmin
        .from('prospect_orders')
        .update({
          status: 'processing',
          tracerfy_queue_id: traceResult.queue_id,
          tracerfy_trace_type: traceResult.trace_type,
        })
        .eq('id', order.id);

      tracerfyQueued = true;
    } catch (err) {
      console.error('Tracerfy batch trace failed:', err);
    }
  }

  // Notify admin
  try {
    const addressList = addresses.map(a => a.address.split(',')[0]).join('\n• ');
    await resend.emails.send({
      from: `Plot Maps <${FROM_EMAIL}>`,
      to: ADMIN_NOTIFY_EMAIL,
      subject: `${tracerfyQueued ? '🟢 Auto-traced' : '🟠 Manual fulfillment'} — ${addresses.length} addresses`,
      text: `New order from ${user.email}\n\nAddresses: ${addresses.length}\nPlan: ${tier.label}\nTracerfy: ${tracerfyQueued ? 'Submitted' : 'FAILED'}\n\nAddresses:\n• ${addressList}`,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    success: true,
    addresses_traced: addresses.length,
    skip_traces_remaining: remaining - addresses.length,
    tracerfy_queued: tracerfyQueued,
  });
}
