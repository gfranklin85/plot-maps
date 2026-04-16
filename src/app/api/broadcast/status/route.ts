import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// Twilio status callback — updates broadcast_calls with final call status.
export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get('CallSid')?.toString() || '';
  const callStatus = formData.get('CallStatus')?.toString() || '';
  const callDuration = parseInt(formData.get('CallDuration')?.toString() || '0');

  if (!callSid) return NextResponse.json({ ok: true });

  // Map Twilio status to our status
  const statusMap: Record<string, string> = {
    queued: 'pending',
    ringing: 'dialing',
    'in-progress': 'answered',
    completed: 'completed',
    busy: 'busy',
    'no-answer': 'no_answer',
    failed: 'failed',
    canceled: 'failed',
  };

  const mappedStatus = statusMap[callStatus] || callStatus;
  const isTerminal = ['completed', 'busy', 'no_answer', 'failed'].includes(mappedStatus);

  // Update the call record
  const update: Record<string, unknown> = {
    status: mappedStatus,
    actual_duration_seconds: callDuration,
  };

  if (isTerminal) {
    update.completed_at = new Date().toISOString();
    update.heard_audio = callDuration >= 6;
  }

  if (mappedStatus === 'answered') {
    update.answered_at = new Date().toISOString();
  }

  // Idempotent: use twilio_call_sid as the unique key
  const { data: call } = await supabaseAdmin
    .from('broadcast_calls')
    .update(update)
    .eq('twilio_call_sid', callSid)
    .select('broadcast_id, status')
    .single();

  // If terminal, update broadcast summary
  if (call && isTerminal) {
    const broadcastId = call.broadcast_id;

    // Update answered count
    if (mappedStatus === 'completed' || callDuration > 0) {
      const { data: broadcast } = await supabaseAdmin
        .from('broadcasts')
        .select('total_answered, total_heard')
        .eq('id', broadcastId)
        .single();

      if (broadcast) {
        const updates: Record<string, number> = {};
        if (callDuration > 0) updates.total_answered = (broadcast.total_answered || 0) + 1;
        if (callDuration >= 6) updates.total_heard = (broadcast.total_heard || 0) + 1;
        if (Object.keys(updates).length > 0) {
          await supabaseAdmin.from('broadcasts').update(updates).eq('id', broadcastId);
        }
      }
    }

    // Check if all calls in this broadcast are terminal
    const { count: pendingCount } = await supabaseAdmin
      .from('broadcast_calls')
      .select('id', { count: 'exact', head: true })
      .eq('broadcast_id', broadcastId)
      .in('status', ['pending', 'dialing', 'answered']);

    if (pendingCount === 0) {
      await supabaseAdmin
        .from('broadcasts')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', broadcastId);
    }
  }

  return NextResponse.json({ ok: true });
}
