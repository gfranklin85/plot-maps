// ── Affordability — monthly-first buyer math ──────────────────────────
//
// The buyer anchors on a MONTHLY payment (the thing they can actually
// judge) and we reverse-solve the home price it implies. This is a
// play-and-learn tool — no rate is hardcoded as "the answer"; the buyer
// sets the rate and sees historical context. Real numbers come from
// lenders (and later Plot's own seller-finance rates).
//
// This is the algebraic INVERSE of the amortization kernel the rest of Plot
// uses (src/lib/offer/costEngine.ts → monthlyPI): target monthly → loan →
// price. Same formula, solved for principal. Plus DTI.
// memory: project_two_doors_to_qualify.

/** Max loan you can carry for a target monthly P&I, at a given rate/term.
 *  Algebraic inverse of monthlyPI: P = M·((1+i)^n − 1) / (i·(1+i)^n).
 *  `annualRatePct` is a PERCENT (6.5 = 6.5%), matching monthlyPI. */
export function loanFromMonthly(monthlyPayment: number, annualRatePct: number, termYears: number): number {
  if (monthlyPayment <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return monthlyPayment * n;
  const pow = Math.pow(1 + i, n);
  return (monthlyPayment * (pow - 1)) / (i * pow);
}

export interface AffordabilityInput {
  /** the monthly payment the buyer is comfortable with (P&I basis for v1) */
  monthlyTarget: number;
  /** down payment in dollars */
  downPayment: number;
  /** annual rate as a percent (6.5 = 6.5%) */
  rate: number;
  /** loan term in years (default 30) */
  term?: number;
}

export interface AffordabilityResult {
  /** the loan the monthly supports */
  loanAmount: number;
  /** loan + down = the home price they can reach */
  homePrice: number;
}

/** Monthly + down + rate → the home price it reaches. */
export function affordablePrice(input: AffordabilityInput): AffordabilityResult {
  const { monthlyTarget, downPayment, rate, term = 30 } = input;
  const loanAmount = loanFromMonthly(monthlyTarget, rate, term);
  return { loanAmount, homePrice: loanAmount + Math.max(0, downPayment) };
}

// ── DTI (debt-to-income) — the "sharpen it" / lowballer catch ─────────
// Standard back-end ratio: (housing payment + other monthly debts) /
// gross monthly income. ≲36% comfortable, ≲43% is the common qualifying
// ceiling, above that is stretched.

export type DtiHealth = 'comfortable' | 'workable' | 'stretched';

export interface DtiResult {
  ratio: number;            // 0..1 (0.34 = 34%)
  health: DtiHealth;
  /** headroom to the 43% ceiling, in monthly $ (0 if already over) */
  roomToCeiling: number;
}

export function backEndDTI(args: {
  housingPayment: number;
  monthlyDebts: number;
  monthlyIncome: number;
}): DtiResult | null {
  const { housingPayment, monthlyDebts, monthlyIncome } = args;
  if (monthlyIncome <= 0) return null;
  const ratio = (housingPayment + monthlyDebts) / monthlyIncome;
  const health: DtiHealth = ratio <= 0.36 ? 'comfortable' : ratio <= 0.43 ? 'workable' : 'stretched';
  const ceilingPayment = monthlyIncome * 0.43 - monthlyDebts;
  return { ratio, health, roomToCeiling: Math.max(0, ceilingPayment - housingPayment) };
}

// ── Historical rate context — the teaching note under the rate slider ─
// Anchors from Freddie Mac PMMS (30-yr fixed). NOT used to drive the
// math — purely informational so the buyer LEARNS as they explore.
// Sorted ascending; we find the closest band for whatever rate they pick.

export interface RateEra {
  /** representative rate (%) for this era */
  rate: number;
  /** what the buyer sees when they land near it */
  note: string;
}

export const RATE_HISTORY: RateEra[] = [
  { rate: 2.9, note: 'The record low — early 2021. Rates may never be here again.' },
  { rate: 3.5, note: 'The 2020–2021 pandemic-era lows.' },
  { rate: 4.0, note: 'Roughly the 2011 and 2019 national averages.' },
  { rate: 5.0, note: 'Around 2009–2010, and where 2022 started climbing from.' },
  { rate: 6.5, note: 'About where rates are right now (mid-2026).' },
  { rate: 7.5, note: 'The 2023–2024 peak of this cycle; also the ~2000 level.' },
  { rate: 9.0, note: 'Last common in the mid-1990s.' },
  { rate: 12.0, note: 'The early-1980s era — rates peaked at 16.6% in 1981.' },
];

/** The realistic "today" band to highlight on the slider track (%). */
export const RATE_TODAY_BAND = { low: 5, high: 7 } as const;

/** Find the historical note closest to a chosen rate. */
export function rateNote(rate: number): string {
  let best = RATE_HISTORY[0];
  let bestGap = Math.abs(rate - best.rate);
  for (const era of RATE_HISTORY) {
    const gap = Math.abs(rate - era.rate);
    if (gap < bestGap) { best = era; bestGap = gap; }
  }
  return best.note;
}
