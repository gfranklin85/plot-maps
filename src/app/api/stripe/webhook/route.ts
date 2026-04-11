import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-server';
import Stripe from 'stripe';

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;

      // Skip trace order payment completed
      if (session.metadata?.order_type === 'skip_traces' && session.metadata?.order_id) {
        await supabaseAdmin
          .from('prospect_orders')
          .update({ status: 'paid' })
          .eq('id', session.metadata.order_id);
        break;
      }

      // Subscription checkout
      if (session.customer && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = sub.items.data[0]?.price?.id || null;

        await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            stripe_price_id: priceId,
          })
          .eq('stripe_customer_id', session.customer as string);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const status = subscription.status === 'active' ? 'active'
        : subscription.status === 'trialing' ? 'trialing'
        : subscription.status === 'past_due' ? 'past_due'
        : 'canceled';
      const priceId = subscription.items.data[0]?.price?.id || null;

      await supabaseAdmin
        .from('profiles')
        .update({ subscription_status: status, stripe_price_id: priceId })
        .eq('stripe_customer_id', subscription.customer as string);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from('profiles')
        .update({ subscription_status: 'canceled', subscription_id: null })
        .eq('stripe_customer_id', subscription.customer as string);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer) {
        await supabaseAdmin
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('stripe_customer_id', invoice.customer as string);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
