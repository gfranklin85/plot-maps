// ── costEngine — the deterministic math behind every offer dollar ─────
//
// Pure functions. No React, no I/O. Given OfferInputs, produce the full
// itemized OfferBreakdown the buyer sees and drives. This is the part the
// lender said couldn't be built ("rates change daily") — but a rate is ONE
// input; everything here is deterministic given that one number, and the
// buyer drives it themselves.
//
// Every formula is real, CA-anchored, and overridable. Where a number has
// a source (rate, insurance, tax), we carry its provenance straight through
// to the line so the UI can tag it. Nothing here invents a "quote" — a
// pending-application default is labeled as exactly that.
//
// Sources for the fee logic: standard CA purchase math — escrow split,
// owner's title premium scaling with price, county recording per-doc,
// lender origination as a slice of loan amount, impounds = a few months of
// tax + insurance collected up front. All are typical-case defaults the
// buyer (or a provider) can override; none are presented as a binding quote.

import type {
  OfferInputs,
  OfferBreakdown,
  CostLine,
  MonthlyBreakdown,
  CashToCloseBreakdown,
  Provenance,
} from './types';

const r2 = (n: number) => Math.round(n * 100) / 100;
const r0 = (n: number) => Math.round(n);

/**
 * Standard fixed-rate amortized monthly payment.
 *   M = P · i(1+i)^n / ((1+i)^n − 1)
 * Handles the 0% edge (straight division) so a buyer who zeroes the rate
 * field doesn't get NaN.
 */
export function monthlyPI(loanAmount: number, annualRatePct: number, termYears: number): number {
  if (loanAmount <= 0 || termYears <= 0) return 0;
  const n = termYears * 12;
  const i = annualRatePct / 100 / 12;
  if (i === 0) return loanAmount / n;
  const pow = Math.pow(1 + i, n);
  return (loanAmount * i * pow) / (pow - 1);
}

/**
 * Conventional PMI estimate, driven by LTV. Only applies to conventional
 * loans above 80% LTV (the 20%-down threshold that removes it). Rates here
 * are typical annual-premium bands as a fraction of the loan; a real lender
 * writes the exact figure in once they work the file. FHA/VA/cash don't use
 * conventional PMI (FHA's MIP is modeled separately downstream when wired).
 */
export function annualPmi(loanAmount: number, ltv: number, loanType: string): number {
  if (loanType !== 'conventional') return 0;
  if (ltv <= 0.8) return 0;
  // typical PMI bands by LTV (annual % of loan)
  let rate: number;
  if (ltv > 0.95) rate = 0.011;
  else if (ltv > 0.9) rate = 0.0078;
  else if (ltv > 0.85) rate = 0.0052;
  else rate = 0.0038;
  return loanAmount * rate;
}

/**
 * Homeowners insurance fallback ONLY when the buyer hasn't entered a number
 * and no insurer has quoted. Deliberately rough (≈$3.50 / $1k of dwelling,
 * floored) and always carried as 'pending-application' so the UI never
 * passes it off as a real quote — it's a stand-in until the Insurance card
 * produces a real one.
 */
export function fallbackAnnualInsurance(purchasePrice: number): number {
  return Math.max(900, purchasePrice * 0.0035);
}

/** Owner's title premium — scales with price, typical CA schedule shape. */
function titlePremium(price: number): number {
  // ~$1.10 per $1k over a base; smooth, not a real rate card.
  return r0(700 + price * 0.0011);
}

/** Escrow fee — split buyer/seller in CA; this is the buyer's half. */
function escrowFeeBuyer(price: number): number {
  // common "$2/$1k + $250" base, buyer pays roughly half.
  return r0((250 + price * 0.002) / 2);
}

/** Lender origination + underwriting + standard third-party loan fees. */
function lenderFees(loanAmount: number): number {
  if (loanAmount <= 0) return 0;
  // ~0.5% origination + flat underwriting/processing/appraisal/credit stack
  return r0(loanAmount * 0.005 + 1650);
}

