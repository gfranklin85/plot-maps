// ── The Offer, as an ASK flow ─────────────────────────────────────────
//
// Authored page-by-page WITH Greg (the broker). This is the seed: the
// monthly-first anchor question. Everything else (price/loan derived,
// deposit, close, contingencies, certificate) gets added one question at a
// time, live in the dev server. All strings are i18n keys (lib/forms/i18n).
// See memory/project_comprehension_engine_offer.

import type { AskFlow } from '@/lib/forms/askSpec';

export const OFFER_ASK: AskFlow = {
  slug: 'rpa',
  eyebrow: 'offer.eyebrow',
  title: 'offer.title',
  sections: [
    {
      id: 'money',
      title: 'money.section.title',
      steps: [
        {
          id: 'monthly',
          question: 'q.monthly.question',
          help: 'q.monthly.help',
          kind: 'money',
          placeholder: 'q.monthly.placeholder',
          // jargon sponsor demo — "down payment" gets a playground explanation.
          // (This question doesn't use the word yet; it's here to prove the
          // sponsor mechanic renders. Real sponsors attach per-question as we
          // author each page.)
          terms: [
            { word: 'term.downpayment.word', plain: 'term.downpayment.plain', example: 'term.downpayment.example' },
          ],
        },
        // NEXT (with Greg): term length → derive loan → derive price → deposit …
      ],
    },
  ],
  certificate: undefined, // capstone — authored last
};
