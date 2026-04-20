import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { generateSpeech, estimateDuration, validateBroadcastLength } from '@/lib/elevenlabs';
import { getVoice } from '@/lib/voice-catalog';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('commercials')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, script, voiceId } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!script?.trim()) return NextResponse.json({ error: 'script required' }, { status: 400 });

  const voice = voiceId ? getVoice(voiceId) : undefined;
  if (!voice) return NextResponse.json({ error: 'unknown voice' }, { status: 400 });

  const validation = validateBroadcastLength(script);
  if (!validation.valid) return NextResponse.json({ error: validation.error, ...validation }, { status: 400 });

  try {
    const audio = await generateSpeech({ text: script, voiceId: voice.id });
    const duration = estimateDuration(script);

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('commercials')
      .insert({
        user_id: user.id,
        name: name.trim(),
        script_text: script.trim(),
        voice_id: voice.id,
        voice_label: voice.label,
        audio_duration_seconds: duration,
        audio_url: '',
      })
      .select('*')
      .single();

    if (insertErr || !inserted) throw new Error(insertErr?.message || 'insert failed');

    const path = `commercials/${user.id}/${inserted.id}.mp3`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('audio')
      .upload(path, audio, { contentType: 'audio/mpeg', upsert: true });

    if (uploadErr) {
      await supabaseAdmin.from('commercials').delete().eq('id', inserted.id);
      throw new Error(`Upload failed: ${uploadErr.message}`);
    }

    const { data: publicUrl } = supabaseAdmin.storage.from('audio').getPublicUrl(path);

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('commercials')
      .update({ audio_url: publicUrl.publicUrl })
      .eq('id', inserted.id)
      .select('*')
      .single();

    if (updateErr || !updated) throw new Error(updateErr?.message || 'update failed');

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
