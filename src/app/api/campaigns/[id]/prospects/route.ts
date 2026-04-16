import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify campaign ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('campaign_prospects')
    .select('*, lead:leads(*)')
    .eq('campaign_id', id)
    .order('priority', { ascending: false })
    .order('call_order', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Verify campaign ownership
  const { data: campaign } = await supabaseAdmin
    .from('campaigns')
    .select('id, reference_lead_ids')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const {
    lead_ids,
    radius_miles,
    center_lat,
    center_lng,
  }: {
    lead_ids?: string[];
    radius_miles?: number;
    center_lat?: number;
    center_lng?: number;
  } = body;

  let prospectLeadIds: string[] = [];

  if (lead_ids && lead_ids.length > 0) {
    prospectLeadIds = lead_ids;
  } else if (radius_miles && center_lat && center_lng) {
    // Radius-based: find leads with phone numbers near the center point
    const degLat = radius_miles / 69;
    const degLng = radius_miles / (69 * Math.cos(center_lat * Math.PI / 180));

    const { data: nearby } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('user_id', user.id)
      .not('phone', 'is', null)
      .is('listing_status', null) // exclude MLS reference records
      .gte('latitude', center_lat - degLat)
      .lte('latitude', center_lat + degLat)
      .gte('longitude', center_lng - degLng)
      .lte('longitude', center_lng + degLng)
      .limit(500);

    prospectLeadIds = (nearby || []).map((l) => l.id);
  }

  if (prospectLeadIds.length === 0) {
    return NextResponse.json({ error: 'No prospects found' }, { status: 400 });
  }

  // Exclude reference properties from prospect list
  const refIds = new Set(campaign.reference_lead_ids || []);
  prospectLeadIds = prospectLeadIds.filter((lid) => !refIds.has(lid));

  // Upsert to avoid duplicates
  const rows = prospectLeadIds.map((lead_id, i) => ({
    campaign_id: id,
    lead_id,
    call_order: i + 1,
    call_status: 'pending',
    priority: 0,
  }));

  const { error: insertError } = await supabaseAdmin
    .from('campaign_prospects')
    .upsert(rows, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update denormalized count
  const { count } = await supabaseAdmin
    .from('campaign_prospects')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', id);

  await supabaseAdmin
    .from('campaigns')
    .update({ total_prospects: count || 0, updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({
    added: prospectLeadIds.length,
    total: count || 0,
  });
}
