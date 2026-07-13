// ── Monthly payment (PITI) for the buyer-first listings page ──────────
//
// "Don't just show buyers the price. Show them what the price means." Every
// listing is translated into an estimated monthly payment using the buyer's
// own settings (rate, down, term, taxes, insurance, PMI, HOA). Greg 2026-07-13.

export interface PaymentInputs {
  price: number;
  downPayment: number;      // dollars
  annualRatePct: number;    // e.g. 6.75
  termYears: number;        // e.g. 30
  annualTaxes?: number;     // dollars/yr (default derived by caller from area)
  monthlyInsurance?: number;
  monthlyHOA?: number;
  monthlyPMI?: number;
}

export interface PaymentBreakdown {
  loanAmount: number;
  principalAndInterest: number;
  taxes: number;        // monthly
  insurance: number;    // monthly
  pmi: number;          // monthly
  hoa: number;          // monthly
  total: number;        // monthly PITI + HOA
}

export function monthlyPayment({
  price,
  downPayment,
  annualRatePct,
  termYears,
  annualTaxes = 0,
  monthlyInsurance = 0,
  monthlyHOA = 0,
  monthlyPMI = 0,
}: PaymentInputs): PaymentBreakdown {
  const loanAmount = Math.max(0, price - downPayment);
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;

  const pi = r === 0
    ? loanAmount / n
    : loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  const taxes = annualTaxes / 12;
  return {
    loanAmount,
    principalAndInterest: pi,
    taxes,
    insurance: monthlyInsurance,
    pmi: monthlyPMI,
    hoa: monthlyHOA,
    total: pi + taxes + monthlyInsurance + monthlyPMI + monthlyHOA,
  };
}

// ── Payment Fit: what price / down hits a target monthly payment ──────
// Given everything except price, solve for the price that yields `target`
// monthly PITI (fixing the down payment), and separately the extra down
// needed at the current price. Rough, buyer-guidance only.

export function priceForTarget(opts: {
  target: number; downPayment: number; annualRatePct: number; termYears: number;
  annualTaxRate?: number; // fraction of price/yr (e.g. 0.011) — taxes scale with price
  monthlyInsurance?: number; monthlyPMI?: number; monthlyHOA?: number;
}): number {
  const { target, downPayment, annualRatePct, termYears } = opts;
  const taxRate = opts.annualTaxRate ?? 0;
  const fixed = (opts.monthlyInsurance ?? 0) + (opts.monthlyPMI ?? 0) + (opts.monthlyHOA ?? 0);
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  const factor = r === 0 ? 1 / n : (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  // target = (price - down)*factor + price*taxRate/12 + fixed
  // target - fixed + down*factor = price*(factor + taxRate/12)
  const denom = factor + taxRate / 12;
  if (denom <= 0) return 0;
  const price = (target - fixed + downPayment * factor) / denom;
  return Math.max(0, price);
}

// Extra down payment needed (at fixed price) to hit target monthly.
export function downForTarget(opts: {
  target: number; price: number; annualRatePct: number; termYears: number;
  annualTaxes?: number; monthlyInsurance?: number; monthlyPMI?: number; monthlyHOA?: number;
}): number {
  const { target, price, annualRatePct, termYears } = opts;
  const fixed = (opts.annualTaxes ?? 0) / 12 + (opts.monthlyInsurance ?? 0) + (opts.monthlyPMI ?? 0) + (opts.monthlyHOA ?? 0);
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  const factor = r === 0 ? 1 / n : (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  // target - fixed = (price - down)*factor  →  down = price - (target - fixed)/factor
  if (factor <= 0) return 0;
  const loanForTarget = (target - fixed) / factor;
  return Math.max(0, price - loanForTarget);
}

export const fmtMoney = (n: number | null | undefined, cents = false) =>
  n == null ? '—' : `$${Math.round(cents ? n : n).toLocaleString(undefined, cents ? { minimumFractionDigits: 0 } : {})}`;
export const fmtMo = (n: number) => `$${Math.round(n).toLocaleString()}/mo`;
