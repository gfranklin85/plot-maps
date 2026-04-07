import { NextResponse } from 'next/server';
import twilio from 'twilio';

// This endpoint is called BY Twilio when the browser SDK initiates a call.
// It returns TwiML instructions telling Twilio how to connect the call.
// NO auth check — Twilio is the caller, not the user's browser.

export async function POST(request: Request) {
  const formData = await request.formData();
  const to = formData.get('To') as string;
  const callerId = formData.get('callerId') as string;
  if (!callerId) {
    const twimlErr = new twilio.twiml.VoiceResponse();
    twimlErr.say('No caller ID configured. Please set up your phone number in settings.');
    return new NextResponse(twimlErr.toString(), { headers: { 'Content-Type': 'text/xml' } });
  }

  const twiml = new twilio.twiml.VoiceResponse();

  if (to) {
    const dial = twiml.dial({ callerId });
    dial.number(to);
  } else {
    twiml.say('No phone number provided.');
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
