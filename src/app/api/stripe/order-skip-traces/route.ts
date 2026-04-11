import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const COST_PER_ADDRESS_CENTS = 18; // $0.18

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

  const addressCount = addresses.length;
  const amountCents = addressCount * COST_PER_ADDRESS_CENTS;

  // Get user profile + Stripe customer
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id, email, subscription_status')
    .eq('id', user.id)
    .single();

  if (profile?.subscription_status !== 'active') {
    return NextResponse.json(
      { error: 'Subscribe to a plan to order skip traces', require_subscription: true },
      { status: 403 }
    );
  }

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

  // Create order record
  const { data: order, error: orderError } = await supabaseAdmin
    .from('prospect_orders')
    .insert({
      user_id: user.id,
      address_count: addressCount,
      amount_cents: amountCents,
      addresses,
      status: 'pending',
    })
    .select('id')
    .single();

  if (orderError || !order) {
    console.error('Order insert error:', orderError);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }

  try {
    // Try immediate charge if payment method on file
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      description: `Skip traces for ${addressCount} addresses`,
      metadata: {
        user_id: user.id,
        order_id: order.id,
        order_type: 'skip_traces',
        address_count: addressCount.toString(),
      },
      automatic_payment_methods: { enabled: true },
    });

    const paymentMethods = await stripe.customers.listPaymentMethods(customerId);
    if (paymentMethods.data.length > 0) {
      const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: paymentMethods.data[0].id,
      });

      if (confirmed.status === 'succeeded') {
        // Mark order as paid
        await supabaseAdmin
          .from('prospect_orders')
          .update({
            status: 'paid',
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq('id', order.id);

        return NextResponse.json({
          success: true,
          orderId: order.id,
          charged: amountCents / 100,
        });
      }
    }

    // No payment method — fallback to checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Skip Traces — ${addressCount} Addresses` },
          unit_amount: COST_PER_ADDRESS_CENTS,
        },
        quantity: addressCount,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions'}/map?order=success&id=${order.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions'}/map?order=canceled`,
      metadata: {
        user_id: user.id,
        order_id: order.id,
        order_type: 'skip_traces',
      },
    });

    // Store checkout session ID on order
    await supabaseAdmin
      .from('prospect_orders')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', order.id);

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment failed';
    // Clean up the pending order
    await supabaseAdmin
      .from('prospect_orders')
      .update({ status: 'cancelled' })
      .eq('id', order.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
