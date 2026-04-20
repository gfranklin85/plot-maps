import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminCheck } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminCheck?.is_admin) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const anonymousId = params.id;

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('anonymous_sessions')
    .select('*')
    .eq('anonymous_id', anonymousId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: events } = await supabaseAdmin
    .from('analytics_events')
    .select('id, event_name, page_url, metadata, created_at')
    .eq('anonymous_id', anonymousId)
    .order('created_at', { ascending: true })
    .limit(200);

  return NextResponse.json({ session, events: events || [] });
}
