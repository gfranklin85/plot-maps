import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

const INTENT_MAP: Record<string, string> = {
  '1': 'curious',
  '2': 'future_seller',
  '3': 'not_interested',
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const broadcastId = url.searchParams.get('broadcast_id');
  const callSid = url.searchParams.get('call_sid');

  // Parse Twilio's form data
  const formData = await request.formData();
  const digits = formData.get('Digits')?.toString() || '';

  if (!broadcastId || !callSid) {
    return new Response('<Response><Say>Thank you.</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const intent = INTENT_MAP[digits] || null;

  // Update the broadcast call record
  if (digits) {
    await supabaseAdmin
      .from('broadcast_calls')
      .update({
        dtmf_response: digits,
        intent,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('twilio_call_sid', callSid);

    // Increment broadcast summary counts
    const countCol = digits === '1' ? 'total_press_1'
      : digits === '2' ? 'total_press_2'
      : digits === '3' ? 'total_press_3'
      : null;

    if (countCol) {
      // Use RPC for atomic increment — fallback to read-then-write
      const { data: broadcast } = await supabaseAdmin
        .from('broadcasts')
        .select(countCol)
        .eq('id', broadcastId)
        .single();

      if (broadcast) {
        await supabaseAdmin
          .from('broadcasts')
          .update({ [countCol]: ((broadcast as Record<string, number>)[countCol] || 0) + 1 })
          .eq('id', broadcastId);
      }
    }
  }

  // Thank them and hang up
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you. Have a great day.</Say>
</Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
