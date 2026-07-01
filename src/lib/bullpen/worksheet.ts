// ── The lender fee worksheet spec ─────────────────────────────────────
//
// The single source of truth for the competing lender's "Estimated Fees &
// Cost Worksheet" — the real document a buyer compares (from Dustin Maciel's
// sheet, memory/project_lender_fee_worksheet). The offer form renders these
// sections/lines; /compare stacks them line-for-line; the API stores them as a
// jsonb blob. Change a line here → it flows everywhere.

export type WorksheetValues = Record<string, string>;

export interface WLine {
  id: string;
  label: string;
  kind?: 'money' | 'pct' | 'int' | 'text'; // default money
  hint?: string;
}
export interface WSection {
  id: string;
  title: string;
  lines: WLine[];
}

// Loan header (rate/APR/amount/term drive the top comparison columns).
export const LOAN_HEADER: WLine[] = [
  { id: 'loanType', label: 'Loan type', kind: 'text', hint: 'FHA · Conventional · VA' },
  { id: 'interestRate', label: 'Interest rate', kind: 'pct', hint: '6.125' },
  { id: 'apr', label: 'APR', kind: 'pct', hint: '6.800' },
  { id: 'loanAmount', label: 'Loan amount', hint: '343200' },
  { id: 'loanAmountMip', label: 'Loan amount (w/ MIP)', hint: '349206' },
  { id: 'termMonths', label: 'Term (months)', kind: 'int', hint: '360' },
  { id: 'ltvPct', label: 'Loan-to-value', kind: 'pct', hint: '80' },
  { id: 'marketValue', label: 'Market value', hint: '429000' },
];

export const WORKSHEET: WSection[] = [
  {
    id: 'origination',
    title: 'Origination charges',
    lines: [
      { id: 'originationFee', label: 'Loan origination fee' },
      { id: 'loanPoints', label: 'Loan points ($)', hint: 'Discount points in dollars' },
      { id: 'underwritingFee', label: 'Underwriting fee' },
      { id: 'processingFee', label: 'Processing fee' },
    ],
  },
  {
    id: 'services',
    title: 'Required services',
    lines: [
      { id: 'appraisalFee', label: 'Appraisal fee' },
      { id: 'creditReportFee', label: 'Credit report fee' },
      { id: 'floodCertFee', label: 'Flood certification' },
      { id: 'taxServiceFee', label: 'Tax service' },
      { id: 'appraisalReinspectionFee', label: 'Appraisal re-inspection' },
      { id: 'mersFee', label: 'MERS registration' },
    ],
  },
  {
    id: 'title',
    title: 'Title & closing fees',
    lines: [
      { id: 'settlementEscrowFee', label: 'Settlement / escrow fee' },
      { id: 'ownerTitleIns', label: "Owner's title insurance" },
      { id: 'lenderTitleIns', label: "Lender's title insurance" },
      { id: 'escrowProcessingFee', label: 'Escrow processing' },
      { id: 'notaryFee', label: 'Notary fee' },
      { id: 'wireTransferFee', label: 'Wire transfer' },
      { id: 'endorsementFee', label: 'Endorsement fee' },
    ],
  },
  {
    id: 'recording',
    title: 'Government recording & transfer',
    lines: [
      { id: 'recordingFees', label: 'Recording fees' },
      { id: 'taxStamps', label: 'City / county tax stamps' },
      { id: 'transferTax', label: 'Transfer tax' },
      { id: 'affordableHousingFee', label: 'Affordable housing' },
    ],
  },
  {
    id: 'prepaids',
    title: 'Prepaids',
    lines: [
      { id: 'prepaidInterest', label: 'Prepaid interest' },
      { id: 'mipPrepaid', label: 'Mortgage insurance premium' },
      { id: 'hazardPrepaid', label: 'Hazard insurance premium' },
      { id: 'propertyTaxPrepaid', label: 'Property taxes' },
    ],
  },
  {
    id: 'reserves',
    title: 'Reserves / escrows',
    lines: [
      { id: 'hazardReserve', label: 'Hazard insurance reserve' },
      { id: 'mipReserve', label: 'Mortgage insurance reserve' },
      { id: 'propertyTaxReserve', label: 'Property tax reserve' },
      { id: 'floodReserve', label: 'Flood insurance reserve' },
      { id: 'aggregateAdjustment', label: 'Aggregate adjustment' },
    ],
  },
  {
    id: 'monthly',
    title: 'Estimated monthly payment',
    lines: [
      { id: 'principalInterest', label: 'Principal & interest' },
      { id: 'secondMortgage', label: '2nd mortgage payment' },
      { id: 'hazardInsurance', label: 'Hazard insurance' },
      { id: 'supplementalInsurance', label: 'Supplemental insurance' },
      { id: 'propertyTaxesMonthly', label: 'Property taxes' },
      { id: 'mortgageInsuranceMonthly', label: 'Mortgage insurance' },
      { id: 'hoaDues', label: 'HOA dues' },
      { id: 'otherMonthly', label: 'Other' },
    ],
  },
  {
    id: 'funds',
    title: 'Funds needed to close',
    lines: [
      { id: 'salesContractPrice', label: 'Sales contract price' },
      { id: 'balanceOfPayoffs', label: 'Balance of payoffs' },
      { id: 'debtsPaidOff', label: 'Debts paid off' },
      { id: 'closingCostsPaidBySeller', label: 'Closing costs paid by seller', hint: 'A credit — reduces cash to close' },
      { id: 'ccPaidByLender', label: 'CC paid by lender / other', hint: 'A credit' },
      { id: 'earnestMoney', label: 'Earnest money', hint: 'A credit' },
      { id: 'sellerCredit', label: 'Seller credit', hint: 'A credit' },
    ],
  },
];

const num = (v: string | undefined) => {
  if (!v) return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Sum a set of line ids from the values.
export function sumLines(v: WorksheetValues, ids: string[]): number {
  return ids.reduce((t, id) => t + num(v[id]), 0);
}

// ── Derived totals (mirror the sheet's math) ──────────────────────────
export function totalMonthly(v: WorksheetValues): number {
  return sumLines(v, WORKSHEET.find((s) => s.id === 'monthly')!.lines.map((l) => l.id));
}

// Total closing costs = origination + services + title + recording + prepaids + reserves.
export function totalClosing(v: WorksheetValues): number {
  const ids = ['origination', 'services', 'title', 'recording', 'prepaids', 'reserves']
    .flatMap((sid) => WORKSHEET.find((s) => s.id === sid)!.lines.map((l) => l.id));
  return sumLines(v, ids);
}

// Credits reduce cash to close.
export function totalCredits(v: WorksheetValues): number {
  return sumLines(v, ['closingCostsPaidBySeller', 'ccPaidByLender', 'earnestMoney', 'sellerCredit']);
}

// Cash to/from borrower = price + closing costs − loan amount − credits.
export function cashToClose(v: WorksheetValues): number {
  const price = num(v.salesContractPrice) || num(v.marketValue);
  const loan = num(v.loanAmountMip) || num(v.loanAmount);
  return price + totalClosing(v) - loan - totalCredits(v);
}

export const parseMoney = num;
