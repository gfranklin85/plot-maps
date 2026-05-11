import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('mail_templates')
    .select('id, name, body_text, variables, is_default, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data || [] });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name, body_text, variables } = (await request.json()) as {
    name: string;
    body_text: string;
    variables?: unknown;
  };
  if (!name || !body_text) {
    return NextResponse.json({ error: 'name and body_text required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('mail_templates')
    .insert({
      user_id: user.id,
      name,
      body_text,
      variables: variables || null,
    })
    .select('id, name, body_text, variables, is_default')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
