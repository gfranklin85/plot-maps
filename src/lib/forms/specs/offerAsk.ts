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
        // NEXT (with Greg): any other term that's genuinely the BUYER's to
        // set (possession date? what conveys?). Keep weeding anything that
        // was never in the buyer's control — those reflect from the crew.
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
        // NEXT: monthly-first SANITY CHECK ("does this number fit your
        // life?") — a reassurance, not the offer itself.
      ],
    },
  ],
  certificate: undefined, // capstone — authored last
};
