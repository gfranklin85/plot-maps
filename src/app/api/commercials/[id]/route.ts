import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: commercial, error: loadErr } = await supabaseAdmin
    .from('commercials')
    .select('id, user_id')
    .eq('id', params.id)
    .single();

  if (loadErr || !commercial) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (commercial.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabaseAdmin.storage.from('audio').remove([`commercials/${user.id}/${params.id}.mp3`]);

  const { error: delErr } = await supabaseAdmin
    .from('commercials')
    .delete()
    .eq('id', params.id);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
