import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { shapeInvite } from '@/lib/bullpen/invite';

// GET /api/agent-invite/[token]
//
// Read an agent invite so /bullpen?agent=<token> can pre-fill the agent's info
// + branding and skip the agent questions. Public read (the buyer opening the
// link needs it) — it only exposes the agent's own chosen public info.
// (memory/project_agent_branded_template)

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const token = params.token?.toLowerCase().slice(0, 32);
  if (!token) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('agent_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('agent-invite get error:', error.message);
    return NextResponse.json({ error: 'lookup failed' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({ invite: shapeInvite(data as Record<string, unknown>) });
}
