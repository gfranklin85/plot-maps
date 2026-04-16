import { NextResponse } from 'next/server';
import { getAuthUser, getBillingContext } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { sendBroadcast } from '@/lib/broadcast-caller';

interface ProspectInput {
  phone: string;
  name?: string;
  address?: string;
  leadId?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: broadcastId } = await params;
  const body = await request.json();
  const { prospects, callerIdNumber } = body as { prospects: ProspectInput[]; callerIdNumber?: string };

  if (!prospects || prospects.length === 0) {
    return NextResponse.json({ error: 'prospects required' }, { status: 400 });
  }

  // Verify broadcast ownership + ready status
  const { data: broadcast } = await supabaseAdmin
    .from('broadcasts')
    .select('id, user_id, status, audio_url')
    .eq('id', broadcastId)
    .single();

  if (!broadcast || broadcast.user_id !== user.id) {
    return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
  }

  if (!broadcast.audio_url) {
    return NextResponse.json({ error: 'Audio not generated yet. Generate audio first.' }, { status: 400 });
  }

  if (!['ready', 'paused'].includes(broadcast.status)) {
    return NextResponse.json({ error: `Cannot send — broadcast status is "${broadcast.status}"` }, { status: 400 });
  }

  // Get caller ID — use user's Twilio number or provided number
  let fromNumber = callerIdNumber;
  if (!fromNumber) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('twilio_phone_number')
      .eq('id', user.id)
      .single();
    fromNumber = profile?.twilio_phone_number;
  }

  if (!fromNumber) {
    return NextResponse.json({ error: 'No caller ID number. Set up your phone number in Settings first.' }, { status: 400 });
  }

  // Check billing (admins bypass)
  const { tier, isAdmin } = await getBillingContext(user.id);

  if (!isAdmin) {
    // TODO: check broadcast_calls_used vs tier.broadcastCallsPerMonth
    // For now, just ensure they have a subscription
    if (tier.key === 'free') {
      return NextResponse.json({
        error: 'Broadcasts require a subscription.',
        upgrade: true,
      }, { status: 402 });
    }
  }

  // Create broadcast_calls rows
  const callRows = prospects.map(p => ({
    broadcast_id: broadcastId,
    user_id: user.id,
    prospect_phone: p.phone,
    prospect_name: p.name || null,
    prospect_address: p.address || null,
    lead_id: p.leadId || null,
    status: 'pending' as const,
  }));

  const { error: insertErr } = await supabaseAdmin
    .from('broadcast_calls')
    .insert(callRows);

  if (insertErr) {
    return NextResponse.json({ error: `Failed to create call records: ${insertErr.message}` }, { status: 500 });
  }

  // Update broadcast status + total count
  await supabaseAdmin
    .from('broadcasts')
    .update({
      status: 'sending',
      total_calls: prospects.length,
      sent_at: new Date().toISOString(),
    })
    .eq('id', broadcastId);

  // Start sending (async — don't await, let it run in background)
  // In production, this should be a queue worker. For now, fire-and-forget.
  sendBroadcast(broadcastId, fromNumber).catch(err => {
    console.error('Broadcast send error:', err);
    supabaseAdmin
      .from('broadcasts')
      .update({ status: 'failed' })
      .eq('id', broadcastId);
  });

  return NextResponse.json({
    success: true,
    broadcast_id: broadcastId,
    total_calls: prospects.length,
    estimated_duration_minutes: Math.ceil(prospects.length / 60), // 1 call/sec
    estimated_cost: `$${(prospects.length * 0.03).toFixed(2)}`, // ~$0.03/call
  });
}
