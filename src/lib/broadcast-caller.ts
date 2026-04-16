// Twilio broadcast delivery engine
// Rate-limited: 1 call/second to avoid Twilio throttling

import Twilio from 'twilio';
import { supabaseAdmin } from './supabase-server';

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.plot.solutions';

// Delay between calls (ms) — 1 call per second
const CALL_INTERVAL_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface BroadcastCallRow {
  id: string;
  prospect_phone: string;
  twilio_call_sid: string | null;
}

/**
 * Send a broadcast to all pending call records.
 * This function should be called from the /api/broadcast/[id]/send route.
 */
export async function sendBroadcast(broadcastId: string, callerIdNumber: string): Promise<{
  total: number;
  dialed: number;
  failed: number;
}> {
  if (!TWILIO_SID || !TWILIO_AUTH) throw new Error('Twilio credentials not configured');

  const client = Twilio(TWILIO_SID, TWILIO_AUTH);

  // Load pending calls
  const { data: calls, error } = await supabaseAdmin
    .from('broadcast_calls')
    .select('id, prospect_phone, twilio_call_sid')
    .eq('broadcast_id', broadcastId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !calls) throw new Error(`Failed to load calls: ${error?.message}`);

  const total = calls.length;
  let dialed = 0;
  let failed = 0;

  const twimlUrl = `${APP_URL}/api/broadcast/twiml?broadcast_id=${broadcastId}`;
  const statusUrl = `${APP_URL}/api/broadcast/status`;

  for (const call of calls as BroadcastCallRow[]) {
    try {
      // Mark as dialing
      await supabaseAdmin
        .from('broadcast_calls')
        .update({ status: 'dialing' })
        .eq('id', call.id);

      // Initiate the call
      const twilioCall = await client.calls.create({
        to: call.prospect_phone,
        from: callerIdNumber,
        url: `${twimlUrl}&call_sid=${call.prospect_phone}`,
        statusCallback: statusUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        machineDetection: 'DetectMessageEnd', // voicemail detection
        timeout: 20, // ring for 20 seconds max
      });

      // Update with Twilio SID
      await supabaseAdmin
        .from('broadcast_calls')
        .update({ twilio_call_sid: twilioCall.sid })
        .eq('id', call.id);

      dialed++;
    } catch (err) {
      console.error(`Broadcast call failed for ${call.prospect_phone}:`, err);
      await supabaseAdmin
        .from('broadcast_calls')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', call.id);
      failed++;
    }

    // Rate limit: 1 call per second
    if (dialed + failed < total) {
      await delay(CALL_INTERVAL_MS);
    }
  }

  return { total, dialed, failed };
}
