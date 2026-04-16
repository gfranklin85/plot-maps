import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// TwiML endpoint — Twilio calls this when a broadcast call is answered.
// Returns XML that plays the audio and optionally gathers DTMF input.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const broadcastId = url.searchParams.get('broadcast_id');
  const callSid = url.searchParams.get('call_sid');
  const isVoicemail = url.searchParams.get('voicemail') === 'true';

  if (!broadcastId) {
    return new Response('<Response><Say>Sorry, something went wrong.</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Load broadcast
  const { data: broadcast } = await supabaseAdmin
    .from('broadcasts')
    .select('audio_url, voicemail_audio_url, cta_enabled')
    .eq('id', broadcastId)
    .single();

  if (!broadcast?.audio_url) {
    return new Response('<Response><Say>Sorry, this broadcast is not ready.</Say></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // Mark call as answered
  if (callSid) {
    await supabaseAdmin
      .from('broadcast_calls')
      .update({ status: 'answered', answered_at: new Date().toISOString() })
      .eq('twilio_call_sid', callSid);
  }

  const audioUrl = isVoicemail && broadcast.voicemail_audio_url
    ? broadcast.voicemail_audio_url
    : broadcast.audio_url;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions';
  const dtmfUrl = `${appUrl}/api/broadcast/dtmf?broadcast_id=${broadcastId}&call_sid=${callSid || ''}`;

  let twiml: string;

  if (broadcast.cta_enabled && !isVoicemail) {
    // Play audio, then gather 1 digit with 5-second timeout
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Gather numDigits="1" timeout="5" action="${dtmfUrl}" method="POST">
  </Gather>
</Response>`;
  } else {
    // Just play audio and hang up
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
</Response>`;
  }

  return new Response(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// Also support GET for Twilio's initial fetch
export async function GET(request: Request) {
  return POST(request);
}
