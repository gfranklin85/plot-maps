import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadId, phoneNumber, leadName } = await request.json();

    if (!leadId || !phoneNumber) {
      return NextResponse.json(
        { error: 'leadId and phoneNumber are required' },
        { status: 400 }
      );
    }

    // Get the user's own provisioned Twilio number and personal phone
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('twilio_phone_number, phone')
      .eq('id', user.id)
      .single();

    const twilioNumber = profile?.twilio_phone_number;
    if (!twilioNumber) {
      return NextResponse.json(
        { error: 'No phone number provisioned. Set up your number in Settings first.' },
        { status: 403 }
      );
    }

    const userPhone = profile?.phone;
    if (!userPhone) {
      return NextResponse.json(
        { error: 'No personal phone number set. Add your phone in Settings.' },
        { status: 400 }
      );
    }

    // Build TwiML that says a brief message then dials the prospect
    const displayName = leadName || 'the prospect';
    const twiml = `<Response><Say voice="alice">Connecting to ${displayName}.</Say><Dial callerId="${twilioNumber}">${phoneNumber}</Dial></Response>`;

    // Create the call: Twilio calls the USER first, then executes the TwiML
    const call = await client.calls.create({
      to: userPhone,
      from: twilioNumber,
      twiml,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'}/api/call/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    // Log the call initiation
    await supabaseAdmin.from('activities').insert({
      lead_id: leadId,
      user_id: user.id,
      type: 'call',
      title: `Call initiated to ${displayName}`,
      description: `Outbound call to ${phoneNumber}`,
      metadata: {
        call_sid: call.sid,
        phone_number: phoneNumber,
        direction: 'outbound',
      },
    });

    return NextResponse.json({ callSid: call.sid, status: call.status });
  } catch (error: unknown) {
    console.error('Call initiation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to initiate call';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