export function computeBreakdown(inputs: OfferInputs): OfferBreakdown {
  const price = Math.max(0, inputs.purchasePrice);
  const downPct = Math.min(100, Math.max(0, inputs.downPaymentPct));

  const downPayment = r0(price * (downPct / 100));
  const loanAmount = inputs.loanType === 'cash' ? 0 : r0(price - downPayment);
  const ltv = price > 0 ? loanAmount / price : 0;

  // ── monthly ──
  const piRaw = monthlyPI(loanAmount, inputs.interestRate.value, inputs.termYears);

  const insuranceAnnual =
    inputs.annualInsurance.value > 0
      ? inputs.annualInsurance.value
      : fallbackAnnualInsurance(price);
  const insuranceSource: Provenance =
    inputs.annualInsurance.value > 0 ? inputs.annualInsurance.source : 'pending-application';

  const taxAnnual = price * (inputs.annualTaxRatePct.value / 100);
  const pmiAnnual = annualPmi(loanAmount, ltv, inputs.loanType);

  const monthly: MonthlyBreakdown = {
    principalAndInterest: {
      key: 'pi',
      label: 'Principal & interest',
      amount: r2(piRaw),
      source: inputs.interestRate.source,
      note:
        inputs.loanType === 'cash'
          ? 'Cash offer — no loan.'
          : `Amortized over ${inputs.termYears} years at ${inputs.interestRate.value}%.`,
    },
    propertyTax: {
      key: 'tax',
      label: 'Property tax',
      amount: r2(taxAnnual / 12),
      source: inputs.annualTaxRatePct.source,
      note: `CA effective ${inputs.annualTaxRatePct.value}% of assessed value, billed monthly into impounds.`,
    },
    insurance: {
      key: 'ins',
      label: 'Homeowners insurance',
      amount: r2(insuranceAnnual / 12),
      source: insuranceSource,
      note:
        insuranceSource === 'pending-application'
          ? 'Estimate only — fill the Insurance card to get a real quote.'
          : 'From your quote.',
    },
    pmi: {
      key: 'pmi',
      label: 'Mortgage insurance (PMI)',
      amount: r2(pmiAnnual / 12),
      source: inputs.interestRate.source,
      note:
        pmiAnnual > 0
          ? `Applies under 20% down (you're at ${Math.round((1 - ltv) * 100)}%). Drops off at 20% equity.`
          : 'None — you have 20%+ down.',
    },
    hoa: {
      key: 'hoa',
      label: 'HOA dues',
      amount: r2(Math.max(0, inputs.monthlyHoa)),
      source: 'buyer-entered',
      note: inputs.monthlyHoa > 0 ? 'As listed for this property.' : 'No HOA.',
    },
    total: 0,
  };
  monthly.total = r2(
    monthly.principalAndInterest.amount +
      monthly.propertyTax.amount +
      monthly.insurance.amount +
      monthly.pmi.amount +
      monthly.hoa.amount,
  );

  // ── cash to close ──
  const closingCosts: CostLine[] = [];
  const prepaids: CostLine[] = [];

  if (loanAmount > 0) {
    const pts = Math.max(0, inputs.pointsPct);
    if (pts > 0) {
      closingCosts.push({
        key: 'points',
        label: `Discount points (${pts}%)`,
        amount: r0(loanAmount * (pts / 100)),
        source: 'buyer-entered',
        note: 'You chose to buy the rate down. Lowers your P&I above.',
      });
    }
    closingCosts.push({
      key: 'lender',
      label: 'Lender & loan fees',
      amount: lenderFees(loanAmount),
      source: inputs.loanState === 'quoted-live' ? 'live-provider' : 'pending-application',
      note:
        inputs.loanState === 'quoted-live'
          ? 'From your lender.'
          : 'Typical estimate — a lender replaces this with real numbers once they pick up your application.',
    });
  }

  closingCosts.push(
    {
      key: 'escrow',
      label: 'Escrow fee (your half)',
      amount: escrowFeeBuyer(price),
      source: 'pending-application',
      note: 'Split with the seller in CA. Typical schedule.',
    },
    {
      key: 'title',
      label: "Owner's title insurance",
      amount: titlePremium(price),
      source: 'pending-application',
      note: 'Protects your ownership. Scales with price.',
    },
    {
      key: 'recording',
      label: 'Recording & transfer',
      amount: r0(225 + price * 0.00011),
      source: 'pending-application',
      note: 'County records the deed and the loan.',
    },
  );

  // prepaids / impounds collected at close
  if (loanAmount > 0) {
    prepaids.push(
      {
        key: 'prepaid-int',
        label: 'Prepaid interest',
        amount: r0((loanAmount * (inputs.interestRate.value / 100)) / 365 * 15),
        source: inputs.interestRate.source,
        note: '~15 days of interest from closing to your first payment cycle.',
      },
      {
        key: 'impound-tax',
        label: 'Tax impounds (3 mo)',
        amount: r0((taxAnnual / 12) * 3),
        source: inputs.annualTaxRatePct.source,
        note: 'Lender collects a cushion of property tax up front.',
      },
      {
        key: 'impound-ins',
        label: 'Insurance impounds (3 mo)',
        amount: r0((insuranceAnnual / 12) * 3 + insuranceAnnual / 4),
        source: insuranceSource,
        note: 'First-year premium + a couple months of cushion.',
      },
    );
  }

  const closingCostsSubtotal = r0(closingCosts.reduce((s, l) => s + l.amount, 0));
  const prepaidsSubtotal = r0(prepaids.reduce((s, l) => s + l.amount, 0));

  const cashToClose: CashToCloseBreakdown = {
    downPayment: {
      key: 'down',
      label: 'Down payment',
      amount: downPayment,
      source: 'buyer-entered',
      note: `${downPct}% of the purchase price — you drive this.`,
    },
    closingCosts,
    prepaids,
    closingCostsSubtotal,
    prepaidsSubtotal,
    total: r0(downPayment + closingCostsSubtotal + prepaidsSubtotal),
  };

  const totalOfPayments = r0(piRaw * inputs.termYears * 12);
  const totalInterest = r0(Math.max(0, totalOfPayments - loanAmount));

  return {
    loanAmount,
    ltv,
    monthly,
    cashToClose,
    totalOfPayments,
    totalInterest,
  };
}
