import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';
import { makeInviteToken } from '@/lib/bullpen/invite';

// POST /api/agent-invite
//
// An agent creates their invite link (no account required). Name is required;
// email/phone/brokerage/logo optional. Returns a short token → the agent texts
// /bullpen?agent=<token> to a buyer. (memory/project_agent_branded_template)

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const str = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s.slice(0, 300) : null;
  };

  const agentName = str(body.agentName);
  if (!agentName) {
    return NextResponse.json({ error: 'your name is required' }, { status: 400 });
  }

  let createdBy: string | null = null;
  try {
    createdBy = (await getAuthUser())?.id ?? null;
  } catch {
    createdBy = null;
  }

  let token = makeInviteToken();
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabaseAdmin
      .from('agent_invites')
      .select('token')
      .eq('token', token)
      .maybeSingle();
    if (!clash) break;
    token = makeInviteToken();
  }

  const { error } = await supabaseAdmin.from('agent_invites').insert({
    token,
    agent_name: agentName,
    agent_email: str(body.agentEmail),
    agent_phone: str(body.agentPhone),
    brokerage: str(body.brokerage),
    logo_url: str(body.logoUrl),
    created_by: createdBy,
  });
  if (error) {
    console.error('agent-invite insert error:', error.message);
    return NextResponse.json({ error: 'could not create invite' }, { status: 500 });
  }

  return NextResponse.json({ token });
}
