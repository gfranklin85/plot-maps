// ── Bullpen shared types + payload shapers ────────────────────────────
//
// The buyer platform's spine (memory/project_position_job_posting_architecture).
// A posted buyer position + the lender offers against it. The DB tables are
// service-role-only; these shapers control exactly what a PUBLIC link view
// exposes (never the raw row).

export interface BullpenPost {
  slug: string;
  displayMode: string;        // 'anonymous' | 'named' — the buyer's visibility choice
  buyerName: string | null;   // shown ONLY when displayMode === 'named'
  occupation: string;
  city: string | null;        // the market — for lender filtering
  headline: string | null;    // plain-language "Looking for a 3bd in Lemoore…"
  monthly: string | null;     // "~$2,200/mo"
  needs: string[];            // crew chips: lender/inspector/insurance/…
  profileNote: string | null; // optional buyer blurb/ledger (named mode)
  agentName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
  military: string | null;
  militaryDetail: string | null;
  priceRange: string | null;
  downPayment: string | null;
  loanType: string | null;
  timeline: string | null;
  income: string | null;
  debts: string | null;
  creditBand: string | null;
  proofNote: string | null;
  status: string;
  createdAt: string;
}

// A lighter row for the public board list (only what a browsing lender needs
// to decide whether to open + bid — never private data).
export interface BullpenBoardItem {
  slug: string;
  displayMode: string;
  buyerName: string | null;   // null unless 'named'
  occupation: string;
  city: string | null;
  headline: string | null;
  monthly: string | null;
  needs: string[];
  loanType: string | null;
  timeline: string | null;
  priceRange: string | null;
  military: string | null;
  hasOffer: boolean;          // market trust light — never names the lender
  offerCount: number;
  createdAt: string;
}

export interface BullpenOffer {
  id: string;
  lenderName: string;
  lenderNmls: string | null;
  originatorName: string | null;
  originatorPhone: string | null;
  loanType: string | null;
  ratePct: number | null;
  aprPct: number | null;
  points: number | null;
  lenderFees: number | null;   // = total closing costs
  credit: number | null;
  monthlyPI: number | null;
  loanAmount: number | null;
  termMonths: number | null;
  totalMonthly: number | null;
  totalClosing: number | null;
  cashToClose: number | null;
  worksheet: Record<string, string>; // the full line-item blob
  note: string | null;
  createdAt: string;
}

// A raw bullpen_posts row → the PUBLIC shape a link viewer sees. Anonymity is
// enforced HERE, at the boundary: buyer_name + profile_note are only exposed
// when the buyer chose 'named'. agent_email/phone are shown (the agent opted in
// by listing themselves), but created_by is NEVER exposed.
export function shapePost(row: Record<string, unknown>): BullpenPost {
  const s = (v: unknown) => (v == null ? null : String(v));
  const named = String(row.display_mode ?? 'anonymous') === 'named';
  return {
    slug: String(row.slug),
    displayMode: String(row.display_mode ?? 'anonymous'),
    buyerName: named ? s(row.buyer_name) : null,
    occupation: String(row.occupation ?? ''),
    city: s(row.city),
    headline: s(row.headline),
    monthly: s(row.monthly),
    needs: Array.isArray(row.needs) ? (row.needs as string[]) : [],
    profileNote: named ? s(row.profile_note) : null,
    agentName: s(row.agent_name),
    agentEmail: s(row.agent_email),
    agentPhone: s(row.agent_phone),
    military: s(row.military),
    militaryDetail: s(row.military_detail),
    priceRange: s(row.price_range),
    downPayment: s(row.down_payment),
    loanType: s(row.loan_type),
    timeline: s(row.timeline),
    income: s(row.income),
    debts: s(row.debts),
    creditBand: s(row.credit_band),
    proofNote: s(row.proof_note),
    status: String(row.status ?? 'open'),
    createdAt: String(row.created_at),
  };
}

export function shapeOffer(row: Record<string, unknown>): BullpenOffer {
  const n = (v: unknown) => (v == null ? null : Number(v));
  const s = (v: unknown) => (v == null ? null : String(v));
  return {
    id: String(row.id),
    lenderName: String(row.lender_name ?? ''),
    lenderNmls: s(row.lender_nmls),
    originatorName: s(row.originator_name),
    originatorPhone: s(row.originator_phone),
    loanType: s(row.loan_type),
    ratePct: n(row.rate_pct),
    aprPct: n(row.apr_pct),
    points: n(row.points),
    lenderFees: n(row.lender_fees),
    credit: n(row.credit),
    monthlyPI: n(row.monthly_pi),
    loanAmount: n(row.loan_amount),
    termMonths: n(row.term_months),
    totalMonthly: n(row.total_monthly),
    totalClosing: n(row.total_closing),
    cashToClose: n(row.cash_to_close),
    worksheet: (row.worksheet && typeof row.worksheet === 'object')
      ? (row.worksheet as Record<string, string>) : {},
    note: s(row.note),
    createdAt: String(row.created_at),
  };
}

// A raw post row (+ its offer count) → the public board item. Same anonymity
// boundary: name only in 'named' mode.
export function shapeBoardItem(row: Record<string, unknown>, offerCount: number): BullpenBoardItem {
  const s = (v: unknown) => (v == null ? null : String(v));
  const named = String(row.display_mode ?? 'anonymous') === 'named';
  return {
    slug: String(row.slug),
    displayMode: String(row.display_mode ?? 'anonymous'),
    buyerName: named ? s(row.buyer_name) : null,
    occupation: String(row.occupation ?? ''),
    city: s(row.city),
    headline: s(row.headline),
    monthly: s(row.monthly),
    needs: Array.isArray(row.needs) ? (row.needs as string[]) : [],
    loanType: s(row.loan_type),
    timeline: s(row.timeline),
    priceRange: s(row.price_range),
    military: s(row.military),
    hasOffer: offerCount > 0,
    offerCount,
    createdAt: String(row.created_at),
  };
}

// Short, human-friendly, unambiguous slug (no 0/O/1/l/i). ~7 chars = plenty
// of space, still easy to read off a shared link.
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function makeSlug(len = 7): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return out;
}
