// ── Plot Form Builder — the form catalog ──────────────────────────────
//
// Plot's OWN transaction instruments, authored from scratch (NOT CAR's
// copyrighted forms). Each is a TurboTax-style guided flow that:
//   • captures the agent's OBJECTIVE first, then coaches every choice
//     against it,
//   • for each field, distinguishes what's REQUIRED (the enforceable
//     backbone) from what's VOLUNTEERED (a card you may not mean to play),
//     and says — in plain playground language — what message each choice
//     sends,
//   • educates both parties so they actually understand what they're
//     agreeing to,
//   • is e-signature-ready.
//
// See docs/rpa-teardown.md (the page-by-page spec) and
// memory/project_rpa_negotiation_instrument.md (the thesis).
//
// Greg (CA Broker) authors the legal content; this file is the catalog +
// flow metadata the engine renders.

export type FormStatus = 'live' | 'building' | 'planned';

export interface PlotForm {
  /** URL slug: /forms/<slug> */
  slug: string;
  /** Short code agents know it by (Plot's own, not CAR's form number). */
  code: string;
  /** Full plain-language name. */
  name: string;
  /** One-line what-it's-for, in straight talk. */
  blurb: string;
  /** Why it matters / what it protects — the education hook. */
  purpose: string;
  status: FormStatus;
  /** Material icon. */
  icon: string;
  /** Accent hex from the locked palette (project_plot_palette_locked). */
  accent: string;
  /** Rough flow length, for the card. */
  steps?: number;
}

export const PLOT_FORMS: PlotForm[] = [
  {
    slug: 'rpa',
    code: 'Offer',
    name: 'Purchase Offer',
    blurb: 'The offer to buy a home — built as a negotiation, not a form.',
    purpose:
      'Every line is a card. We show you what each term gives away, what it ' +
      'protects, and which way it cuts — so you build an offer around YOUR ' +
      'objective and never hand over leverage by accident.',
    status: 'building',
    icon: 'gavel',
    accent: '#00f2ff',
    steps: 17,
  },
  {
    slug: 'agency-disclosure',
    code: 'Agency',
    name: 'Who Works For Whom',
    blurb: 'Plain-language version of the agency disclosure (the "AD").',
    purpose:
      'Spells out, in straight talk, who your agent actually works for and ' +
      'what dual agency really means — so nobody signs away a champion ' +
      'without knowing it.',
    status: 'planned',
    icon: 'handshake',
    accent: '#4ab6ff',
    steps: 4,
  },
  {
    slug: 'property-questionnaire',
    code: 'Seller Q&A',
    name: 'What The Seller Knows',
    blurb: "The seller's plain-language property disclosure (SPQ/PRBS style).",
    purpose:
      'Turns the seller disclosure into clear questions a human understands, ' +
      'so what the seller knows is actually communicated — and the record ' +
      'protects everyone.',
    status: 'planned',
    icon: 'quiz',
    accent: '#5ed6a8',
    steps: 6,
  },
  {
    slug: 'broker-info',
    code: 'BIA',
    name: 'Broker Info & Advice',
    blurb: 'What your broker is (and is not) doing for you — in plain terms.',
    purpose:
      'Sets honest expectations about the brokerage relationship up front, ' +
      'so the deal has no surprises about who is advising on what.',
    status: 'planned',
    icon: 'badge',
    accent: '#b69dff',
    steps: 3,
  },
  {
    slug: 'fair-housing',
    code: 'FHDA',
    name: 'Fair Housing',
    blurb: 'The fair-housing acknowledgment, written so it actually lands.',
    purpose:
      'Makes the fair-housing commitment clear and real instead of a ' +
      'box-check nobody reads — the right way to stay compliant and human.',
    status: 'planned',
    icon: 'diversity_3',
    accent: '#fbc64f',
    steps: 2,
  },
];

export function findForm(slug: string): PlotForm | undefined {
  return PLOT_FORMS.find((f) => f.slug === slug);
}
