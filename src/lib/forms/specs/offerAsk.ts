// ── The Offer, as an ASK flow ─────────────────────────────────────────
//
// Authored page-by-page WITH Greg (the broker). Property-AGNOSTIC (home,
// land, commercial — residential authored first). Flow order:
//   1. TARGET   — what property (address autocomplete)
//   2. TERMS    — the lever you pull to win the bid; stated with confidence,
//                 never "remove contingency." Carries the ownership posture.
//   3. NUMBER   — what I'll pay FOR this property.
// Loan + appraisal contingencies are deliberately ABSENT: a competing lender
// already guaranteed those (the NASCAR pit-crew). The buyer only sets what's
// actually theirs to set (inspection). All strings are i18n keys.
// See memory/project_comprehension_engine_offer.

import type { AskFlow } from '@/lib/forms/askSpec';

export const OFFER_ASK: AskFlow = {
  slug: 'rpa',
  eyebrow: 'offer.eyebrow',
  title: 'offer.title',
  sections: [
    // ── 1. TARGET — property-agnostic. Pre-fills from a map handoff; else
    //    the buyer searches an address. (Autocomplete wires in next.) ──
    {
      id: 'target',
      title: 'target.section.title',
      steps: [
        {
          id: 'property',
          question: 'q.property.question',
          help: 'q.property.help',
          kind: 'text', // becomes an address-autocomplete control next
          placeholder: 'q.property.placeholder',
        },
      ],
    },

    // ── 1b. AGENCY — who represents whom. Comes first, REFLECTED (system/
    //    agent already has it), confirmed not asked. RPA §2. ──
    {
      id: 'agency',
      title: 'target.section.title',
      steps: [
        {
          id: 'agency',
          question: 'q.agency.question',
          help: 'q.agency.help',
          fact: 'q.agency.fact',
          factSource: 'q.agency.factSource',
          kind: 'choice',
          choices: [
            { id: 'ok', label: 'q.agency.confirm', note: 'q.agency.confirm.note' },
          ],
        },
      ],
    },

    // ── 2. TERMS — the lever. Ownership-posture intro, then inspection
    //    stated as a confident affirmation (not a concession). Loan +
    //    appraisal intentionally omitted (lender already owns those). ──
    {
      id: 'terms',
      title: 'terms.section.title',
      intro: 'terms.intro',
      steps: [
        {
          id: 'inspection',
          question: 'q.inspection.question',
          help: 'q.inspection.help',
          // REFLECTED fact from the buyer's assembled crew (not interrogated).
          // The captain confirms a plan they already own; backup stands by
          // (quantum standby). `fact` pre-fills from the crew flow once built.
          fact: 'q.inspection.fact',
          factSource: 'q.inspection.factSource',
          kind: 'choice',
          choices: [
            { id: 'confirm', label: 'inspection.c.confirm', note: 'inspection.c.confirm.note' },
            { id: 'change', label: 'inspection.c.change', note: 'inspection.c.change.note' },
          ],
        },
        // Representation comp — NOT an ask (kills RPA G(3)'s hat-in-hand
        // begging). Shown to the buyer as a SETTLED FACT: costs them nothing,
        // handled before the offer is seen, folded into the seller's NET in
        // the OfferHouse. The buyer just acknowledges + continues.
        {
          id: 'repCost',
          question: 'q.repCost.question',
          help: 'q.repCost.help',
          fact: 'q.repCost.fact',
          factSource: 'q.repCost.factSource',
          kind: 'choice',
          choices: [
            { id: 'ok', label: 'q.repCost.confirm', note: 'q.repCost.confirm.note' },
          ],
        },
        // Possession — Greg's favorite. Plainest language; the buyer usually
        // knew their move-in day before the search started. (Early possession
        // — occupy before closing — deliberately punted: protect the buyer.)
        {
          id: 'possession',
          question: 'q.possession.question',
          help: 'q.possession.help',
          kind: 'choice',
          choices: [
            { id: 'closing', label: 'possession.c.closing', note: 'possession.c.closing.note' },
            { id: 'specific', label: 'possession.c.specific', note: 'possession.c.specific.note' },
          ],
        },
        // Items included/excluded — a fun direct ask with a "how the ask
        // lands" prompt. Homeowner-OG ethic: don't burden people for a clear
        // space. RPA P(1)/P(2).
        {
          id: 'items',
          question: 'q.items.question',
          help: 'q.items.help',
          kind: 'choice',
          choices: [
            { id: 'asis', label: 'items.c.asis', note: 'items.c.asis.note' },
            { id: 'keep', label: 'items.c.keep', note: 'items.c.keep.note' },
          ],
        },
        // Loan type — SHARE (RPA E(1)). The listing agent needs the terms
        // that come with the loan path. Not a vulnerability; useful info.
        {
          id: 'loanType',
          question: 'q.loanType.question',
          help: 'q.loanType.help',
          kind: 'choice',
          choices: [
            { id: 'cash', label: 'loanType.c.cash', note: 'loanType.c.cash.note' },
            { id: 'conventional', label: 'loanType.c.conventional', note: 'loanType.c.conventional.note' },
            { id: 'fha', label: 'loanType.c.fha', note: 'loanType.c.fha.note' },
            { id: 'va', label: 'loanType.c.va', note: 'loanType.c.va.note' },
          ],
        },

        // WEEDED from buyer questions (reflect from crew/system, not asks):
        //  · L(4) Insurance → from the insurance vendor (new to the roster)
        //  · L(6) Prelim Title → early system process, taught not asked
        //  · L(5) Seller disclosure → Position's OWN interactive questionnaire
        //    / buyer-seller Zoom (big own surface — banked)
        // DE-EMPHASIZED: rate "not to exceed X%" (RPA E(1)) — a flaky escape
        //    hatch that signals how stretched the buyer is. Not featured.
        // GUARDED: down payment (RPA F) — a CARD (strength + vulnerability),
        //    handled carefully, not auto-exposed. (Surfaces in number section.)
      ],
    },

    // ── 3. NUMBER — what I'll pay FOR this property ──
    {
      id: 'number',
      title: 'money.section.title',
      steps: [
        {
          id: 'offerPrice',
          question: 'q.offerPrice.question',
          help: 'q.offerPrice.help',
          // ONE number absorbs all costs (RPA Page 3 allocation grid dissolves
          // — buyer covers, folded in). The fact line states the OfferHouse
          // promise: seller sees their real net, no allocation grid ever.
          fact: 'offerPrice.net.fact',
          factSource: 'offerPrice.net.source',
          kind: 'money',
          placeholder: 'q.offerPrice.placeholder',
        },
        // Cash-back toward closing — the BUYER's OWN request for help (RPA
        // G(1) stays — it serves the buyer). Framed as a LEVER with the
        // trade-off shown; "closing costs" carries its jargon sponsor.
        {
          id: 'cashBack',
          question: 'q.cashBack.question',
          help: 'q.cashBack.help',
          terms: [
            { word: 'term.closingcosts.word', plain: 'term.closingcosts.plain' },
          ],
          kind: 'choice',
          choices: [
            { id: 'none', label: 'cashBack.c.none', note: 'cashBack.c.none.note' },
            { id: 'ask', label: 'cashBack.c.ask', note: 'cashBack.c.ask.note' },
          ],
        },
        // Deposit — SHARE (RPA D(1)). Real skin-in-the-game; "good-faith
        // deposit" carries its jargon sponsor.
        {
          id: 'deposit',
          question: 'q.deposit.question',
          help: 'q.deposit.help',
          terms: [
            { word: 'term.deposit.word', plain: 'term.deposit.plain' },
          ],
          kind: 'money',
          placeholder: 'q.deposit.placeholder',
        },

        // Close of escrow — SHARE (RPA B). When it's done + yours.
        {
          id: 'coe',
          question: 'q.coe.question',
          help: 'q.coe.help',
          kind: 'choice',
          choices: [
            { id: 'fast', label: 'coe.c.fast', note: 'coe.c.fast.note' },
            { id: 'normal', label: 'coe.c.normal', note: 'coe.c.normal.note' },
          ],
        },

        // Expiration of offer — SHARE (RPA C). How long it stands.
        {
          id: 'expiration',
          question: 'q.expiration.question',
          help: 'q.expiration.help',
          kind: 'choice',
          choices: [
            { id: 'short', label: 'expiration.c.short', note: 'expiration.c.short.note' },
            { id: 'standard', label: 'expiration.c.standard', note: 'expiration.c.standard.note' },
          ],
        },

        // NEXT: monthly-first SANITY CHECK ("does this number fit your
        // life?") — a reassurance, not the offer itself. Then the seller-NET
        // preview (OfferHouse) the buyer's price produces. Then review + sign
        // + the comprehension certificate.
      ],
    },
  ],
  certificate: undefined, // capstone — authored last
};
