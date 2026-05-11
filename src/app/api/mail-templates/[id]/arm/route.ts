import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// POST — set this template as the user's armed mail template.
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  // Verify ownership
  const { data: tmpl } = await supabaseAdmin
    .from('mail_templates')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!tmpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  await supabaseAdmin.from('profiles').update({ armed_mail_template_id: id }).eq('id', user.id);

  // Maintain is_default flag for UI clarity
  await supabaseAdmin.from('mail_templates').update({ is_default: false }).eq('user_id', user.id);
  await supabaseAdmin
    .from('mail_templates')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id);

  return NextResponse.json({ ok: true });
}
