import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const apiKey = process.env.TWILIO_API_KEY!;
  const apiSecret = process.env.TWILIO_API_SECRET!;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID!;

  if (!apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 });
  }

  // Get user's provisioned number for caller ID
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('twilio_phone_number')
    .eq('id', user.id)
    .single();

  const identity = user.id;

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl: 3600,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: false,
  });

  token.addGrant(voiceGrant);

  return NextResponse.json({
    token: token.toJwt(),
    identity,
    twilioNumber: profile?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER || null,
  });
}
