import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { hashScript } from '@/lib/elevenlabs';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('broadcasts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const {
    name,
    type = 'circle_prospecting',
    reference_pack,
    script_text,
    cta_enabled = true,
    audio_url,
    audio_duration_seconds,
  } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  if (!reference_pack) return NextResponse.json({ error: 'reference_pack required' }, { status: 400 });
  if (!script_text?.trim()) return NextResponse.json({ error: 'script_text required' }, { status: 400 });

  const scriptHash = hashScript(script_text);
  const hasPreGeneratedAudio = typeof audio_url === 'string' && audio_url.length > 0;

  const { data, error } = await supabaseAdmin
    .from('broadcasts')
    .insert({
      user_id: user.id,
      name: name.trim(),
      type,
      reference_pack,
      script_text: script_text.trim(),
      script_hash: scriptHash,
      cta_enabled,
      status: hasPreGeneratedAudio ? 'ready' : 'draft',
      audio_url: hasPreGeneratedAudio ? audio_url : null,
      audio_duration_seconds: hasPreGeneratedAudio ? (audio_duration_seconds || null) : null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
