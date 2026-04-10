import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

async function checkAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  return !!data?.is_admin;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await checkAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('auto_target_requests')
    .select('*')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Admin auto-target fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }

  // Get user info for each request
  const userIds = Array.from(new Set((data || []).map(r => r.user_id)));
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const requests = (data || []).map(r => ({
    ...r,
    user_name: profileMap.get(r.user_id)?.full_name || 'Unknown',
    user_email: profileMap.get(r.user_id)?.email || '',
  }));

  return NextResponse.json({ requests });
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await checkAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { requestId, status, prospects_created, admin_notes } = body;

  if (!requestId || !status) {
    return NextResponse.json({ error: 'requestId and status required' }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (prospects_created != null) update.prospects_created = prospects_created;
  if (admin_notes != null) update.admin_notes = admin_notes;
  if (status === 'completed') update.completed_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('auto_target_requests')
    .update(update)
    .eq('id', requestId);

  if (error) {
    console.error('Admin auto-target update error:', error);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
