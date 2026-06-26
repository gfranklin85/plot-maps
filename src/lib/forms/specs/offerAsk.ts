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
        // WEEDED from buyer questions (reflect from crew/system, not asks):
        //  · L(4) Insurance → from the insurance vendor (new to the roster)
        //  · L(6) Prelim Title → early system process, taught not asked
        //  · L(5) Seller disclosure → Position's OWN interactive questionnaire
        //    / buyer-seller Zoom (big own surface — banked)
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
        // NEXT: monthly-first SANITY CHECK ("does this number fit your
        // life?") — a reassurance, not the offer itself. Then the seller-NET
        // preview (OfferHouse) the buyer's price produces.
      ],
    },
  ],
  certificate: undefined, // capstone — authored last
};
