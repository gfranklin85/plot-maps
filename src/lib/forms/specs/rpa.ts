// ── RPA flow spec — the Purchase Offer ────────────────────────────────
//
// Plot's OWN purchase-offer instrument as DATA (rendered by FormFlow).
// Page 1 (objective + money) is ported verbatim from the proven hand-built
// RpaFlow. Greg (CA Broker) authors the remaining pages page-by-page from
// docs/rpa-teardown.md — append FlowSections below; the engine renders them.

import type { PlotFlow } from '@/lib/forms/flowSpec';

export const RPA_FLOW: PlotFlow = {
  slug: 'rpa',
  eyebrow: 'Purchase Offer · the negotiation',
  title: "Let's build your offer.",
  tagline: "This isn't a form. Every line is a card. We'll show you which ones to play.",
  objectivePrompt: {
    heading: 'First — what are you trying to win here?',
    body:
      'Before a single number goes down, decide your goal. The same finances ' +
      'get presented differently depending on what you want. This choice ' +
      'quietly shapes every disclosure ahead.',
  },
  objectives: [
    {
      key: 'win-certainty',
      icon: 'verified',
      title: 'Win on certainty',
      body: "Beat other offers. Show strength, signal you'll close, make the seller feel safe picking you.",
      accent: '#1b9e6a',
    },
    {
      key: 'keep-room',
      icon: 'open_in_full',
      title: 'Keep your room',
      body: "Leave space to renegotiate after inspection and don't invite a higher counter. Show only what forms the contract.",
      accent: '#b8860b',
    },
  ],
  sections: [
    {
      id: 'money',
      title: 'The money — and what it tells them',
      introByObjective: {
        'win-certainty':
          "You're going for certainty — so we'll let you show strength on purpose. But you still choose each card.",
        'keep-room':
          "You're keeping your room — so we'll fill only what makes the contract real, and flag every extra that sends a message.",
      },
      requiredHeading: 'Required — this is what makes the offer real',
      requiredNote: "No law makes you say more than this. Price, how you're paying, and the bar that lets you walk.",
      required: [
        { id: 'price', label: 'Purchase price', placeholder: '$429,000', type: 'money' },
        { id: 'finance', label: 'Cash or financed?', placeholder: 'Financed — conventional' },
        { id: 'coe', label: 'Close of escrow', placeholder: '30 days after acceptance', type: 'text' },
      ],
      volunteeredHeading: 'Optional — these are cards. Play them on purpose.',
      volunteeredNote: "None of these are required by law. Each one tells the other side something. We'll tell you what.",
      volunteered: [
        {
          id: 'rate-ceiling',
          label: "Loan rate ceiling ('not to exceed __%')",
          tell: "Tells their agent how tight your loan qualification is. A low cap reads as 'stretched.'",
          recommendWhen: ['win-certainty'],
        },
        {
          id: 'cash-reserves',
          label: 'Exact cash-to-close / reserves',
          tellByObjective: {
            'win-certainty': 'A big number says "I\'m strong, you can count on me." That helps you here.',
            'keep-room': 'A big number invites them to push you on repairs; a thin one says "squeeze me." Either way it\'s a message.',
          },
          recommendWhen: ['win-certainty'],
        },
        {
          id: 'points',
          label: 'Points / rate-buydown detail',
          tell: 'Extra granularity about your financing. Rarely helps you; mostly just shows your hand.',
        },
      ],
    },
    // ── NEXT: contingencies (inspection / loan / appraisal) — the real
    //    outs. Author from docs/rpa-teardown.md, page by page, as more
    //    FlowSections here. ──────────────────────────────────────────
  ],
  reviewNote:
    'Here’s your whole offer in plain English — every card you played and what it says. Read it once more, then e-sign.',
};
