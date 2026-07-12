// ── The Offer Package — the deal room's source of truth ───────────────
//
// One offer = one indivisible PACKAGE. The represented buyer arrived as one
// thing (buyer + agent + their offer + the agreed compensation), so it is
// delivered as one thing. The listing side takes the whole package or sends
// the whole package back — they cannot cleave it to keep the value while
// discarding the cost of the value.
//
// This model is the CONTRACT between every deal-room surface:
//   · OfferMaker (the RPA AskFlow) POPULATES it,
//   · the Buyer-Broker Compensation Agreement AUTHORIZES the sealed posture,
//   · the comp-ack gate (/lobby/[id]) CONSUMES it — showing the cover sheet
//     above the gate and the full terms only after acknowledgment.
//
// memory: project_deal_room (the wedge), project_deal_room_language (the
// phrases that land — reuse verbatim), the_thesis (meet the person).

// ── People ────────────────────────────────────────────────────────────
// Nothing here is hidden for privacy. The buyer's agent proudly delivers
// their offer — name + buyer visible BY CHOICE. The only thing sealed behind
// the gate is sealed on purpose, as leverage the buyer chose.

export interface Party {
  name: string;
  /** Brokerage / firm, for agents. */
  firm?: string;
  /** For notification only — never shown across to the other side as a lever. */
  email?: string;
}

export interface AgentParty extends Party {
  firm: string;
  /** DRE / license #, shown to establish this is a real licensed agent. */
  license?: string;
}

// ── The property the offer is on ──────────────────────────────────────
// A deal room does NOT require an MLS match. The agent can open a room for
// any property. "Listing not found" is banned.

export interface OfferProperty {
  address: string;
  /** Optional hero image (listing photo or a map still). */
  image?: string;
  /** The list price, when there is one — a room can exist without it. */
  listPrice?: number;
}

// ── The compensation — the thing the gate is built around ─────────────
// The comp is the CONSIDERATION for the representation — it is why the agent
// showed up. It rides WITH the offer as one package.

export interface Compensation {
  /** The buyer-broker compensation being requested, in dollars… */
  amount?: number;
  /** …or as a percent of price, whichever the BBCA established. */
  percent?: number;
  /** Plain-language restatement of the ask, e.g. "2.5% of the purchase price". */
  display: string;
}

// ── The buyer's written authorization of the sealed posture ───────────
// The "closed until you acknowledge" play is the BUYER's — co-signed with
// their agent as a shared position, NOT the agent imposing it. Authorized
// via the Buyer-Broker Compensation Agreement (a TurboTax-style AskFlow).
// This is what answers the seller's "says who?" — it says the buyer.

export interface BuyerAuthorization {
  /** Did the buyer authorize presenting offer + comp as one sealed package? */
  authorized: boolean;
  /** The instrument that carries it (BBCA), for the record. */
  instrument: string; // e.g. "Buyer-Broker Compensation Agreement"
  /** ISO timestamp the buyer co-signed the posture. */
  signedAt?: string;
}

// ── The offer's economic terms — sealed until acknowledgment ──────────
// The full RPA-equivalent set. OfferMaker (OFFER_ASK) populates this. Kept
// intentionally lean here — the fields the cover sheet + net waterfall need
// first; the long tail (cost allocation, item lists, form toggles) folds in
// as OfferMaker grows. Mirrors the shape proven in the deal-room-prototype.

export interface OfferTerms {
  purchasePrice: number;
  loanType: 'Cash' | 'Conventional' | 'FHA' | 'VA' | 'Other';
  downPayment?: number;
  loanAmount?: number;
  initialDeposit?: number;
  /** Close-of-escrow: a day count from acceptance, or a set date (ISO). */
  closeOfEscrowDays?: number;
  closeOfEscrowDate?: string;
  /** Contingency day counts; `null` = waived (stated with confidence). */
  inspectionContingencyDays?: number | null;
  appraisalContingencyDays?: number | null;
  loanContingencyDays?: number | null;
  /** A human-life milestone the deal honestly rides on (optional). */
  lifeContingency?: string;
  /** When the offer expires if not answered (ISO). */
  expiresAt?: string;
}

// ── The cover sheet — what the seller sees ABOVE the gate ─────────────
// The "why you should open this" summary. Enough to know the offer is real
// and worth acknowledging — never the sealed terms (price, etc.).

export interface CoverSheet {
  /** The buyer's qualification posture in plain terms, e.g. "Pre-approved,
      conventional financing" or "Cash, proof of funds attached". */
  qualification: string;
  /** A one-line, non-anchoring reason to open — dimensional, not a number. */
  headline?: string;
}

// ── The whole package ─────────────────────────────────────────────────

export type DealRoomStatus =
  | 'sealed'        // gate up — comp not yet acknowledged
  | 'open'          // acknowledged — terms visible
  | 'sent-back'     // seller declined to acknowledge the comp; package returned
  | 'selected'      // seller selected this offer → deal room's job ends
  | 'declined';     // seller declined the offer itself (after opening)

export interface OfferPackage {
  id: string;
  status: DealRoomStatus;

  property: OfferProperty;
  buyer: Party;
  buyerAgent: AgentParty;
  /** The listing agent this package was delivered to (the acknowledger). */
  listingAgent?: AgentParty;

  compensation: Compensation;
  authorization: BuyerAuthorization;
  coverSheet: CoverSheet;

  /** Sealed until `status` moves past 'sealed'. Consumers must not render
      these while status === 'sealed'. */
  terms: OfferTerms;

  /** ISO — when the package was minted (the room's birth). */
  createdAt: string;
}

// ── A demo package, so the gate is REAL against realistic data ────────
// Replaced by minted packages once OfferMaker writes them. Kept plain-English
// and human — this is a person's offer, not a test fixture.

export const DEMO_PACKAGE: OfferPackage = {
  id: 'demo',
  status: 'sealed',
  property: {
    address: '4820 Sycamore Ridge Rd, Lemoore, CA 93245',
    listPrice: 615000,
  },
  buyer: { name: 'Daniel & Rosa Ibarra' },
  buyerAgent: {
    name: 'Greg Franklin',
    firm: 'Position Realty',
    license: 'DRE #02012345',
  },
  listingAgent: {
    name: 'Maria Hernandez',
    firm: 'Horizon Real Estate',
  },
  compensation: {
    percent: 2.5,
    display: '2.5% of the purchase price',
  },
  authorization: {
    authorized: true,
    instrument: 'Buyer-Broker Compensation Agreement',
    signedAt: '2026-07-10T18:30:00Z',
  },
  coverSheet: {
    qualification: 'Pre-approved · conventional financing · proof of funds ready',
    headline: 'A real, qualified buyer with a clean, straightforward offer.',
  },
  terms: {
    purchasePrice: 628000,
    loanType: 'Conventional',
    downPayment: 157000,
    loanAmount: 471000,
    initialDeposit: 18000,
    closeOfEscrowDays: 30,
    inspectionContingencyDays: 10,
    appraisalContingencyDays: null,
    loanContingencyDays: 17,
    expiresAt: '2026-07-14T17:00:00Z',
  },
  createdAt: '2026-07-11T16:00:00Z',
};

export function findPackage(id: string): OfferPackage {
  // Everything resolves to a real package — a room is never "not found".
  // (Wired to minted packages when OfferMaker persists them.)
  return { ...DEMO_PACKAGE, id };
}
