import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET responses for a specific lead
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get('leadId');

  if (!leadId) {
    return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('call_responses')
    .select('*')
    .eq('user_id', user.id)
    .eq('lead_id', leadId)
    .order('call_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Save responses from a call
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { leadId, scriptId, responses } = body;

  if (!leadId || !responses || !Array.isArray(responses)) {
    return NextResponse.json({ error: 'leadId and responses[] are required' }, { status: 400 });
  }

  const callDate = new Date().toISOString();
  const rows = responses
    .filter((r: { question: string; answer: string }) => r.answer?.trim())
    .map((r: { question: string; answer: string }) => ({
      lead_id: leadId,
      script_id: scriptId || null,
      question: r.question,
      answer: r.answer.trim(),
      call_date: callDate,
      user_id: user.id,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ saved: 0 });
  }

  const { data, error } = await supabaseAdmin
    .from('call_responses')
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data.length });
}
