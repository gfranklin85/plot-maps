import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';

// POST — send a message into a property's thread.
// Either party can send: the original inquirer (thread_user_id) or the owner.
// We resolve the role server-side based on who's calling.

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { leadId, threadUserId, body } = (await request.json()) as {
    leadId: string;
    threadUserId?: string;
    body: string;
  };

  if (!leadId || !body) {
    return NextResponse.json({ error: 'leadId and body required' }, { status: 400 });
  }

  // Determine sender role + thread participants. The thread is always
  // (lead, thread_user_id, owner_user_id). If the caller is the current owner,
  // they can post into any thread for that lead. If the caller is an inquirer,
  // they must own one of the property_inquiries on that lead.
  const { data: ownerScore } = await supabaseAdmin
    .from('property_self_scores')
    .select('owner_user_id')
    .eq('lead_id', leadId)
    .eq('is_current', true)
    .maybeSingle();
  const ownerUserId = ownerScore?.owner_user_id || null;

  let senderRole: 'inquirer' | 'owner';
  let resolvedThreadUserId: string;

  if (ownerUserId === user.id) {
    senderRole = 'owner';
    if (!threadUserId) {
      return NextResponse.json(
        { error: 'threadUserId required when posting as owner' },
        { status: 400 },
      );
    }
    // Verify the threadUserId actually has an inquiry on this lead
    const { data: inquiry } = await supabaseAdmin
      .from('property_inquiries')
      .select('id')
      .eq('lead_id', leadId)
      .eq('initiator_user_id', threadUserId)
      .limit(1)
      .maybeSingle();
    if (!inquiry) return NextResponse.json({ error: 'No such thread' }, { status: 404 });
    resolvedThreadUserId = threadUserId;
  } else {
    // Caller is an inquirer (or wants to be); ensure they have an inquiry on this lead
    const { data: inquiry } = await supabaseAdmin
      .from('property_inquiries')
      .select('id')
      .eq('lead_id', leadId)
      .eq('initiator_user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (!inquiry) {
      return NextResponse.json(
        { error: 'You have no inquiry on this property' },
        { status: 403 },
      );
    }
    senderRole = 'inquirer';
    resolvedThreadUserId = user.id;
  }

  const { error: insErr } = await supabaseAdmin.from('property_messages').insert({
    lead_id: leadId,
    thread_user_id: resolvedThreadUserId,
    owner_user_id: ownerUserId,
    sender_role: senderRole,
    body,
  });
  if (insErr) return NextResponse.json({ error: 'Failed to send' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
