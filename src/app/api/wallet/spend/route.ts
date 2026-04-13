import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { batchTrace } from '@/lib/tracerfy';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.FROM_EMAIL || 'greg@plot.solutions';
const ADMIN_NOTIFY_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'gregfranklin523@gmail.com';
const COST_PER_ADDRESS_CENTS = 25; // $0.25
const MIN_ORDER_SIZE = 1; // no minimum

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

  if (addresses.length < MIN_ORDER_SIZE) {
    return NextResponse.json({ error: `Minimum order is ${MIN_ORDER_SIZE} properties`, min: MIN_ORDER_SIZE }, { status: 400 });
  }

  const totalCost = addresses.length * COST_PER_ADDRESS_CENTS;

  // Get wallet
  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!wallet || wallet.balance_cents < totalCost) {
    return NextResponse.json({
      error: 'insufficient_balance',
      balance_cents: wallet?.balance_cents || 0,
      required_cents: totalCost,
    }, { status: 402 });
  }

  const newBalance = wallet.balance_cents - totalCost;

  // Deduct from wallet
  await supabaseAdmin
    .from('wallets')
    .update({
      balance_cents: newBalance,
      total_spent_cents: wallet.total_spent_cents + totalCost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  // Record transaction
  await supabaseAdmin
    .from('wallet_transactions')
    .insert({
      user_id: user.id,
      type: 'spend',
      amount_cents: totalCost,
      balance_after_cents: newBalance,
      description: `Skip traces — ${addresses.length} addresses`,
      metadata: { address_count: addresses.length },
    });

  // Create prospect order
  const { data: order } = await supabaseAdmin
    .from('prospect_orders')
    .insert({
      user_id: user.id,
      status: 'paid',
      address_count: addresses.length,
      amount_cents: totalCost,
      addresses,
    })
    .select('id')
    .single();

  // Auto-submit to Tracerfy for skip tracing
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
        'advanced' // finds owner automatically
      );

      // Update order with Tracerfy queue ID and set to processing
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
      // Tracerfy failed — order stays as 'paid' for manual fulfillment
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
      text: `New order from ${user.email}\n\nAddresses: ${addresses.length}\nCost: $${(totalCost / 100).toFixed(2)}\nTracerfy: ${tracerfyQueued ? 'Submitted (auto-processing)' : 'FAILED — needs manual fulfillment'}\n\nAddresses:\n• ${addressList}`,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    success: true,
    spent_cents: totalCost,
    balance_cents: newBalance,
    balance: (newBalance / 100).toFixed(2),
    tracerfy_queued: tracerfyQueued,
  });
}
