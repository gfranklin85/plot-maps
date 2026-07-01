// ── statement — the live pre-close Buyer's Statement ──────────────────
//
// Pure functions. Takes the already-computed OfferBreakdown (costEngine) +
// the OfferInputs and REGROUPS the same lines into the real Final Buyer's
// Statement sections a buyer/escrow actually reads (Financial Consideration /
// Prorations / New Loan Charges / Title & Escrow / Government / Miscellaneous),
// as DEBITS vs CREDITS that balance to the funds due. No new math — this is the
// presentation of the same truth in the document's shape.
//
// Mirrors the Chicago Title "Final Buyer's Statement" samples.
// See memory/project_live_buyers_statement.

import type {
  OfferInputs,
  OfferBreakdown,
  CostLine,
  StatementLine,
  StatementSection,
  BuyersStatement,
  OfferPosition,
} from './types';

const r0 = (n: number) => Math.round(n);

// Pull a closing-cost / prepaid line out of the breakdown by key (so we can
// place each in its real statement section).
function pick(lines: CostLine[], key: string): CostLine | undefined {
  return lines.find((l) => l.key === key);
}

function debit(line: CostLine | undefined, detail?: string): StatementLine[] {
  if (!line || line.amount <= 0) return [];
  return [{ ...line, side: 'debit', detail }];
}

/**
 * Build the live Buyer's Statement from a computed breakdown. `providers`
 * optionally supplies the responsible party per line key (lender/title/etc.)
 * so lines carry a name the way the real document does.
 */
export function buildStatement(
  inputs: OfferInputs,
  b: OfferBreakdown,
  providers: Record<string, string> = {},
): BuyersStatement {
  const price = Math.max(0, inputs.purchasePrice);
  const cc = b.cashToClose;
  const withProvider = (l: StatementLine): StatementLine =>
    providers[l.key] ? { ...l, provider: providers[l.key] } : l;

  // ── FINANCIAL CONSIDERATION ──
  const financial: StatementLine[] = [
    { key: 'sale-price', label: 'Sale price of property', amount: price, source: 'buyer-entered', side: 'debit' },
  ];
  if ((inputs.earnestDeposit ?? 0) > 0) {
    financial.push({ key: 'deposit', label: 'Deposit', amount: r0(inputs.earnestDeposit!), source: 'buyer-entered', side: 'credit', note: 'Your earnest money, already in.' });
  }
  if (b.loanAmount > 0) {
    financial.push({ key: 'loan', label: 'Loan amount', amount: b.loanAmount, source: inputs.interestRate.source, side: 'credit', provider: providers['lender'], note: 'The lender funds this at close.' });
  }
  if ((inputs.sellerCredit ?? 0) > 0) {
    financial.push({ key: 'seller-credit', label: 'Seller credit', amount: r0(inputs.sellerCredit!), source: 'buyer-entered', side: 'credit', note: 'Negotiated — reduces what you bring.' });
  }

  // ── PRORATIONS / ADJUSTMENTS ──
  const taxMonthly = b.monthly.propertyTax.amount;
  const perDiemTax = (taxMonthly * 12) / 360;
  const prorateDays = Math.max(0, Math.min(180, inputs.closeOfEscrowDays));
  const prorations: StatementLine[] = perDiemTax > 0 && prorateDays > 0
    ? [{
        key: 'tax-proration',
        label: 'County taxes',
        amount: r0(perDiemTax * prorateDays),
        source: inputs.annualTaxRatePct.source,
        side: 'debit',
        detail: `$${perDiemTax.toFixed(2)}/day × ${prorateDays} days`,
      }]
    : [];

  // ── NEW LOAN CHARGES (the lender's section) ──
  const lender = providers['lender'];
  const loanCharges: StatementLine[] = [
    ...debit(withProvider({ ...(pick(cc.closingCosts, 'points') ?? emptyLine('points')), side: 'debit', provider: lender } as StatementLine)),
    ...debit({ ...(pick(cc.closingCosts, 'lender') ?? emptyLine('lender')), side: 'debit', provider: lender } as StatementLine),
    ...debit({ ...(pick(cc.prepaids, 'prepaid-int') ?? emptyLine('prepaid-int')), side: 'debit', provider: lender } as StatementLine),
    ...debit({ ...(pick(cc.prepaids, 'impound-ins') ?? emptyLine('impound-ins')), side: 'debit', provider: lender } as StatementLine, `${3} months insurance impound`),
    ...debit({ ...(pick(cc.prepaids, 'impound-tax') ?? emptyLine('impound-tax')), side: 'debit', provider: lender } as StatementLine, `${3} months tax impound`),
  ];
  const loanChargesSubtotal = r0(loanCharges.reduce((s, l) => s + l.amount, 0));

  // ── TITLE & ESCROW ──
  const titleCo = providers['title'];
  const titleEscrow: StatementLine[] = [
    ...debit({ ...(pick(cc.closingCosts, 'escrow') ?? emptyLine('escrow')), side: 'debit', provider: titleCo } as StatementLine),
    ...debit({ ...(pick(cc.closingCosts, 'title') ?? emptyLine('title')), side: 'debit', provider: titleCo } as StatementLine),
  ];

  // ── GOVERNMENT CHARGES ──
  const government: StatementLine[] = debit(
    { ...(pick(cc.closingCosts, 'recording') ?? emptyLine('recording')), side: 'debit', provider: titleCo } as StatementLine,
  );

  // ── MISCELLANEOUS (annual insurance premium the buyer prepays) ──
  const misc: StatementLine[] = [];
  const insMonthly = b.monthly.insurance.amount;
  if (insMonthly > 0) {
    misc.push({
      key: 'ins-premium',
      label: "Homeowner's insurance premium",
      amount: r0(insMonthly * 12),
      source: b.monthly.insurance.source,
      side: 'debit',
      provider: providers['insurance'],
      detail: '12 months, paid at close',
    });
  }

  const sections: StatementSection[] = [
    { id: 'financial', title: 'Financial consideration', lines: financial },
    { id: 'prorations', title: 'Prorations / adjustments', lines: prorations },
    { id: 'loan', title: 'New loan charges', lines: loanCharges, subtotalLabel: 'Total loan charges', subtotal: loanChargesSubtotal },
    { id: 'title', title: 'Title & escrow charges', lines: titleEscrow },
    { id: 'government', title: 'Government charges', lines: government },
    { id: 'misc', title: 'Miscellaneous charges', lines: misc },
  ].filter((s) => s.lines.length > 0);

  let totalDebits = 0;
  let totalCredits = 0;
  for (const s of sections) {
    for (const l of s.lines) {
      if (l.side === 'debit') totalDebits += l.amount;
      else totalCredits += l.amount;
    }
  }
  totalDebits = r0(totalDebits);
  totalCredits = r0(totalCredits);

  return {
    sections,
    totalDebits,
    totalCredits,
    // What the buyer must bring = debits − credits (the "Buyer's Funds to Close").
    balanceDueFromBuyer: r0(totalDebits - totalCredits),
  };
}

