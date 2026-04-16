import { NextResponse } from 'next/server';
import { getAuthUser, getBillingContext } from '@/lib/auth';
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

  const { tier, isAdmin } = await getBillingContext(user.id);
  const month = getCurrentMonth();
  const isFree = tier.key === 'free';

  const needed = addresses.length;

  // Admins bypass ALL billing — full order goes through as "free"
  let includedRemaining = needed;
  let fromCredits = needed;
  let fromOverage = 0;
  let walletBalanceCents = 0;
  let walletSpendCents = 0;
  let usedCount = 0;

  if (!isAdmin) {
    // Step 1: Check how many included credits the user has used
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

    includedRemaining = Math.max(0, tier.skipTraces - usedCount);
    fromCredits = Math.min(needed, includedRemaining);
    fromOverage = needed - fromCredits;

    // Step 2: If user needs overage, handle it
    if (fromOverage > 0) {
      // Free tier can't do overages — must subscribe
      if (isFree) {
        return NextResponse.json({
          error: 'limit_reached',
          message: `You've used all ${tier.skipTraces} free skip traces. Subscribe to get more.`,
          upgrade: true,
          tier: tier.key,
          skip_traces_remaining: 0,
          skip_traces_limit: tier.skipTraces,
          order_size: needed,
        }, { status: 402 });
      }

      // Paid tier overage — check wallet balance
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id, balance_cents')
        .eq('user_id', user.id)
        .single();

      walletBalanceCents = wallet?.balance_cents || 0;
      walletSpendCents = fromOverage * tier.overageSkipTraceCents;

      if (walletBalanceCents < walletSpendCents) {
        return NextResponse.json({
          error: 'insufficient_balance',
          message: `You have ${includedRemaining} credits left. You need ${fromOverage} more at $${(tier.overageSkipTraceCents / 100).toFixed(2)} each ($${(walletSpendCents / 100).toFixed(2)}). Add funds to your wallet to continue.`,
          needs_topup: true,
          tier: tier.key,
          included_remaining: includedRemaining,
          overage_needed: fromOverage,
          overage_cost_cents: walletSpendCents,
          wallet_balance_cents: walletBalanceCents,
          overage_per_trace_cents: tier.overageSkipTraceCents,
        }, { status: 402 });
      }

      // Deduct from wallet
      if (wallet) {
        await supabaseAdmin
          .from('wallets')
          .update({
            balance_cents: walletBalanceCents - walletSpendCents,
            total_spent_cents: ((wallet as { total_spent_cents?: number }).total_spent_cents || 0) + walletSpendCents,
            updated_at: new Date().toISOString(),
          })
          .eq('id', wallet.id);

        await supabaseAdmin.from('wallet_transactions').insert({
          user_id: user.id,
          type: 'spend',
          amount_cents: walletSpendCents,
          balance_after_cents: walletBalanceCents - walletSpendCents,
          description: `Skip trace overage — ${fromOverage} addresses`,
          metadata: { address_count: fromOverage, overage_rate_cents: tier.overageSkipTraceCents },
        });
      }
    }

    // Step 3: Increment included credit usage
    if (fromCredits > 0) {
      const { data: usage } = await supabaseAdmin
        .from('usage_tracking')
        .select('id, skip_traces_used')
        .eq('user_id', user.id)
        .eq('month', month)
        .single();

      if (usage) {
        await supabaseAdmin.from('usage_tracking')
          .update({ skip_traces_used: (usage.skip_traces_used || 0) + fromCredits, updated_at: new Date().toISOString() })
          .eq('id', usage.id);
      } else {
        await supabaseAdmin.from('usage_tracking')
          .insert({ user_id: user.id, month, skip_traces_used: fromCredits, geocodes_used: 0, geocodes_limit: tier.geocodes, skip_traces_limit: tier.skipTraces });
      }
    }
  }

  // Step 4: Create prospect order
  const { data: order } = await supabaseAdmin
    .from('prospect_orders')
    .insert({
      user_id: user.id,
      status: 'paid',
      address_count: needed,
      amount_cents: walletSpendCents,
      addresses,
    })
    .select('id')
    .single();

  // Step 5: Auto-submit to Tracerfy
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

  // Step 6: Notify admin
  try {
    const addressList = addresses.map(a => a.address.split(',')[0]).join('\n\u2022 ');
    const overageNote = fromOverage > 0 ? `\nOverage: ${fromOverage} @ $${(tier.overageSkipTraceCents / 100).toFixed(2)} = $${(walletSpendCents / 100).toFixed(2)}` : '';
    await resend.emails.send({
      from: `Plot Maps <${FROM_EMAIL}>`,
      to: ADMIN_NOTIFY_EMAIL,
      subject: `${tracerfyQueued ? '🟢 Auto-traced' : '🟠 Manual fulfillment'} — ${needed} addresses`,
      text: `New order from ${user.email}\n\nAddresses: ${needed}\nIncluded credits: ${fromCredits}${overageNote}\nPlan: ${tier.label}\nTracerfy: ${tracerfyQueued ? 'Submitted' : 'FAILED'}\n\nAddresses:\n\u2022 ${addressList}`,
    });
  } catch { /* non-fatal */ }

  const newRemaining = Math.max(0, tier.skipTraces - usedCount - fromCredits);

  return NextResponse.json({
    success: true,
    addresses_traced: needed,
    from_credits: fromCredits,
    from_overage: fromOverage,
    overage_cost_cents: walletSpendCents,
    skip_traces_remaining: newRemaining,
    wallet_balance_cents: walletBalanceCents - walletSpendCents,
    tracerfy_queued: tracerfyQueued,
  });
}
