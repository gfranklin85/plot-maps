import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

const FREE_AUTO_TARGET_LIMIT = 10;

async function isSubscribed(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .single();
  return data?.subscription_status === 'active';
}

async function getCredits(userId: string) {
  const subscribed = await isSubscribed(userId);
  if (subscribed) {
    return { allowed: true, used: 0, limit: -1, is_free: false };
  }

  const { count } = await supabaseAdmin
    .from('auto_target_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('status', 'cancelled');

  const used = count || 0;
  return {
    allowed: used < FREE_AUTO_TARGET_LIMIT,
    used,
    limit: FREE_AUTO_TARGET_LIMIT,
    is_free: true,
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
    credits_remaining: credits.is_free ? credits.limit - credits.used : -1,
    is_free: credits.is_free,
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

  // Credit check
  const credits = await getCredits(user.id);
  if (!credits.allowed) {
    return NextResponse.json({
      error: 'limit_reached',
      used: credits.used,
      limit: credits.limit,
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

  return NextResponse.json({
    id: req.id,
    status: req.status,
    credits_used: credits.used + 1,
    credits_remaining: credits.is_free ? credits.limit - credits.used - 1 : -1,
  });
}
