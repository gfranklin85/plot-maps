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

  // ── 1. THE TARGET — what property (agnostic: home, land, commercial) ──
  'target.section.title': { en: 'The property', es: 'La propiedad' },

  'q.property.question': {
    en: 'What property are you making an offer on?',
    es: '¿Sobre qué propiedad estás haciendo una oferta?',
  },
  'q.property.help': {
    en: 'An offer is about one specific property. If you came here from the map, it’s already set below. If not, search for the address.',
    es: 'Una oferta es sobre una propiedad específica. Si llegaste desde el mapa, ya está puesta abajo. Si no, busca la dirección.',
  },
  'q.property.placeholder': { en: 'Search an address…', es: 'Busca una dirección…' },

  // ── 2. THE TERMS — engaged as a lever, stated with confidence ──
  'terms.section.title': { en: 'Your terms', es: 'Tus condiciones' },

  // ownership-posture framing shown at the top of terms
  'terms.intro': {
    en: 'Terms aren’t fine print — they’re how you win the deal, and they say what kind of owner you’re about to be. You’re not asking for a favor here. You’re stepping up to take care of this place.',
    es: 'Las condiciones no son letra chica — son cómo ganas el trato, y dicen qué tipo de dueño vas a ser. Aquí no estás pidiendo un favor. Estás dando un paso al frente para cuidar este lugar.',
  },

  // inspection — REFLECTED as an already-settled fact from the crew the buyer
  // assembled upstream (their chosen inspector), confirmed not interrogated.
  'q.inspection.question': {
    en: 'Your inspection is already lined up. Ready to lock it in?',
    es: 'Tu inspección ya está lista. ¿Listo para confirmarla?',
  },
  'q.inspection.help': {
    en: 'You already picked your inspector when you built your crew — they showed you their calendar and how they work. So this isn’t a guess. It’s you confirming a plan you already own. (And a backup is quietly standing by, just in case.)',
    es: 'Ya elegiste a tu inspector cuando armaste tu equipo — te mostró su calendario y cómo trabaja. Así que esto no es una adivinanza. Es confirmar un plan que ya es tuyo. (Y un reemplazo está listo en silencio, por si acaso.)',
  },
  // the settled fact line (crew source pre-fills this once the crew flow exists)
  'q.inspection.fact': {
    en: 'Your inspector is on site within 5 days of acceptance.',
    es: 'Tu inspector estará en el sitio dentro de 5 días de la aceptación.',
  },
  'q.inspection.factSource': {
    en: 'From your ready crew · backup standing by',
    es: 'De tu equipo listo · reemplazo en espera',
  },
  // captain stays in control — confirm or change
  'inspection.c.confirm': { en: 'Yep — that’s my plan. Lock it in.', es: 'Sí — ese es mi plan. Confírmalo.' },
  'inspection.c.confirm.note': { en: 'A statement of confidence. You’re ready.', es: 'Una declaración de confianza. Estás listo.' },
  'inspection.c.change': { en: 'I want to adjust the timing', es: 'Quiero ajustar el tiempo' },
  'inspection.c.change.note': { en: 'You’re the captain — change it if you like.', es: 'Tú eres el capitán — cámbialo si quieres.' },

  // representation comp — surfaced to the buyer as a settled fact (no ask).
  // The seller sees it inside their NET in the OfferHouse, never as a line item.
  'q.repCost.question': {
    en: 'Your representation is already taken care of.',
    es: 'Tu representación ya está cubierta.',
  },
  'q.repCost.help': {
    en: 'You don’t pay us, and you don’t have to ask the seller to. It’s settled before your offer is ever seen — built into the deal, not begged for at the table. The seller sees their real take-home with this already counted. You just bring the offer.',
    es: 'Tú no nos pagas, y no tienes que pedirle al vendedor que lo haga. Está resuelto antes de que se vea tu oferta — incluido en el trato, no mendigado en la mesa. El vendedor ve lo que realmente se lleva con esto ya contado. Tú solo traes la oferta.',
  },
  'q.repCost.fact': {
    en: 'Representation secured · costs you nothing',
    es: 'Representación asegurada · no te cuesta nada',
  },
  'q.repCost.factSource': {
    en: 'Settled before this offer · part of the deal, not an ask',
    es: 'Resuelto antes de esta oferta · parte del trato, no una petición',
  },
  'q.repCost.confirm': { en: 'Good — let’s keep going', es: 'Bien — sigamos' },
  'q.repCost.confirm.note': { en: 'Nothing for you to do here.', es: 'Nada que hacer aquí.' },

  // possession — plainest language; the buyer often knew their move-in day
  // before the search even started.
  'q.possession.question': {
    en: 'When do you want to move in?',
    es: '¿Cuándo quieres mudarte?',
  },
  'q.possession.help': {
    en: 'Most people already know this — the day you’ve been picturing. Tell us plainly. We’ll usually line it up with the day the place is officially yours, so you get the keys the moment it’s done.',
    es: 'La mayoría ya lo sabe — el día que has estado imaginando. Dínoslo con claridad. Normalmente lo alineamos con el día en que el lugar es oficialmente tuyo, para que recibas las llaves en cuanto se cierre.',
  },
  'possession.c.closing': { en: 'The day it’s officially mine', es: 'El día que sea oficialmente mía' },
  'possession.c.closing.note': { en: 'Clean and simple — keys at closing.', es: 'Limpio y simple — llaves al cierre.' },
  'possession.c.specific': { en: 'I have a specific day in mind', es: 'Tengo un día específico en mente' },
  'possession.c.specific.note': { en: 'Tell us — we’ll work it in.', es: 'Dínoslo — lo acomodamos.' },

  // items included / excluded — a fun, direct ask with a "how it lands" prompt
  'q.items.question': {
    en: 'Anything in the place you’d like to keep — or have them take with them?',
    es: '¿Algo en el lugar que te gustaría conservar — o que se lo lleven?',
  },
  'q.items.help': {
    en: 'Think appliances, that nice light fixture, the shed out back. A small, fair ask reads as easy to say yes to. Asking someone to haul off something big and built-in can feel like a burden — you’re about to be the owner here, so ask the way you’d want to be asked.',
    es: 'Piensa en electrodomésticos, esa bonita lámpara, el cobertizo de atrás. Una petición pequeña y justa es fácil de aceptar. Pedirle a alguien que se lleve algo grande e instalado puede sentirse como una carga — estás por ser el dueño aquí, así que pide como te gustaría que te pidieran.',
  },
  'items.c.asis': { en: 'I’m good with it as it is', es: 'Estoy bien con como está' },
  'items.c.asis.note': { en: 'The easiest offer to accept.', es: 'La oferta más fácil de aceptar.' },
  'items.c.keep': { en: 'There’s something I’d like to stay', es: 'Hay algo que me gustaría que se quede' },
  'items.c.keep.note': { en: 'We’ll note it — keep it reasonable.', es: 'Lo anotamos — manténlo razonable.' },

  // ── 3. THE NUMBER — what I'll pay FOR this property ──
  'money.section.title': { en: 'Your number', es: 'Tu número' },

  // cash-back toward closing — the BUYER's own request for help (a lever).
  'q.cashBack.question': {
    en: 'Want to ask the seller to chip in toward your closing costs?',
    es: '¿Quieres pedirle al vendedor que aporte a tus costos de cierre?',
  },
  'q.cashBack.help': {
    en: 'This is you asking for help, and that’s fair. But know it’s a lever: in a competitive spot, asking for money back can make your offer less attractive than one that doesn’t. Your call — we’ll show you the trade.',
    es: 'Esto es pedir ayuda, y es justo. Pero es una palanca: en una situación competida, pedir dinero de vuelta puede hacer tu oferta menos atractiva que una que no lo pide. Tú decides — te mostramos el intercambio.',
  },
  'term.closingcosts.word': { en: 'closing costs', es: 'costos de cierre' },
  'term.closingcosts.plain': {
    en: 'The one-time fees to finish the sale — things like the loan setup, title, and escrow. Separate from the price of the home itself.',
    es: 'Las tarifas únicas para cerrar la venta — cosas como el trámite del préstamo, el título y el depósito en garantía. Aparte del precio de la casa.',
  },
  'cashBack.c.none': { en: 'No — I’ll cover my own costs', es: 'No — yo cubro mis propios costos' },
  'cashBack.c.none.note': { en: 'The cleaner, stronger offer.', es: 'La oferta más limpia y fuerte.' },
  'cashBack.c.ask': { en: 'Yes — ask for help toward closing', es: 'Sí — pedir ayuda con el cierre' },
  'cashBack.c.ask.note': { en: 'We’ll show how it affects your standing.', es: 'Te mostramos cómo afecta tu posición.' },

  'q.offerPrice.question': {
    en: 'What will you pay for this property?',
    es: '¿Cuánto pagarás por esta propiedad?',
  },
  'q.offerPrice.help': {
    en: 'One number. This covers everything — no splitting little fees, no admin haggling. You handle the costs of the deal, and the seller sees exactly what they take home. Clean offer, no fine print.',
    es: 'Un solo número. Esto cubre todo — sin dividir tarifas pequeñas, sin regateo de trámites. Tú manejas los costos del trato, y el vendedor ve exactamente lo que se lleva. Oferta limpia, sin letra chica.',
  },
  'q.offerPrice.placeholder': { en: '$400,000', es: '$400,000' },

  // the seller-net preview (OfferHouse math) shown after the price is set.
  'offerPrice.net.fact': {
    en: 'The seller sees their real take-home — costs already handled.',
    es: 'El vendedor ve lo que realmente se lleva — costos ya cubiertos.',
  },
  'offerPrice.net.source': {
    en: 'One clean number · no allocation grid · no fine print',
    es: 'Un número limpio · sin tabla de costos · sin letra chica',
  },

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
