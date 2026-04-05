import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const COST_PER_GEOCODE_CENTS = 1; // $0.01

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { count } = await request.json();
  if (!count || count < 1) {
    return NextResponse.json({ error: 'count is required' }, { status: 400 });
  }

  const amountCents = count * COST_PER_GEOCODE_CENTS;

  // Get or create Stripe customer
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
    // Create a payment intent for the overage
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: customerId,
      description: `${count} geocoding credits`,
      metadata: {
        user_id: user.id,
        geocode_count: count.toString(),
      },
      automatic_payment_methods: { enabled: true },
    });

    // If customer has a payment method on file, confirm immediately
    const paymentMethods = await stripe.customers.listPaymentMethods(customerId);
    if (paymentMethods.data.length > 0) {
      const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
        payment_method: paymentMethods.data[0].id,
      });

      if (confirmed.status === 'succeeded') {
        // Increase their limit for this month
        const month = new Date().toISOString().slice(0, 7);
        const { data: usage } = await supabaseAdmin
          .from('usage_tracking')
          .select('*')
          .eq('user_id', user.id)
          .eq('month', month)
          .single();

        if (usage) {
          await supabaseAdmin
            .from('usage_tracking')
            .update({ geocodes_limit: (usage.geocodes_limit || 500) + count })
            .eq('id', usage.id);
        }

        return NextResponse.json({ success: true, charged: amountCents / 100 });
      }
    }

    // No payment method — need checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${count} Geocoding Credits` },
          unit_amount: COST_PER_GEOCODE_CENTS,
        },
        quantity: count,
      }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions'}/imports?geocodes=success&count=${count}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions'}/imports?geocodes=canceled`,
      metadata: { user_id: user.id, geocode_count: count.toString() },
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
