import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { generateSpeech, validateBroadcastLength } from '@/lib/elevenlabs';
import { getVoice } from '@/lib/voice-catalog';

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { script, voiceId, skipLengthCheck } = await request.json();
  if (!script?.trim()) return NextResponse.json({ error: 'script required' }, { status: 400 });
  if (!voiceId || !getVoice(voiceId)) return NextResponse.json({ error: 'unknown voice' }, { status: 400 });

  if (!skipLengthCheck) {
    const validation = validateBroadcastLength(script);
    if (!validation.valid) return NextResponse.json({ error: validation.error, ...validation }, { status: 400 });
  }

  try {
    const audio = await generateSpeech({ text: script, voiceId });
    return new NextResponse(audio as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
