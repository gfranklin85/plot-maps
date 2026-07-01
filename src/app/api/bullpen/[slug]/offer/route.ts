import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { totalMonthly, totalClosing, totalCredits, cashToClose } from '@/lib/bullpen/worksheet';

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
  // The ONLY bar: a real NMLS # (licensed = in). Not us approving anyone —
  // the industry's own open, public qualifier. No exclusion, no favoring.
  // (memory/project_bullpen_public_board — SAFE Act / NMLS Consumer Access.)
  const nmls = str(body.lenderNmls);
  if (!nmls || !/^\d{3,10}$/.test(nmls.replace(/\D/g, ''))) {
    return NextResponse.json(
      { error: 'A valid NMLS ID is required — it’s how buyers know you’re licensed. Anyone with one is welcome.' },
      { status: 400 },
    );
  }
  // The full fee worksheet (line-item blob). Sanitize to strings; drop empties.
  const ws: Record<string, string> = {};
  const rawWs = (body.worksheet && typeof body.worksheet === 'object') ? body.worksheet as Record<string, unknown> : {};
  for (const [k, v] of Object.entries(rawWs)) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) ws[k.slice(0, 60)] = s.slice(0, 60);
  }

  // Derive the top comparison numbers server-side, the way the sheet sums them.
  const rate = num(ws.interestRate);
  const monthly = totalMonthly(ws);
  if (rate == null && monthly === 0) {
    return NextResponse.json({ error: 'Add at least a rate or a monthly payment.' }, { status: 400 });
  }

  const row = {
    post_id: post.id,
    lender_name: lenderName,
    lender_email: str(body.lenderEmail),
    lender_nmls: str(body.lenderNmls),
    loan_type: str(ws.loanType),
    rate_pct: rate,
    apr_pct: num(ws.apr),
    points: num(ws.loanPoints) ?? 0,
    lender_fees: totalClosing(ws),
    credit: totalCredits(ws),
    monthly_pi: num(ws.principalInterest),
    loan_amount: num(ws.loanAmountMip) ?? num(ws.loanAmount),
    term_months: ws.termMonths ? parseInt(ws.termMonths, 10) : null,
    total_monthly: monthly || null,
    total_closing: totalClosing(ws) || null,
    cash_to_close: cashToClose(ws) || null,
    originator_name: str(body.originatorName),
    originator_phone: str(body.originatorPhone),
    originator_email: str(body.lenderEmail),
    worksheet: ws,
    note: str(body.note),
  };

  const { error } = await supabaseAdmin.from('bullpen_offers').insert(row);
  if (error) {
    console.error('bullpen offer insert error:', error.message);
    return NextResponse.json({ error: 'could not post offer' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
