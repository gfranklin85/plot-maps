// ── Offer flow i18n — first-class, not browser auto-translate ──────────
//
// Greg works with Spanish-speaking clients who today sign English-only
// contracts. Position fixes that: every question + every plain-language
// explanation has a CONTROLLED translation, authored — never machine-guessed
// (machine translation mangles the exact legal/money terms that matter).
//
// A language is a DATA LAYER. Authoring uses keys (TKey); strings live here.
// Adding a language = adding a column, never a code rewrite.
// See memory/project_comprehension_engine_offer (build rule #4).

import type { TKey } from '@/lib/forms/askSpec';

export type Lang = 'en' | 'es';

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇲🇽' },
];

/** locale tables: key → { en, es }. Authored as we build each page.
    A missing es falls back to en so nothing ever renders blank. */
type Entry = { en: string; es?: string };

const STRINGS: Record<string, Entry> = {
  // ── masthead ──
  'offer.eyebrow': { en: 'Your Offer · in plain language', es: 'Tu Oferta · en lenguaje sencillo' },
  'offer.title': { en: "Let's build your offer together.", es: 'Construyamos tu oferta juntos.' },

  // ── money section (authored page-by-page; seeds below) ──
  'money.section.title': { en: 'The money', es: 'El dinero' },

  'q.monthly.question': {
    en: 'How much can you comfortably pay each month?',
    es: '¿Cuánto puedes pagar cómodamente cada mes?',
  },
  'q.monthly.help': {
    en: 'This is the only number that really matters — what fits your life. Everything else, we figure out from this.',
    es: 'Este es el único número que de verdad importa — lo que cabe en tu vida. Todo lo demás lo calculamos a partir de esto.',
  },
  'q.monthly.placeholder': { en: '$2,200 / month', es: '$2,200 / mes' },

  // a jargon sponsor example (rule: no jargon without a sponsor)
  'term.downpayment.word': { en: 'down payment', es: 'pago inicial' },
  'term.downpayment.plain': {
    en: "The cash you put in up front, out of your own pocket. The rest is the loan.",
    es: 'El dinero que pones por adelantado, de tu propio bolsillo. El resto es el préstamo.',
  },
  'term.downpayment.example': {
    en: 'On a $400,000 home, putting 20% down means $80,000 from you, $320,000 from the loan.',
    es: 'En una casa de $400,000, poner el 20% inicial significa $80,000 de ti y $320,000 del préstamo.',
  },

  // ── engine chrome ──
  'ui.continue': { en: 'Continue', es: 'Continuar' },
  'ui.back': { en: 'Back', es: 'Atrás' },
  'ui.understand': { en: 'Got it — I understand', es: 'Entendido — lo comprendo' },
  'ui.askOt': { en: 'Ask OT about this', es: 'Pregúntale a OT sobre esto' },
  'ui.whatsThis': { en: "what's this?", es: '¿qué es esto?' },
};

/** Resolve a key for a language, falling back to en, then the raw key. */
export function t(key: TKey, lang: Lang): string {
  const entry = STRINGS[key];
  if (!entry) return key; // surfaces missing keys loudly in dev
  return (lang === 'en' ? entry.en : entry.es ?? entry.en) ?? key;
}

/** True if a key exists (used by the engine to skip empty optionals). */
export function hasKey(key?: TKey): boolean {
  return !!key && key in STRINGS;
}
