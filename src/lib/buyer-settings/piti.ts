// piti.ts — deterministic estimated PITI math.
//
// Locked 2026-05-30. Used by PropertyCardBillboard to render the monthly
// headline AND by BuyerSettingsPanel to recalc every visible card live
// when the user turns a knob.
//
// The math is intentionally simple and transparent — buyers should be
// able to look at the breakdown and trust it. No black box.
//
// CRITICAL RULE (from feedback_no_gimmick_estimates_off_market):
// only call this when a real list price or sold price exists.
// Off Market / public-record cards must NEVER show a calculated monthly.
// Callers are responsible for that guard; this module computes
// whatever it's given.

export interface BuyerSettings {
  /** Down payment percentage as a decimal. 0.20 = 20%. */
  downPct: number;
  /** Annual interest rate as a decimal. 0.068 = 6.8%. */
  rate: number;
  /** Loan term in years (typically 15 or 30). */
  termYears: number;
  /** Effective annual property tax rate as a decimal of price.
   *  0.011 = 1.1% (Kings County effective). Will eventually be
   *  county-specific; for now we default to the Kings rate. */
  taxRate: number;
  /** Annual baseline insurance premium in dollars. */
  insuranceBase: number;
  /** Additional annual insurance per $1,000 of price. */
  insurancePerThousand: number;
  /** Monthly HOA dues in dollars. Optional per-listing override. */
  hoaMonthly: number;
  /** How the card headline reads: 'monthly' (new default) or 'price' (classic). */
  headlineMode: 'monthly' | 'price';
  /** In-world card size multiplier — user-controlled via the CARD SIZE
   *  slider in the top panel. The world-anchored popover reads this; the
   *  camera never resizes the card. Range ~0.3–1.4. */
  cardScale: number;
}

export const DEFAULT_BUYER_SETTINGS: BuyerSettings = {
  downPct: 0.20,
  rate: 0.068,
  termYears: 30,
  taxRate: 0.011,
  insuranceBase: 1200,
  insurancePerThousand: 0.5,
  hoaMonthly: 0,
  headlineMode: 'monthly',
  cardScale: 0.7,
};

export interface PitiBreakdown {
  /** Monthly principal + interest. */
  pi: number;
  /** Monthly property tax. */
  tax: number;
  /** Monthly insurance. */
  insurance: number;
  /** Monthly HOA. */
  hoa: number;
  /** Total monthly PITI (P+I+T+I + HOA). */
  monthly: number;
  /** Loan amount (price minus down payment). */
  loan: number;
  /** Down payment dollar amount. */
  downAmount: number;
}

/** Calculate the full PITI breakdown for a given price + settings.
 *  Returns zeros if price is not a positive number — callers should
 *  check `monthly > 0` before rendering. */
export function calculatePiti(price: number | null | undefined, settings: BuyerSettings): PitiBreakdown {
  if (!price || price <= 0) {
    return { pi: 0, tax: 0, insurance: 0, hoa: 0, monthly: 0, loan: 0, downAmount: 0 };
  }

  const downAmount = price * settings.downPct;
  const loan = price - downAmount;

  const monthlyRate = settings.rate / 12;
  const n = settings.termYears * 12;

  let pi: number;
  if (monthlyRate === 0) {
    pi = loan / n;
  } else {
    const factor = Math.pow(1 + monthlyRate, n);
    pi = loan * (monthlyRate * factor) / (factor - 1);
  }

  const tax = price * settings.taxRate / 12;
  const insurance = (settings.insuranceBase + price * settings.insurancePerThousand) / 12;
  const hoa = settings.hoaMonthly;

  const monthly = pi + tax + insurance + hoa;

  return { pi, tax, insurance, hoa, monthly, loan, downAmount };
}

/** Format a dollar amount with no decimals and thousands separators. */
export function formatMoney(value: number): string {
  return '$' + Math.round(value).toLocaleString('en-US');
}

/** Format the PITI caption shown under the monthly headline.
 *  Example: "EST. PITI · 30YR FIXED · 6.8% · 20% DOWN" */
export function formatPitiCaption(settings: BuyerSettings): string {
  const ratePct = (settings.rate * 100).toFixed(2).replace(/\.?0+$/, '');
  const downPct = (settings.downPct * 100).toFixed(0);
  return `EST. PITI  ·  ${settings.termYears}YR FIXED  ·  ${ratePct}%  ·  ${downPct}% DOWN`;
}
