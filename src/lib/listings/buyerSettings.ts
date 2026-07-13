'use client';

// ── Buyer Settings — persisted per device, smart area defaults ────────
//
// The buyer's assumptions that translate every listing into a monthly payment.
// Persisted to localStorage (survive reloads, no login). Taxes/insurance/PMI
// auto-derive from area/price and are editable. Greg 2026-07-13.

import { monthlyPayment, type PaymentBreakdown } from '@/lib/finance/payment';

export type LoanType = 'conventional' | 'fha' | 'va' | 'cash';

export interface BuyerSettings {
  loanType: LoanType;
  downType: 'percent' | 'dollar';
  downPercent: number;   // used when downType='percent'
  downDollar: number;    // used when downType='dollar'
  ratePct: number;
  termYears: number;
  // per-area editable estimates
  annualTaxRate: number; // fraction of price/yr (e.g. 0.011 = 1.1%)
  monthlyInsurance: number;
  monthlyHOA: number;
  targetMonthly: number;
}

export const DEFAULT_SETTINGS: BuyerSettings = {
  loanType: 'conventional',
  downType: 'percent',
  downPercent: 10,
  downDollar: 0,
  ratePct: 6.75,
  termYears: 30,
  annualTaxRate: 0.011,   // ~1.1% — Central Valley ballpark, editable
  monthlyInsurance: 120,
  monthlyHOA: 0,
  targetMonthly: 2500,
};

const LS = 'plotmaps.buyerSettings';

export function loadSettings(): BuyerSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<BuyerSettings>) };
  } catch { return DEFAULT_SETTINGS; }
}

export function saveSettings(s: BuyerSettings) {
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* ignore */ }
}

// down payment in dollars from the settings + a given price
export function downDollars(s: BuyerSettings, price: number): number {
  if (s.downType === 'dollar') return s.downDollar;
  return Math.round(price * (s.downPercent / 100));
}

// PMI estimate: conventional under 20% down → ~0.5%/yr of loan, monthly.
// VA and FHA are handled simply (VA: no PMI; FHA: MIP ~0.55%/yr). Cash: none.
export function monthlyPMI(s: BuyerSettings, price: number): number {
  const down = downDollars(s, price);
  const loan = Math.max(0, price - down);
  const ltv = price > 0 ? (price - down) / price : 0;
  if (s.loanType === 'cash' || s.loanType === 'va') return 0;
  if (s.loanType === 'fha') return Math.round((loan * 0.0055) / 12);
  // conventional
  if (ltv > 0.8) return Math.round((loan * 0.005) / 12);
  return 0;
}

// full breakdown for a listing at `price`, given the buyer's settings
export function paymentFor(s: BuyerSettings, price: number, hoaOverride?: number): PaymentBreakdown {
  const down = downDollars(s, price);
  return monthlyPayment({
    price,
    downPayment: s.loanType === 'cash' ? price : down,
    annualRatePct: s.loanType === 'cash' ? 0 : s.ratePct,
    termYears: s.termYears,
    annualTaxes: price * s.annualTaxRate,
    monthlyInsurance: s.monthlyInsurance,
    monthlyHOA: hoaOverride ?? s.monthlyHOA,
    monthlyPMI: monthlyPMI(s, price),
  });
}
