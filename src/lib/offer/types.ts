// ── Offer money model — the typed inputs behind the Cost Cockpit ──────
//
// This is the LIVE calculator a buyer makes a real offer from, not a
// planning toy. So every dollar that lands on the breakdown carries a
// PROVENANCE: where did this number come from, and is it real yet?
//
//   • 'live-provider'        — a licensed lender/insurer logged into Plot's
//                              provider portal, worked the file, and wrote
//                              this number in. It's quotable/bindable.
//   • 'buyer-entered'        — the buyer typed what they were quoted
//                              elsewhere. Honest, theirs, not a Plot guess.
//   • 'pending-application'  — Plot is holding a deterministic default while
//                              the buyer's application is in the marketplace
//                              waiting for a provider to claim it.
//
// The provenance is the differentiator made structural: most "calculators"
// hide which numbers are real. We never do. See the Loan Application /
// Insurance cards — filling those is what moves a line from pending →
// buyer-entered → live-provider.
//
// memory: project_active_workstream_prospecting_backend (the marketplace
// loop), project_layered_enrichment_data_model (numbers have sources/tiers).

export type Provenance = 'live-provider' | 'buyer-entered' | 'pending-application';

/** Where a provider-sourceable number is in the marketplace workflow. */
export type ProviderState =
  | 'needs-application'      // buyer hasn't filled the card yet
  | 'application-submitted'  // lead is live, no provider claimed it
  | 'provider-working'       // a provider claimed it, file in progress
  | 'quoted-live';           // a provider wrote a real number back

export type LoanType = 'conventional' | 'fha' | 'va' | 'cash';
export type Occupancy = 'primary' | 'second-home' | 'investment';

/** A single dollar value plus where it came from. */
export interface SourcedNumber {
  value: number;
  source: Provenance;
}

/** The full set of buyer-driven + provider-supplied inputs. */
export interface OfferInputs {
  // ── the buyer drives these directly (always buyer-entered) ──
  purchasePrice: number;
  downPaymentPct: number;     // 0–100; buyer drags this
  loanType: LoanType;
  occupancy: Occupancy;
  termYears: number;          // 30 / 20 / 15
  closeOfEscrowDays: number;

  // ── rate: provider-maintained OR buyer-entered. The lender's only
  //    job in the portal is to keep this (and validUntil) fresh. ──
  interestRate: SourcedNumber;        // annual %, e.g. 6.875
  rateValidUntil?: string;            // ISO date the lender stands behind it
  pointsPct: number;                  // discount points the buyer chooses to buy

  // ── homeowners insurance: estimate until a real insurer quote lands ──
  annualInsurance: SourcedNumber;

  // ── property tax: anchored to CA reality, buyer can override ──
  annualTaxRatePct: SourcedNumber;    // effective annual rate on assessed value

  // ── carrying costs the buyer knows or the listing supplies ──
  monthlyHoa: number;

  // ── the listing context, for offer-vs-list + $/sqft market fit ──
  listPrice?: number;          // what the home is listed at
  livingAreaSqft?: number;     // for $/sqft of this offer

  // ── deposit / earnest money + any seller credit (statement credits) ──
  earnestDeposit?: number;
  sellerCredit?: number;

  // ── marketplace workflow state for the two claimable cards ──
  loanState: ProviderState;
  insuranceState: ProviderState;
}

/** One itemized line on the breakdown, with its source tag. */
export interface CostLine {
  key: string;
  label: string;
  amount: number;
  source: Provenance;
  /** plain-language note — what this is / why it's here */
  note?: string;
  /** the party responsible for this line, as it appears on a real Buyer's
   *  Statement (e.g. "Kind Lending, LLC", "Chicago Title Company"). */
  provider?: string;
  /** when a real person (lender/escrow/insurer) has checked off this line,
   *  their name + optional face — provenance-with-a-face. */
  verifiedBy?: { name: string; avatarUrl?: string };
}

// ── The live pre-close Buyer's Statement ──────────────────────────────
// Mirrors the real Final Buyer's Statement (Chicago Title samples): the same
// computed cost lines, regrouped into the named sections a buyer/escrow
// actually reads, as DEBITS vs CREDITS that balance to the funds due.
// See memory/project_live_buyers_statement.

export type LedgerSide = 'debit' | 'credit';

/** A statement line = a cost line placed on the debit or credit side. */
export interface StatementLine extends CostLine {
  side: LedgerSide;
  /** sub-detail rendered under the line (e.g. proration math, N mo × $/mo). */
  detail?: string;
}

export interface StatementSection {
  id: string;
  title: string;
  lines: StatementLine[];
  /** optional section subtotal label + amount (e.g. "Total Loan Charges"). */
  subtotalLabel?: string;
  subtotal?: number;
}

export interface BuyersStatement {
  sections: StatementSection[];
  totalDebits: number;
  totalCredits: number;
  /** positive = buyer brings funds; negative = balance due TO buyer. */
  balanceDueFromBuyer: number;
}

/** How this offer sits against the list price + the area market. */
export interface OfferPosition {
  listPrice?: number;
  offerPrice: number;
  /** offerPrice − listPrice (negative = under list). */
  vsListDollars?: number;
  vsListPct?: number;
  /** this offer's $/sqft, when living area is known. */
  offerPerSqft?: number;
  /** the area's low–high $/sqft range (from PlotMaps sales data). */
  areaPerSqftLow?: number;
  areaPerSqftHigh?: number;
  /** where the offer's $/sqft falls in the area range, 0–1 (null if no comps). */
  areaPositionPct?: number | null;
  /** provenance of the area comps — 'pending' until Import is reverified. */
  areaCompsSource: 'plotmaps-sales' | 'pending-import';
}

export interface MonthlyBreakdown {
  principalAndInterest: CostLine;
  propertyTax: CostLine;
  insurance: CostLine;
  pmi: CostLine;
  hoa: CostLine;
  total: number;
}

export interface CashToCloseBreakdown {
  downPayment: CostLine;
  /** closing-cost stack — escrow, title, recording, loan fees, points */
  closingCosts: CostLine[];
  /** prepaids / impounds collected at close */
  prepaids: CostLine[];
  closingCostsSubtotal: number;
  prepaidsSubtotal: number;
  total: number;
}

export interface OfferBreakdown {
  loanAmount: number;
  ltv: number;                 // loan-to-value, 0–1
  monthly: MonthlyBreakdown;
  cashToClose: CashToCloseBreakdown;
  /** total of every dollar paid over the life of the loan (P&I only) */
  totalOfPayments: number;
  totalInterest: number;
}

/** Honest CA-anchored defaults. NONE of these are presented as a real
 *  quote — they sit at 'pending-application' until the buyer enters a
 *  number or a provider writes one in. */
export const DEFAULT_INPUTS: OfferInputs = {
  purchasePrice: 429000,
  downPaymentPct: 20,
  loanType: 'conventional',
  occupancy: 'primary',
  termYears: 30,
  closeOfEscrowDays: 30,
  interestRate: { value: 6.875, source: 'pending-application' },
  pointsPct: 0,
  annualInsurance: { value: 0, source: 'pending-application' },
  annualTaxRatePct: { value: 1.1, source: 'pending-application' }, // CA effective ~1.1%
  monthlyHoa: 0,
  loanState: 'needs-application',
  insuranceState: 'needs-application',
};
