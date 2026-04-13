import { NextResponse } from 'next/server';
import { getAuthUser, getTierForUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
// tier-config used via getTierForUser in auth.ts

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

async function getOrCreateUsage(userId: string, month: string, geocodeLimit: number, skipTraceLimit: number) {
  let { data } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .single();

  if (!data) {
    const { data: created } = await supabaseAdmin
      .from('usage_tracking')
      .insert({
        user_id: userId,
        month,
        geocodes_used: 0,
        geocodes_limit: geocodeLimit,
        skip_traces_used: 0,
        skip_traces_limit: skipTraceLimit,
      })
      .select()
      .single();
    data = created;
  } else {
    // Update limits if plan changed
    if (data.geocodes_limit !== geocodeLimit || data.skip_traces_limit !== skipTraceLimit) {
      await supabaseAdmin
        .from('usage_tracking')
        .update({ geocodes_limit: geocodeLimit, skip_traces_limit: skipTraceLimit })
        .eq('id', data.id);
      data.geocodes_limit = geocodeLimit;
      data.skip_traces_limit = skipTraceLimit;
    }
  }

  return data;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = await getTierForUser(user.id);
  const month = getCurrentMonth();
  const isFree = tier.key === 'free';

  if (isFree) {
    // Free user: lifetime limits across all months
    const { data: allUsage } = await supabaseAdmin
      .from('usage_tracking')
      .select('geocodes_used, skip_traces_used')
      .eq('user_id', user.id);

    const totalGeocodes = (allUsage || []).reduce((s, r) => s + (r.geocodes_used || 0), 0);
    const totalSkipTraces = (allUsage || []).reduce((s, r) => s + (r.skip_traces_used || 0), 0);

    return NextResponse.json({
      month,
      tier: tier.key,
      tier_label: tier.label,
      geocodes_used: totalGeocodes,
      geocodes_limit: tier.geocodes,
      geocodes_remaining: Math.max(0, tier.geocodes - totalGeocodes),
      skip_traces_used: totalSkipTraces,
      skip_traces_limit: tier.skipTraces,
      skip_traces_remaining: Math.max(0, tier.skipTraces - totalSkipTraces),
      is_free: true,
      can_buy_overages: false,
    });
  }

  // Subscribed user: monthly limits
  const data = await getOrCreateUsage(user.id, month, tier.geocodes, tier.skipTraces);

  return NextResponse.json({
    month: data?.month,
    tier: tier.key,
    tier_label: tier.label,
    geocodes_used: data?.geocodes_used || 0,
    geocodes_limit: tier.geocodes,
    geocodes_remaining: Math.max(0, tier.geocodes - (data?.geocodes_used || 0)),
    skip_traces_used: data?.skip_traces_used || 0,
    skip_traces_limit: tier.skipTraces,
    skip_traces_remaining: Math.max(0, tier.skipTraces - (data?.skip_traces_used || 0)),
    is_free: false,
    can_buy_overages: true,
    overage_cost_cents: tier.overageSkipTraceCents,
  });
}

// Increment usage — supports both geocodes and skip traces
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type = 'geocode', count = 1 } = await request.json();
  const month = getCurrentMonth();
  const tier = await getTierForUser(user.id);
  const isFree = tier.key === 'free';

  const data = await getOrCreateUsage(user.id, month, tier.geocodes, tier.skipTraces);
  if (!data) return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });

  if (type === 'skip_trace') {
    const newUsed = (data.skip_traces_used || 0) + count;
    await supabaseAdmin
      .from('usage_tracking')
      .update({ skip_traces_used: newUsed, updated_at: new Date().toISOString() })
      .eq('id', data.id);

    // For free users, check lifetime total
    let totalUsed = newUsed;
    if (isFree) {
      const { data: allUsage } = await supabaseAdmin
        .from('usage_tracking')
        .select('skip_traces_used')
        .eq('user_id', user.id);
      totalUsed = (allUsage || []).reduce((s, r) => s + (r.skip_traces_used || 0), 0);
    }

    return NextResponse.json({
      type: 'skip_trace',
      skip_traces_used: totalUsed,
      skip_traces_remaining: Math.max(0, tier.skipTraces - totalUsed),
      over_limit: totalUsed >= tier.skipTraces,
    });
  }

  // Default: geocode
  const newUsed = (data.geocodes_used || 0) + count;
  await supabaseAdmin
    .from('usage_tracking')
    .update({ geocodes_used: newUsed, updated_at: new Date().toISOString() })
    .eq('id', data.id);

  let totalUsed = newUsed;
  if (isFree) {
    const { data: allUsage } = await supabaseAdmin
      .from('usage_tracking')
      .select('geocodes_used')
      .eq('user_id', user.id);
    totalUsed = (allUsage || []).reduce((s, r) => s + (r.geocodes_used || 0), 0);
  }

  return NextResponse.json({
    type: 'geocode',
    geocodes_used: totalUsed,
    geocodes_remaining: Math.max(0, tier.geocodes - totalUsed),
    over_limit: totalUsed >= tier.geocodes,
  });
}
