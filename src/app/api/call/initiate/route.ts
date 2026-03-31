import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { supabaseAdmin } from '@/lib/supabase-server';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

const USER_PHONE = process.env.USER_PHONE || '+15595551234';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || USER_PHONE;

export async function POST(request: Request) {
  try {
    const { leadId, phoneNumber, leadName } = await request.json();

    if (!leadId || !phoneNumber) {
      return NextResponse.json(
        { error: 'leadId and phoneNumber are required' },
        { status: 400 }
      );
    }

    // Build TwiML that says a brief message then dials the prospect
    const displayName = leadName || 'the prospect';
    const twiml = `<Response><Say voice="alice">Connecting to ${displayName}.</Say><Dial callerId="${TWILIO_PHONE_NUMBER}">${phoneNumber}</Dial></Response>`;

    // Create the call: Twilio calls the USER first, then executes the TwiML
    const call = await client.calls.create({
      to: USER_PHONE,
      from: TWILIO_PHONE_NUMBER,
      twiml,
      statusCallback: `${process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000'}/api/call/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
    });

    // Log the call initiation to activities
    await supabaseAdmin.from('activities').insert({
      lead_id: leadId,
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
