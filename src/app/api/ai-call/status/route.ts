import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getCall } from '@/lib/vapi';

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: aiCall } = await supabaseAdmin
    .from('ai_calls')
    .select('id, user_id, vapi_call_id, status, duration_seconds, transcript, summary, outcome')
    .eq('id', id)
    .single();

  if (!aiCall) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (aiCall.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // If already ended in our DB, return what we have
  if (aiCall.status === 'ended') {
    return NextResponse.json({
      id: aiCall.id,
      status: aiCall.status,
      duration_seconds: aiCall.duration_seconds,
      transcript: aiCall.transcript,
      summary: aiCall.summary,
      outcome: aiCall.outcome,
    });
  }

  // Otherwise fetch the latest from VAPI
  if (!aiCall.vapi_call_id) {
    return NextResponse.json({
      id: aiCall.id,
      status: aiCall.status,
      duration_seconds: 0,
      transcript: null,
    });
  }

  try {
    const vapiCall = await getCall(aiCall.vapi_call_id);
    return NextResponse.json({
      id: aiCall.id,
      status: vapiCall.status,
      duration_seconds: vapiCall.startedAt && vapiCall.endedAt
        ? Math.round((new Date(vapiCall.endedAt).getTime() - new Date(vapiCall.startedAt).getTime()) / 1000)
        : vapiCall.startedAt
          ? Math.round((Date.now() - new Date(vapiCall.startedAt).getTime()) / 1000)
          : 0,
      transcript: vapiCall.transcript || null,
      summary: vapiCall.summary || null,
      ended_reason: vapiCall.endedReason || null,
    });
  } catch {
    // VAPI query failed — return what we have from DB
    return NextResponse.json({
      id: aiCall.id,
      status: aiCall.status,
      duration_seconds: aiCall.duration_seconds,
      transcript: aiCall.transcript,
    });
  }
}
