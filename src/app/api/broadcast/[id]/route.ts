import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: broadcast, error } = await supabaseAdmin
    .from('broadcasts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !broadcast) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch call results
  const { data: calls } = await supabaseAdmin
    .from('broadcast_calls')
    .select('*')
    .eq('broadcast_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ broadcast, calls: calls || [] });
}
