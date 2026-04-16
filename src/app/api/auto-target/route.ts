import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const FREE_LIFETIME_LIMIT = 5;
const STARTER_MONTHLY_LIMIT = 15;
const PRO_MONTHLY_LIMIT = 40;
const OVERAGE_COST_DOLLARS = 2; // $2 per extra request

const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '';

async function getSubscriptionInfo(userId: string) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status, stripe_price_id, is_admin')
    .eq('id', userId)
    .single();

  const isActive = data?.subscription_status === 'active';
  const isPro = isActive && data?.stripe_price_id === PRO_PRICE_ID;
  const isAdmin = !!data?.is_admin;
  return { isActive, isPro, isAdmin };
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // '2026-04'
}

async function getCredits(userId: string) {
  const { isActive, isPro, isAdmin } = await getSubscriptionInfo(userId);

  if (isAdmin) {
    return {
      allowed: true,
      used: 0,
      limit: Number.MAX_SAFE_INTEGER,
      included_remaining: Number.MAX_SAFE_INTEGER,
      is_overage: false,
      overage_cost: 0,
      is_free: false,
      can_buy_more: true,
      plan: 'admin',
    };
  }

  if (isActive) {
    // Paid user: monthly included limit + unlimited overages at $2/ea
    const monthlyLimit = isPro ? PRO_MONTHLY_LIMIT : STARTER_MONTHLY_LIMIT;
    const month = getCurrentMonth();
    const startOfMonth = `${month}-01T00:00:00.000Z`;

    const { count } = await supabaseAdmin
      .from('auto_target_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'cancelled')
      .gte('created_at', startOfMonth);

    const used = count || 0;
    const included_remaining = Math.max(0, monthlyLimit - used);
    return {
      allowed: true, // paid users can always submit — overages charged
      used,
      limit: monthlyLimit,
      included_remaining,
      is_overage: used >= monthlyLimit,
      overage_cost: OVERAGE_COST_DOLLARS,
      is_free: false,
      can_buy_more: true,
      plan: isPro ? 'pro' : 'starter',
    };
  }

  // Free user: lifetime limit, no overages
  const { count } = await supabaseAdmin
    .from('auto_target_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'cancelled');

  const used = count || 0;
  return {
    allowed: used < FREE_LIFETIME_LIMIT,
    used,
    limit: FREE_LIFETIME_LIMIT,
    included_remaining: Math.max(0, FREE_LIFETIME_LIMIT - used),
    is_overage: false,
    overage_cost: 0,
    is_free: true,
    can_buy_more: false,
    plan: 'free',
  };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: requests } = await supabaseAdmin
    .from('auto_target_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const credits = await getCredits(user.id);

  return NextResponse.json({
    requests: requests || [],
    credits_used: credits.used,
    credits_limit: credits.limit,
    credits_remaining: credits.included_remaining,
    is_free: credits.is_free,
    is_overage: credits.is_overage,
    overage_cost: credits.overage_cost,
    can_buy_more: credits.can_buy_more,
    plan: credits.plan,
  });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { referenceLeadId, radius = 0.25 } = body;

  if (!referenceLeadId) {
    return NextResponse.json({ error: 'referenceLeadId required' }, { status: 400 });
  }

  // Look up reference lead
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, property_address, latitude, longitude')
    .eq('id', referenceLeadId)
    .single();

  if (!lead || lead.latitude == null || lead.longitude == null) {
    return NextResponse.json({ error: 'Reference lead not found or missing coordinates' }, { status: 404 });
  }

  // Credit check — free users blocked at limit, paid users get overages
  const credits = await getCredits(user.id);
  if (!credits.allowed) {
    return NextResponse.json({
      error: 'limit_reached',
      used: credits.used,
      limit: credits.limit,
      can_buy_more: credits.can_buy_more,
    }, { status: 403 });
  }

  // Duplicate check — same user + same reference + pending/processing
  const { data: existing } = await supabaseAdmin
    .from('auto_target_requests')
    .select('id')
    .eq('user_id', user.id)
    .eq('reference_lead_id', referenceLeadId)
    .in('status', ['pending', 'processing'])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Request already pending for this property' }, { status: 409 });
  }

  // Insert request
  const { data: req, error } = await supabaseAdmin
    .from('auto_target_requests')
    .insert({
      user_id: user.id,
      reference_lead_id: referenceLeadId,
      reference_address: lead.property_address || 'Unknown',
      reference_lat: lead.latitude,
      reference_lng: lead.longitude,
      radius_miles: radius,
    })
    .select('id, status, created_at')
    .single();

  if (error) {
    console.error('Auto-target insert error:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }

  const newRemaining = Math.max(0, credits.included_remaining - 1);
  return NextResponse.json({
    id: req.id,
    status: req.status,
    credits_used: credits.used + 1,
    credits_remaining: newRemaining,
    is_overage: credits.is_overage,
    overage_cost: credits.is_overage ? credits.overage_cost : 0,
    is_free: credits.is_free,
  });
}
