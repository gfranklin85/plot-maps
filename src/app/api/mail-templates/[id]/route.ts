import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const updates = (await request.json()) as {
    name?: string;
    body_text?: string;
    variables?: unknown;
  };

  const { data, error } = await supabaseAdmin
    .from('mail_templates')
    .update({
      name: updates.name,
      body_text: updates.body_text,
      variables: updates.variables,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, name, body_text, variables, is_default')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;

  const { error } = await supabaseAdmin
    .from('mail_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
