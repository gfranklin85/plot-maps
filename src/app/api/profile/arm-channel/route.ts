import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

type Channel = 'text_invite' | 'direct_mail' | 'phone_call';
const ALLOWED: Channel[] = ['text_invite', 'direct_mail', 'phone_call'];

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { channel } = (await request.json()) as { channel: Channel };
  if (!ALLOWED.includes(channel)) {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 });
  }

  await supabaseAdmin.from('profiles').update({ armed_channel: channel }).eq('id', user.id);
  return NextResponse.json({ ok: true, armed_channel: channel });
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('plot_edition, armed_channel, armed_mail_template_id')
    .eq('id', user.id)
    .single();
  return NextResponse.json({
    plot_edition: data?.plot_edition || 'lite',
    armed_channel: data?.armed_channel || null,
    armed_mail_template_id: data?.armed_mail_template_id || null,
  });
}
