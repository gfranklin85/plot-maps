import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const callSid = formData.get('CallSid') as string;
    const callStatus = formData.get('CallStatus') as string;
    const callDuration = formData.get('CallDuration') as string | null;

    if (!callSid) {
      return NextResponse.json({ error: 'Missing CallSid' }, { status: 400 });
    }

    // If the call is completed, update the activity record with duration
    if (callStatus === 'completed' && callDuration) {
      const { error } = await supabaseAdmin
        .from('activities')
        .update({
          metadata: {
            call_sid: callSid,
            call_status: callStatus,
            call_duration: parseInt(callDuration, 10),
          },
        })
        .eq('metadata->>call_sid', callSid);

      if (error) {
        console.error('Failed to update activity for call status:', error);
      }
    }

    // Twilio expects a 200 response
    return new NextResponse('OK', { status: 200 });
  } catch (error: unknown) {
    console.error('Call status webhook error:', error);
    // Still return 200 so Twilio doesn't retry
    return new NextResponse('OK', { status: 200 });
  }
}
