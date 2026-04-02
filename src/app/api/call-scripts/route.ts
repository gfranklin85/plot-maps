import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('call_scripts')
    .select('*')
    .order('category');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { category, questions } = body;

  if (!category || !questions) {
    return NextResponse.json({ error: 'category and questions are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('call_scripts')
    .upsert(
      { category, questions, updated_at: new Date().toISOString() },
      { onConflict: 'category' }
    )
    .select()
    .single();

  if (error) {
    // If upsert on category fails (no unique constraint), try insert
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('call_scripts')
      .insert({ category, questions })
      .select()
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    return NextResponse.json(insertData);
  }

  return NextResponse.json(data);
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, questions } = body;

  if (!id || !questions) {
    return NextResponse.json({ error: 'id and questions are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('call_scripts')
    .update({ questions, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('call_scripts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
