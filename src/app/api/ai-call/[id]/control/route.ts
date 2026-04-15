import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { endCall, injectMessage, transferCall } from '@/lib/vapi';

type Action = 'hangup' | 'inject' | 'transfer' | 'takeover';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const action = body.action as Action;
  const payload = body.payload as Record<string, unknown> | undefined;

  // Load the call and verify ownership
  const { data: aiCall } = await supabaseAdmin
    .from('ai_calls')
    .select('id, user_id, vapi_call_id, status')
    .eq('id', id)
    .single();

  if (!aiCall) return NextResponse.json({ error: 'Call not found' }, { status: 404 });
  if (aiCall.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!aiCall.vapi_call_id) return NextResponse.json({ error: 'Call not yet connected' }, { status: 400 });

  try {
    switch (action) {
      case 'hangup': {
        await endCall(aiCall.vapi_call_id);
        return NextResponse.json({ ok: true });
      }

      case 'inject': {
        const message = (payload?.message as string) || '';
        if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });
        await injectMessage(aiCall.vapi_call_id, message);
        return NextResponse.json({ ok: true });
      }

      case 'transfer': {
        const destination = (payload?.destination as string) || '';
        if (!destination) return NextResponse.json({ error: 'destination required' }, { status: 400 });
        await transferCall(aiCall.vapi_call_id, destination);
        return NextResponse.json({ ok: true });
      }

      case 'takeover': {
        // Takeover = bridging phrase + transfer to the user's provisioned number
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('twilio_phone_number')
          .eq('id', user.id)
          .single();

        const destination = profile?.twilio_phone_number;
        if (!destination) {
          return NextResponse.json({
            error: 'no_phone',
            message: 'Set up your Twilio phone number in Settings before using Jump In.',
          }, { status: 400 });
        }

        // Have the AI say a bridging phrase, then transfer
        await injectMessage(
          aiCall.vapi_call_id,
          "Let me put my agent on the line real quick — one moment.",
        );
        // Small delay before transferring so the message plays
        await new Promise((r) => setTimeout(r, 1200));
        await transferCall(aiCall.vapi_call_id, destination);

        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Control action failed';
    console.error(`AI call control ${action} error:`, err);
    return NextResponse.json({ error: 'control_failed', message }, { status: 500 });
  }
}
