import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// GET — fetch the message thread for a property. RLS on property_messages
// gates by thread_user_id or owner_user_id; we use the admin client and pass
// the user filter explicitly to keep semantics consistent.
export async function GET(_request: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { leadId } = await ctx.params;

  const { data: messages } = await supabaseAdmin
    .from('property_messages')
    .select('id, sender_role, body, created_at, thread_user_id, owner_user_id')
    .eq('lead_id', leadId)
    .or(`thread_user_id.eq.${user.id},owner_user_id.eq.${user.id}`)
    .order('created_at', { ascending: true });

  return NextResponse.json({ messages: messages || [] });
}
