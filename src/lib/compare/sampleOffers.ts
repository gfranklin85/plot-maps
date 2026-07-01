// ── Seeded sample lender offers for the comparison cockpit ────────────
//
// v1 demo data. Deliberately VARIED so the honest point lands: the LOWEST
// RATE is NOT the cheapest over time (junk fees + points bury it), and a
// slightly higher rate with a lender credit comes out ahead. Plot NEVER
// ranks these — the buyer sorts + draws their own conclusion. We only show
// the full honest breakdown. See memory/project_position_job_posting_architecture
// ("we do not rank" + "expose, don't crown").

export interface LenderOffer {
  id: string;
  lenderName: string;      // a handle/name (identity handling per the sealed rule)
  loanType: string;        // e.g. "30-yr fixed conventional"
  ratePct: number;         // note rate
  aprPct: number;          // APR (reflects fees)
  points: number;          // discount points paid
  lenderFees: number;      // origination + junk fees ($)
  credit: number;          // lender credit toward closing ($) — reduces cost
  monthlyPI: number;       // principal + interest / month
  estCost5yr: number;      // est. total paid over 5 years (interest + fees + points − credit)
  receivedAt: string;      // ISO — for the neutral timeline order
  note?: string;           // the lender's own one-line pitch
}

// A sample buyer position (the "here's what you shared" header). Real one
// comes from the post-credible-income page later.
export const SAMPLE_POSITION = {
  loanType: '30-year fixed, conventional',
  priceRange: '$380,000 – $420,000',
  downPayment: '20% ($80,000)',
  monthlyTarget: 'around $2,200/mo',
  timeline: 'ready to close within 45 days',
  comparing: 'APR, lender credits, and total fees',
};

// Offers listed here in arrival order (receivedAt). The page renders them on
// a NEUTRAL timeline; the buyer chooses how to sort. No "best" flag from us.
export const SAMPLE_OFFERS: LenderOffer[] = [
  {
    id: 'off-1',
    lenderName: 'Valley First Lending',
    loanType: '30-yr fixed conventional',
    ratePct: 6.25,
    aprPct: 6.31,
    points: 0,
    lenderFees: 900,
    credit: 1500,
    monthlyPI: 1971,
    estCost5yr: 118_760, // higher rate, but a credit + low fees → strong total
    receivedAt: '2026-06-30T09:12:00Z',
    note: 'Straight sheet — no points, a credit toward your closing. What you see is what you pay.',
  },
  {
    id: 'off-2',
    lenderName: 'Sierra Home Loans',
    loanType: '30-yr fixed conventional',
    ratePct: 5.99, // LOWEST rate...
    aprPct: 6.42,  // ...but the APR tells on the fees
    points: 1.75,
    lenderFees: 3400,
    credit: 0,
    monthlyPI: 1917,
    estCost5yr: 122_910, // lowest rate, but points + fees make the 5-yr total the HIGHEST here
    receivedAt: '2026-06-30T10:40:00Z',
    note: 'Our lowest advertised rate. (Requires 1.75 points up front.)',
  },
  {
    id: 'off-3',
    lenderName: 'Kings County Credit Union',
    loanType: '30-yr fixed conventional',
    ratePct: 6.375,
    aprPct: 6.40,
    points: 0,
    lenderFees: 1100,
    credit: 0,
    monthlyPI: 1996,
    estCost5yr: 120_860,
    receivedAt: '2026-06-30T13:05:00Z',
    note: 'Member-owned. Simple terms, no surprises, local servicing.',
  },
  {
    id: 'off-4',
    lenderName: 'Anchor Mortgage Co.',
    loanType: '30-yr fixed conventional',
    ratePct: 6.125,
    aprPct: 6.28,
    points: 0.5,
    lenderFees: 1800,
    credit: 500,
    monthlyPI: 1954,
    estCost5yr: 119_940,
    receivedAt: '2026-06-30T15:22:00Z',
    note: 'A half-point buydown with a small credit — middle of the road, fully itemized.',
  },
];
