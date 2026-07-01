import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getAuthUser } from '@/lib/auth';
import { makeSlug } from '@/lib/bullpen/types';

// POST /api/bullpen
//
// Create a shareable buyer position (the bullpen post). Occupation is the only
// required field — the hero signal. Everything else is optional depth. Returns
// the short slug for the shareable link (/b/<slug>). No auth REQUIRED (a buyer
// without an account can post), but if there's a session we stamp created_by.
// Stated-only — no verified/sensitive data (memory/project_buyer_financial_capture).

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
    return s ? s.slice(0, 400) : null;
  };

  const occupation = str(body.occupation);
  if (!occupation) {
    return NextResponse.json({ error: 'occupation is required' }, { status: 400 });
  }

  // Best-effort session stamp (route handler can read cookies).
  let createdBy: string | null = null;
  try {
    const user = await getAuthUser();
    createdBy = user?.id ?? null;
  } catch {
    createdBy = null;
  }

  // Generate a unique slug (retry on the vanishingly rare collision).
  let slug = makeSlug();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await supabaseAdmin
      .from('bullpen_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!clash) break;
    slug = makeSlug();
  }

  // Visibility choice: 'named' shows the buyer's name/profile; anything else
  // (default) is anonymous. The position itself is public either way.
  const displayMode = str(body.displayMode) === 'named' ? 'named' : 'anonymous';

  // Crew needs — sanitized to a known set of chips.
  const NEED_SET = new Set(['lender', 'inspector', 'insurance', 'contractor', 'escrow', 'title', 'agent']);
  const needs = Array.isArray(body.needs)
    ? Array.from(new Set(body.needs.map((v) => String(v).toLowerCase().trim()).filter((v) => NEED_SET.has(v))))
    : ['lender'];

  const row = {
    slug,
    display_mode: displayMode,
    is_public: true,
    buyer_name: str(body.buyerName),
    occupation,
    city: str(body.city),
    headline: str(body.headline),
    monthly: str(body.monthly),
    needs: needs.length ? needs : ['lender'],
    profile_note: str(body.profileNote),
    agent_name: str(body.agentName),
    agent_email: str(body.agentEmail),
    agent_phone: str(body.agentPhone),
    military: str(body.military),
    military_detail: str(body.militaryDetail),
    price_range: str(body.priceRange),
    down_payment: str(body.downPayment),
    loan_type: str(body.loanType),
    timeline: str(body.timeline),
    income: str(body.income),
    debts: str(body.debts),
    credit_band: str(body.creditBand),
    proof_note: str(body.proofNote),
    created_by: createdBy,
  };

  const { error } = await supabaseAdmin.from('bullpen_posts').insert(row);
  if (error) {
    console.error('bullpen insert error:', error.message);
    return NextResponse.json({ error: 'could not post' }, { status: 500 });
  }

  return NextResponse.json({ slug });
}
