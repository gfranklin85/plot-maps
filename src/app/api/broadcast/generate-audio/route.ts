import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { generateSpeech, validateBroadcastLength, estimateDuration, hashScript } from '@/lib/elevenlabs';
import { generateVoicemailScript } from '@/lib/broadcast-scripts';

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { broadcastId } = await request.json();
  if (!broadcastId) return NextResponse.json({ error: 'broadcastId required' }, { status: 400 });

  // Load broadcast
  const { data: broadcast, error: loadErr } = await supabaseAdmin
    .from('broadcasts')
    .select('*')
    .eq('id', broadcastId)
    .eq('user_id', user.id)
    .single();

  if (loadErr || !broadcast) return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });

  // Validate script length
  const validation = validateBroadcastLength(broadcast.script_text);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error, ...validation }, { status: 400 });
  }

  // Check audio cache by script hash
  const scriptHash = hashScript(broadcast.script_text);
  if (broadcast.audio_url && broadcast.script_hash === scriptHash) {
    return NextResponse.json({
      audio_url: broadcast.audio_url,
      duration_seconds: broadcast.audio_duration_seconds,
      cached: true,
    });
  }

  await supabaseAdmin
    .from('broadcasts')
    .update({ status: 'generating_audio' })
    .eq('id', broadcastId);

  try {
    // Generate main audio
    const mainAudio = await generateSpeech({ text: broadcast.script_text });
    const mainDuration = estimateDuration(broadcast.script_text);

    // Upload to Supabase Storage
    const mainPath = `broadcasts/${user.id}/${broadcastId}/main.mp3`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('audio')
      .upload(mainPath, mainAudio, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: mainUrl } = supabaseAdmin.storage
      .from('audio')
      .getPublicUrl(mainPath);

    // Generate voicemail version (shorter)
    let vmUrl: string | null = null;
    let vmDuration: number | null = null;
    if (broadcast.cta_enabled) {
      const vmScript = generateVoicemailScript(broadcast.reference_pack);
      const vmAudio = await generateSpeech({ text: vmScript });
      vmDuration = estimateDuration(vmScript);

      const vmPath = `broadcasts/${user.id}/${broadcastId}/voicemail.mp3`;
      await supabaseAdmin.storage
        .from('audio')
        .upload(vmPath, vmAudio, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      const { data: vmPublicUrl } = supabaseAdmin.storage
        .from('audio')
        .getPublicUrl(vmPath);
      vmUrl = vmPublicUrl.publicUrl;
    }

    // Update broadcast record
    await supabaseAdmin
      .from('broadcasts')
      .update({
        audio_url: mainUrl.publicUrl,
        audio_duration_seconds: mainDuration,
        voicemail_audio_url: vmUrl,
        voicemail_duration_seconds: vmDuration,
        script_hash: scriptHash,
        status: 'ready',
      })
      .eq('id', broadcastId);

    return NextResponse.json({
      audio_url: mainUrl.publicUrl,
      duration_seconds: mainDuration,
      voicemail_audio_url: vmUrl,
      voicemail_duration_seconds: vmDuration,
      cached: false,
    });
  } catch (err) {
    console.error('Audio generation error:', err);
    await supabaseAdmin
      .from('broadcasts')
      .update({ status: 'failed' })
      .eq('id', broadcastId);
    const message = err instanceof Error ? err.message : 'Audio generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
