// ── Bullpen shared types + payload shapers ────────────────────────────
//
// The buyer platform's spine (memory/project_position_job_posting_architecture).
// A posted buyer position + the lender offers against it. The DB tables are
// service-role-only; these shapers control exactly what a PUBLIC link view
// exposes (never the raw row).

export interface BullpenPost {
  slug: string;
  buyerName: string | null;
  occupation: string;
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

export interface BullpenOffer {
  id: string;
  lenderName: string;
  lenderNmls: string | null;
  loanType: string | null;
  ratePct: number | null;
  aprPct: number | null;
  points: number | null;
  lenderFees: number | null;
  credit: number | null;
  monthlyPI: number | null;
  estCost5yr: number | null;
  note: string | null;
  createdAt: string;
}

// A raw bullpen_posts row → the PUBLIC shape a link viewer sees. Note:
// agent_email/phone are shown (they're the contact-the-agent path, and the
// agent chose to be listed), but created_by is NEVER exposed.
export function shapePost(row: Record<string, unknown>): BullpenPost {
  const s = (v: unknown) => (v == null ? null : String(v));
  return {
    slug: String(row.slug),
    buyerName: s(row.buyer_name),
    occupation: String(row.occupation ?? ''),
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
    loanType: s(row.loan_type),
    ratePct: n(row.rate_pct),
    aprPct: n(row.apr_pct),
    points: n(row.points),
    lenderFees: n(row.lender_fees),
    credit: n(row.credit),
    monthlyPI: n(row.monthly_pi),
    estCost5yr: n(row.est_cost_5yr),
    note: s(row.note),
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