function emptyLine(key: string): CostLine {
  return { key, label: '', amount: 0, source: 'pending-application' };
}

/**
 * How this offer sits against list + the area market. Area comps come from
 * PlotMaps sales data; until the Import is reverified they arrive as
 * 'pending-import' and no range is shown (never faked).
 */
export function buildOfferPosition(
  inputs: OfferInputs,
  areaComps?: { low: number; high: number } | null,
): OfferPosition {
  const offerPrice = Math.max(0, inputs.purchasePrice);
  const listPrice = inputs.listPrice;
  const sqft = inputs.livingAreaSqft && inputs.livingAreaSqft > 0 ? inputs.livingAreaSqft : undefined;
  const offerPerSqft = sqft ? offerPrice / sqft : undefined;

  const vsListDollars = listPrice != null ? offerPrice - listPrice : undefined;
  const vsListPct = listPrice ? (offerPrice - listPrice) / listPrice * 100 : undefined;

  let areaPositionPct: number | null = null;
  if (areaComps && offerPerSqft != null && areaComps.high > areaComps.low) {
    areaPositionPct = Math.max(0, Math.min(1, (offerPerSqft - areaComps.low) / (areaComps.high - areaComps.low)));
  }

  return {
    listPrice,
    offerPrice,
    vsListDollars,
    vsListPct,
    offerPerSqft,
    areaPerSqftLow: areaComps?.low,
    areaPerSqftHigh: areaComps?.high,
    areaPositionPct,
    areaCompsSource: areaComps ? 'plotmaps-sales' : 'pending-import',
  };
}
