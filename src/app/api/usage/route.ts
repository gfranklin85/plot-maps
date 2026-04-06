import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '';
const FREE_LIFETIME_LIMIT = 50;
const STARTER_MONTHLY_LIMIT = 500;
const PRO_MONTHLY_LIMIT = 2000;

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // '2026-04'
}

async function getSubscriptionInfo(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, stripe_price_id')
    .eq('id', userId)
    .single();

  const status = profile?.subscription_status || null;
  const isSubscribed = status === 'active';
  const isPro = isSubscribed && profile?.stripe_price_id === PRO_PRICE_ID;

  return { status, isSubscribed, isPro };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = getCurrentMonth();
  const { isSubscribed, isPro } = await getSubscriptionInfo(user.id);

  if (!isSubscribed) {
    // Free user: lifetime limit of 50 geocodes across ALL months
    const { data: allUsage } = await supabaseAdmin
      .from('usage_tracking')
      .select('geocodes_used')
      .eq('user_id', user.id);

    const totalUsed = (allUsage || []).reduce((sum, row) => sum + (row.geocodes_used || 0), 0);

    return NextResponse.json({
      month,
      geocodes_used: totalUsed,
      geocodes_limit: FREE_LIFETIME_LIMIT,
      geocodes_remaining: Math.max(0, FREE_LIFETIME_LIMIT - totalUsed),
      is_free: true,
      can_buy_overages: false,
    });
  }

  // Subscribed user: monthly limit
  const limit = isPro ? PRO_MONTHLY_LIMIT : STARTER_MONTHLY_LIMIT;

  let { data } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', month)
    .single();

  if (!data) {
    const { data: created } = await supabaseAdmin
      .from('usage_tracking')
      .insert({ user_id: user.id, month, geocodes_used: 0, geocodes_limit: limit })
      .select()
      .single();
    data = created;
  } else if (data.geocodes_limit !== limit) {
    // Update limit if plan changed
    await supabaseAdmin
      .from('usage_tracking')
      .update({ geocodes_limit: limit })
      .eq('id', data.id);
    data.geocodes_limit = limit;
  }

  return NextResponse.json({
    month: data?.month,
    geocodes_used: data?.geocodes_used || 0,
    geocodes_limit: data?.geocodes_limit || limit,
    geocodes_remaining: Math.max(0, (data?.geocodes_limit || limit) - (data?.geocodes_used || 0)),
    is_free: false,
    can_buy_overages: true,
  });
}

// Increment geocode usage
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { count = 1 } = await request.json();
  const month = getCurrentMonth();
  const { isSubscribed, isPro } = await getSubscriptionInfo(user.id);
  const limit = isSubscribed ? (isPro ? PRO_MONTHLY_LIMIT : STARTER_MONTHLY_LIMIT) : FREE_LIFETIME_LIMIT;

  // Get current month usage
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', month)
    .single();

  if (!usage) {
    await supabaseAdmin
      .from('usage_tracking')
      .insert({ user_id: user.id, month, geocodes_used: count, geocodes_limit: limit });

    return NextResponse.json({ geocodes_used: count, geocodes_remaining: limit - count });
  }

  const newUsed = (usage.geocodes_used || 0) + count;

  await supabaseAdmin
    .from('usage_tracking')
    .update({ geocodes_used: newUsed, updated_at: new Date().toISOString() })
    .eq('id', usage.id);

  // For free users, check lifetime total
  if (!isSubscribed) {
    const { data: allUsage } = await supabaseAdmin
      .from('usage_tracking')
      .select('geocodes_used')
      .eq('user_id', user.id);
    const totalUsed = (allUsage || []).reduce((sum, row) => sum + (row.geocodes_used || 0), 0);

    return NextResponse.json({
      geocodes_used: totalUsed,
      geocodes_remaining: Math.max(0, FREE_LIFETIME_LIMIT - totalUsed),
      over_limit: totalUsed > FREE_LIFETIME_LIMIT,
      is_free: true,
      can_buy_overages: false,
    });
  }

  return NextResponse.json({
    geocodes_used: newUsed,
    geocodes_remaining: Math.max(0, (usage.geocodes_limit || limit) - newUsed),
    over_limit: newUsed > (usage.geocodes_limit || limit),
    is_free: false,
    can_buy_overages: true,
  });
}
