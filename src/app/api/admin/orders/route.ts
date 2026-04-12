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

  const { data: orders, error } = await supabaseAdmin
    .from('prospect_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }

  // Get user info for each order
  const userIds = Array.from(new Set((orders || []).map(o => o.user_id)));
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const enriched = (orders || []).map(o => ({
    ...o,
    user_name: profileMap.get(o.user_id)?.full_name || 'Unknown',
    user_email: profileMap.get(o.user_id)?.email || '',
  }));

  return NextResponse.json({ orders: enriched });
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await checkAdmin(user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { orderId, status } = await request.json();
  if (!orderId || !status) {
    return NextResponse.json({ error: 'orderId and status required' }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (status === 'completed') update.completed_at = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from('prospect_orders')
    .update(update)
    .eq('id', orderId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
