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

  // agency disclosure — who represents whom. Reflected (system/agent has it),
  // comes first. Confirmed, not asked.
  'q.agency.question': {
    en: 'Here’s who’s representing everyone.',
    es: 'Esto es quién representa a cada parte.',
  },
  'q.agency.help': {
    en: 'Before anything else, it should be crystal clear who works for whom. You have your own agent on your side. The seller has theirs. No mixing it up, no hidden loyalties.',
    es: 'Antes que nada, debe quedar clarísimo quién trabaja para quién. Tú tienes tu propio agente de tu lado. El vendedor tiene el suyo. Sin confusiones, sin lealtades ocultas.',
  },
  'q.agency.fact': {
    en: 'You: Greg Franklin, Position Realty · Seller: their listing agent',
    es: 'Tú: Greg Franklin, Position Realty · Vendedor: su agente de venta',
  },
  'q.agency.factSource': {
    en: 'Already on file · your side is your side',
    es: 'Ya registrado · tu lado es tu lado',
  },
  'q.agency.confirm': { en: 'Clear — let’s build the offer', es: 'Claro — construyamos la oferta' },
  'q.agency.confirm.note': { en: 'Nothing to enter — just so you know.', es: 'Nada que ingresar — solo para que sepas.' },

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

  // buyer-conditional contingency — the human-life "open space." A real
  // milestone the deal honestly rides on, stated plainly + dated.
  'q.lifeContingency.question': {
    en: 'Is there something real in your life this deal is waiting on?',
    es: '¿Hay algo real en tu vida de lo que dependa este trato?',
  },
  'q.lifeContingency.help': {
    en: 'Most contracts only ask about the house. But real life has its own timing — a retirement finalizing, terminal leave approved, a kid’s college decision, a VA rating coming through. If there’s a true milestone you’re standing on, say it plainly and put a date on it. It’s not a way out — it’s you saying “the moment this lands, I’m all in.”',
    es: 'La mayoría de los contratos solo preguntan por la casa. Pero la vida real tiene su propio tiempo — una jubilación que se finaliza, un permiso aprobado, la decisión universitaria de un hijo, una calificación del VA. Si hay un hito real del que dependes, dilo con claridad y ponle fecha. No es una salida — es decir “en cuanto esto suceda, voy con todo”.',
  },
  'lifeContingency.c.none': { en: 'No — I’m clear to go', es: 'No — estoy listo para avanzar' },
  'lifeContingency.c.none.note': { en: 'Nothing holding you back.', es: 'Nada que te detenga.' },
  'lifeContingency.c.have': { en: 'Yes — there’s something I’m waiting on', es: 'Sí — hay algo que estoy esperando' },
  'lifeContingency.c.have.note': { en: 'Let’s state it plainly.', es: 'Vamos a decirlo con claridad.' },

  'q.lifeContingencyText.question': {
    en: 'In your own words — what are you waiting on, and by when?',
    es: 'En tus propias palabras — ¿qué estás esperando, y para cuándo?',
  },
  'q.lifeContingencyText.help': {
    en: 'Say it like you’d say it to a friend. “If my VA disability comes through by March 1, it’s on.” The clearer and more specific, the more the seller can trust it. OT can help you word it.',
    es: 'Dilo como se lo dirías a un amigo. “Si mi discapacidad del VA se aprueba para el 1 de marzo, va.” Entre más claro y específico, más puede confiar el vendedor. OT puede ayudarte a redactarlo.',
  },
  'q.lifeContingencyText.placeholder': {
    en: 'If Johnny gets into Cal Poly at his meeting on the 15th, we continue.',
    es: 'Si Johnny entra a Cal Poly en su reunión del día 15, continuamos.',
  },

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

  // loan type — SHARE. The listing agent needs the terms that come with it.
  'q.loanType.question': {
    en: 'How are you paying for it?',
    es: '¿Cómo lo vas a pagar?',
  },
  'q.loanType.help': {
    en: 'This is worth sharing — the seller’s side needs to know, because each path comes with its own rules and timeline. It’s not a weakness to show; it’s just how the deal works.',
    es: 'Vale la pena compartir esto — el lado del vendedor necesita saberlo, porque cada camino tiene sus propias reglas y tiempos. No es debilidad mostrarlo; es simplemente cómo funciona el trato.',
  },
  'loanType.c.cash': { en: 'All cash', es: 'Todo en efectivo' },
  'loanType.c.cash.note': { en: 'The simplest, fastest path.', es: 'El camino más simple y rápido.' },
  'loanType.c.conventional': { en: 'A regular loan (conventional)', es: 'Un préstamo regular (convencional)' },
  'loanType.c.conventional.note': { en: 'The most common way.', es: 'La forma más común.' },
  'loanType.c.fha': { en: 'An FHA loan', es: 'Un préstamo FHA' },
  'loanType.c.fha.note': { en: 'Lower down, a few extra rules.', es: 'Menos enganche, unas reglas extra.' },
  'loanType.c.va': { en: 'A VA loan', es: 'Un préstamo VA' },
  'loanType.c.va.note': { en: 'For those who served.', es: 'Para quienes sirvieron.' },

  // deposit — SHARE. Real skin-in-the-game signal, easily understood.
  'q.deposit.question': {
    en: 'How much will you put down as a good-faith deposit?',
    es: '¿Cuánto pondrás como depósito de buena fe?',
  },
  'q.deposit.help': {
    en: 'This is money you put up right away to show you’re serious — it goes toward the purchase, it’s not extra. A solid deposit tells the seller you mean business. Share it with confidence.',
    es: 'Es dinero que pones de inmediato para mostrar que vas en serio — cuenta para la compra, no es extra. Un buen depósito le dice al vendedor que hablas en serio. Compártelo con confianza.',
  },
  'term.deposit.word': { en: 'good-faith deposit', es: 'depósito de buena fe' },
  'term.deposit.plain': {
    en: 'A chunk of money you hand over early to prove you’re for real. It’s held safely and counts toward what you’re paying — you don’t lose it by going forward.',
    es: 'Una cantidad que entregas temprano para probar que vas en serio. Se guarda de forma segura y cuenta para lo que pagas — no la pierdes por seguir adelante.',
  },
  'q.deposit.placeholder': { en: '$8,000', es: '$8,000' },

  // close of escrow — SHARE. When the deal completes.
  'q.coe.question': {
    en: 'How soon do you want this to be done and yours?',
    es: '¿Qué tan pronto quieres que esté cerrado y sea tuyo?',
  },
  'q.coe.help': {
    en: 'This is the finish line — the day everything’s signed, paid, and the place is officially yours. A normal timeline is around a month; faster can make your offer stronger if your crew’s ready (and yours is).',
    es: 'Esta es la meta — el día en que todo está firmado, pagado y el lugar es oficialmente tuyo. Un tiempo normal es cerca de un mes; más rápido puede hacer tu oferta más fuerte si tu equipo está listo (y el tuyo lo está).',
  },
  'coe.c.fast': { en: 'Fast — about 2-3 weeks', es: 'Rápido — unas 2-3 semanas' },
  'coe.c.fast.note': { en: 'A strong signal — your crew’s ready.', es: 'Una señal fuerte — tu equipo está listo.' },
  'coe.c.normal': { en: 'Normal — about a month', es: 'Normal — cerca de un mes' },
  'coe.c.normal.note': { en: 'The usual, comfortable pace.', es: 'El ritmo usual y cómodo.' },

  // expiration — SHARE. How long the offer stands.
  'q.expiration.question': {
    en: 'How long should this offer stand before they have to answer?',
    es: '¿Cuánto tiempo debe durar esta oferta antes de que respondan?',
  },
  'q.expiration.help': {
    en: 'You’re giving the seller a window to say yes. Short and firm shows confidence and keeps things moving; too long lets them shop your offer around. A couple of days is plenty.',
    es: 'Le das al vendedor una ventana para decir sí. Corto y firme muestra confianza y mantiene el ritmo; demasiado largo les deja comparar tu oferta. Un par de días es suficiente.',
  },
  'expiration.c.short': { en: '2 days — let’s keep it moving', es: '2 días — mantengamos el ritmo' },
  'expiration.c.short.note': { en: 'Confident and clean.', es: 'Seguro y limpio.' },
  'expiration.c.standard': { en: '3 days — the standard', es: '3 días — el estándar' },
  'expiration.c.standard.note': { en: 'Reasonable breathing room.', es: 'Un margen razonable.' },

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
