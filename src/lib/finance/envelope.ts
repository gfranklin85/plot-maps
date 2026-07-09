// ── The seller's ENVELOPE — "what I have," computed, not guessed ───────
//
// Greg 2026-07-08: a seller posts BOTH what they want AND what they've got —
// and the "have" is a CONSTRAINT ENVELOPE, not a note. "I want to stay within
// what I already have (no boot)" means: my equity transfers or stays intact,
// my payment doesn't jump, and I keep heading toward payoff on the same or
// better glide. That's a financial SHAPE the match engine can rank against.
//
// This is PURE MATH — no AI, no deps. Four facts a seller gives (value, owed,
// rate, payment) back-engineer the whole envelope: equity, remaining term,
// payment ceiling, payoff date. Property facts (build year, value) fetch
// programmatically later; this computes the shape once they're in.
// memory/the_thesis (the HAVE side / no-boot envelope).

import { monthlyPI } from '@/lib/offer/costEngine';

export interface CurrentProperty {
  value: number | null;        // est. market value ("worth at least $415k")
  owed: number | null;         // remaining loan balance ("owe about $145k")
  ratePct: number | null;      // note rate ("3.25%")
  monthlyPI: number | null;    // current principal+interest payment ("$1,100/mo")
  loanType?: string | null;    // "VA" | "Conventional" | "FHA" | "Cash" | ...
  assumable?: boolean | null;  // assumable loan (VA/FHA often are) — a match lever
}

export interface Envelope {
  equity: number | null;              // value − owed (the wealth that must transfer)
  ltvPct: number | null;              // owed / value
  remainingMonths: number | null;     // solved from balance/rate/payment
  remainingYears: number | null;      // remainingMonths / 12 (rounded 0.1)
  paymentCeiling: number | null;      // don't-raise-my-payment line (current PI)
  glideNote: string | null;           // human line: "≈9.7 yrs left, $1,100/mo, $270k equity"
  assumableLever: boolean;            // true if the loan itself is a match asset
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Solve for the number of monthly payments remaining on an amortizing loan,
 * given balance (P), monthly rate (i), and payment (M):
 *   n = −ln(1 − iP/M) / ln(1 + i)
 * Returns null when the payment can't cover the interest (loan never
 * amortizes) or inputs are missing. Handles the 0% edge (n = P/M).
 */
export function remainingMonths(balance: number, annualRatePct: number, payment: number): number | null {
  if (balance <= 0 || payment <= 0) return null;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return Math.ceil(balance / payment);
  const interestOnly = balance * i;
  if (payment <= interestOnly) return null; // payment never touches principal
  const n = -Math.log(1 - (i * balance) / payment) / Math.log(1 + i);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}

/**
 * Compute the seller's envelope from what they have. Every field degrades
 * gracefully to null when its inputs are missing — a partial "have" still
 * yields a partial envelope (equity even without the loan facts, etc.).
 */
export function computeEnvelope(p: CurrentProperty): Envelope {
  const equity = p.value != null && p.owed != null ? r0(p.value - p.owed) : null;
  const ltvPct = p.value != null && p.owed != null && p.value > 0 ? r1((p.owed / p.value) * 100) : null;

  // Prefer the payment they gave; if absent but we have rate + a term guess,
  // we can't infer term without payment, so remaining term needs the payment.
  const months = p.owed != null && p.ratePct != null && p.monthlyPI != null
    ? remainingMonths(p.owed, p.ratePct, p.monthlyPI)
    : null;

  const paymentCeiling = p.monthlyPI != null ? r0(p.monthlyPI) : null;
  const assumableLever = !!p.assumable
    || (p.loanType?.toUpperCase() === 'VA' || p.loanType?.toUpperCase() === 'FHA');

  const bits: string[] = [];
  if (months != null) bits.push(`~${r1(months / 12)} yrs left`);
  if (paymentCeiling != null) bits.push(`$${paymentCeiling.toLocaleString()}/mo`);
  if (equity != null) bits.push(`$${equity.toLocaleString()} equity`);
  if (assumableLever) bits.push('assumable loan');

  return {
    equity,
    ltvPct,
    remainingMonths: months,
    remainingYears: months != null ? r1(months / 12) : null,
    paymentCeiling,
    glideNote: bits.length ? bits.join(' · ') : null,
    assumableLever,
  };
}

// ── ranking an opening against the envelope ───────────────────────────
// "Our matches don't always have to line up financially — we can see what's
// open that costs a few dollars more, or is a way better deal." An opening is
// scored by how it moves the seller RELATIVE to their envelope: inside it
// (whole or better), a little over, or a genuinely better deal. Seller-carry
// and loan assumption are the levers that make "a little over" actually work.

export type EnvelopeFit = 'better' | 'within' | 'slightly_over' | 'over' | 'unknown';

export interface OpeningTerms {
  price: number | null;              // the ask on the target property
  estMonthly: number | null;         // est. new PI at market terms (optional)
  sellerCarryOffered?: boolean | null;
}

export function fitAgainstEnvelope(env: Envelope, target: OpeningTerms): { fit: EnvelopeFit; why: string } {
  // Payment is the sharpest constraint sellers feel ("don't raise my payment").
  if (env.paymentCeiling != null && target.estMonthly != null) {
    const ceil = env.paymentCeiling;
    const m = target.estMonthly;
    if (m <= ceil * 0.92) return { fit: 'better', why: `New payment ~$${r0(m).toLocaleString()}/mo — below your $${ceil.toLocaleString()} line.` };
    if (m <= ceil * 1.03) return { fit: 'within', why: `Payment ~$${r0(m).toLocaleString()}/mo — right around your current $${ceil.toLocaleString()}.` };
    if (m <= ceil * 1.15) {
      const lever = target.sellerCarryOffered || env.assumableLever;
      return {
        fit: 'slightly_over',
        why: `Payment ~$${r0(m).toLocaleString()}/mo, a bit above your $${ceil.toLocaleString()}${lever ? ' — seller-carry or loan assumption could close the gap.' : '.'}`,
      };
    }
    return { fit: 'over', why: `Payment ~$${r0(m).toLocaleString()}/mo — well above your $${ceil.toLocaleString()} line.` };
  }
  // No payment estimate yet — fall back to equity coverage on price.
  if (env.equity != null && target.price != null) {
    if (target.price <= env.equity * 2) return { fit: 'within', why: 'Your equity covers a strong position on this one.' };
    return { fit: 'unknown', why: 'Need the new-loan terms to know how it lands against your payment.' };
  }
  return { fit: 'unknown', why: 'Add your current loan facts to see how openings land against your envelope.' };
}
