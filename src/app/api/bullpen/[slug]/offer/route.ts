import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

// POST /api/bullpen/[slug]/offer
//
// A lender who opened a shared link posts an OFFER against the buyer's
// position. No account required (they came in on a link the buyer/agent
// shared — the agent's vouch is the trust, not a Plot login). Lender name +
// at least a rate are the minimum. Offers accumulate on the neutral timeline;
// Plot never ranks. Stated-only — NMLS is a voluntary trust gesture, not
// verified here. (memory/project_position_job_posting_architecture)

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.toLowerCase().slice(0, 32);
  if (!slug) return NextResponse.json({ error: 'not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const { data: post } = await supabaseAdmin
    .from('bullpen_posts')
    .select('id, status')
    .eq('slug', slug)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (post.status !== 'open') {
    return NextResponse.json({ error: 'this position is closed' }, { status: 409 });
  }

  const str = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : '';
    return s ? s.slice(0, 400) : null;
  };
  const num = (v: unknown) => {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const lenderName = str(body.lenderName);
  if (!lenderName) {
    return NextResponse.json({ error: 'lender name is required' }, { status: 400 });
  }
  if (num(body.ratePct) == null && num(body.monthlyPI) == null) {
    return NextResponse.json({ error: 'add at least a rate or a monthly payment' }, { status: 400 });
  }

  const row = {
    post_id: post.id,
    lender_name: lenderName,
    lender_email: str(body.lenderEmail),
    lender_nmls: str(body.lenderNmls),
    loan_type: str(body.loanType),
    rate_pct: num(body.ratePct),
    apr_pct: num(body.aprPct),
    points: num(body.points) ?? 0,
    lender_fees: num(body.lenderFees) ?? 0,
    credit: num(body.credit) ?? 0,
    monthly_pi: num(body.monthlyPI),
    est_cost_5yr: num(body.estCost5yr),
    note: str(body.note),
  };

  const { error } = await supabaseAdmin.from('bullpen_offers').insert(row);
  if (error) {
    console.error('bullpen offer insert error:', error.message);
    return NextResponse.json({ error: 'could not post offer' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
