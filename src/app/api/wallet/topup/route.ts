import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const MIN_TOPUP_CENTS = 1000; // $10

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount_cents } = await request.json();

  if (!amount_cents || amount_cents < MIN_TOPUP_CENTS) {
    return NextResponse.json({ error: `Minimum top-up is $${(MIN_TOPUP_CENTS / 100).toFixed(2)}` }, { status: 400 });
  }

  // Get user profile for Stripe customer
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single();

  let customerId = profile?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || profile?.email || '',
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', user.id);
  }

  try {
    // Try immediate charge if payment method on file
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: 'usd',
      customer: customerId,
      description: `Wallet top-up — $${(amount_cents / 100).toFixed(2)}`,
      metadata: {
        user_id: user.id,
        type: 'wallet_topup',
        amount_cents: amount_cents.toString(),
      },
      automatic_payment_methods: { enabled: true },
    });

    const paymentMethods = await stripe.customers.listPaymentMethods(customerId);
    if (paymentMethods.data.length > 0) {
      const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: paymentMethods.data[0].id,
      });

      if (confirmed.status === 'succeeded') {
        // Credit wallet immediately
        await creditWallet(user.id, amount_cents, paymentIntent.id);
        return NextResponse.json({ success: true, charged: amount_cents / 100 });
      }
    }

    // Fallback to checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Plot Maps Wallet — $${(amount_cents / 100).toFixed(2)}` },
          unit_amount: amount_cents,
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions'}/map?wallet=success&amount=${amount_cents}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions'}/map?wallet=canceled`,
      metadata: {
        user_id: user.id,
        type: 'wallet_topup',
        amount_cents: amount_cents.toString(),
      },
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function creditWallet(userId: string, amountCents: number, stripePaymentIntentId?: string) {
  // Get or create wallet
  let { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!wallet) {
    const { data: created } = await supabaseAdmin
      .from('wallets')
      .insert({ user_id: userId })
      .select('*')
      .single();
    wallet = created;
  }

  if (!wallet) return;

  const newBalance = wallet.balance_cents + amountCents;

  await supabaseAdmin
    .from('wallets')
    .update({
      balance_cents: newBalance,
      total_deposited_cents: wallet.total_deposited_cents + amountCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  await supabaseAdmin
    .from('wallet_transactions')
    .insert({
      user_id: userId,
      type: 'deposit',
      amount_cents: amountCents,
      balance_after_cents: newBalance,
      description: `Wallet top-up — $${(amountCents / 100).toFixed(2)}`,
      stripe_payment_intent_id: stripePaymentIntentId || null,
    });
}
