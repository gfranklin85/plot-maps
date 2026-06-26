// ── Ask Flow — the comprehension engine spec ──────────────────────────
//
// The document builder is NOT a form. It's a TurboTax-style engine that
// ASKS the buyer one question at a time, in bus-stop language, and makes it
// nearly impossible to NOT understand. The buyer AUTHORS their own offer;
// the agent is off the admin hook. Signing becomes the residue of real
// understanding, not ass-covering. See memory/project_comprehension_engine_offer.
//
// HARD RULES baked into the types:
//  1. One QUESTION per screen (AskStep), never a form.
//  2. NO JARGON WITHOUT A SPONSOR — every term a normal person wouldn't say
//     at a bus stop must carry a plain `Term` explanation (see `terms`).
//  3. Everything is an i18n KEY (TKey), not a hardcoded string, so the whole
//     flow works in any language as a data layer — never browser auto-translate.
//  4. OT is present on every step (handled by the engine, not the spec).

/** A translation key. Resolved against lib/forms/i18n. Authoring in code uses
    keys; the English (and Spanish, …) strings live in the locale tables. */
export type TKey = string;

/** A jargon term + its playground-level explanation. ANY word in a question
    that a bus-stop conversation wouldn't use MUST appear here. The engine
    underlines sponsored terms and reveals the plain explanation on tap. */
export interface Term {
  /** the word as it appears, e.g. "down payment" (matched in the question). */
  word: TKey;
  /** the playground explanation — how you'd say it to a friend. */
  plain: TKey;
  /** optional: a tiny real-numbers example ("On a $400k home, 20% down is $80k"). */
  example?: TKey;
}

/** How the buyer answers a question. */
export type AnswerKind =
  | 'money'        // a dollar amount
  | 'months'       // a duration in months/years
  | 'number'       // plain number
  | 'choice'       // pick one of `choices`
  | 'yesno'        // yes / no
  | 'text'         // free text (rare — prefer structured)
  | 'confirm'      // "I understand" acknowledgement (no value, just consent)
  | 'derived';     // shown, not entered — computed from earlier answers

export interface AskChoice {
  id: string;
  label: TKey;
  /** optional plain-language note under the choice. */
  note?: TKey;
}

/** ONE question. The atomic unit of the flow — one of these per screen. */
export interface AskStep {
  id: string;
  /** the question, asked like a person ("How much can you pay each month?"). */
  question: TKey;
  /** optional friendly sub-line / framing under the question. */
  help?: TKey;
  /** the jargon sponsors required to understand THIS question (rule #2). */
  terms?: Term[];
  kind: AnswerKind;
  placeholder?: TKey;
  choices?: AskChoice[];      // for kind:'choice'
  /** for kind:'derived' — the engine computes + shows this; not entered. */
  derive?: 'price' | 'loanAmount' | 'downPaymentPct' | 'monthlyTotal' | 'offerSummary';
  /** optional worked example shown with the question (real numbers). */
  example?: TKey;
  /** a SETTLED FACT reflected from upstream (the buyer's assembled crew) —
      shown as a confirmed line the captain confirms, not a question they
      answer. `factSource` credits where it came from (e.g. "your ready crew").
      Until the crew flow feeds it, this is a sensible placeholder. */
  fact?: TKey;
  factSource?: TKey;
  /** only ask this step when this predicate over prior answers is true. */
  showWhen?: (answers: Record<string, string>) => boolean;
}

/** A named group of questions (for the progress rail / chaptering). The buyer
    still sees ONE question at a time; sections are just the spine. */
export interface AskSection {
  id: string;
  title: TKey;
  /** optional framing shown once when entering the section's first step
      (e.g. the ownership-posture intro on the terms section). */
  intro?: TKey;
  steps: AskStep[];
}

/** The whole document as an ask-flow. */
export interface AskFlow {
  slug: string;
  /** masthead while asking. */
  eyebrow: TKey;
  title: TKey;
  /** the certificate earned on completion (the comprehension capstone). */
  certificate?: { title: TKey; statement: TKey };
  sections: AskSection[];
}
