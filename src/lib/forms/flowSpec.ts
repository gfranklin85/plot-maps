// ── Plot Form Flow — the spec ─────────────────────────────────────────
//
// A form is DATA. The engine (FormFlow.tsx) renders any PlotFlow spec into
// the proven negotiation-instrument UI: objective-first opener → sections
// of REQUIRED fields (the enforceable backbone) and VOLUNTEERED cards (the
// ones that send a message, with "what this tells them" coaching) → review
// → e-sign. One engine, all five forms. Greg (CA Broker) authors the
// content into these specs page-by-page; the engine never changes.
//
// Proven from the hand-built RpaFlow; this generalizes that pattern.
// See memory/project_rpa_negotiation_instrument + docs/rpa-teardown.md.

/** An objective the agent picks first; the whole flow coaches against it.
    `key` is matched by fields' `recommendWhen` / coaching maps. */
export interface FlowObjective {
  key: string;
  icon: string;
  title: string;
  body: string;
  accent: string; // hex
}

/** A REQUIRED field — the enforceable backbone. Plain input, no coaching;
    it's just what makes the instrument real. */
export interface RequiredField {
  id: string;
  label: string;
  placeholder?: string;
  /** input flavor — drives the control the engine renders. */
  type?: 'text' | 'money' | 'date' | 'number' | 'select';
  options?: string[]; // for type:'select'
  help?: string;      // optional one-liner under the label
}

/** A VOLUNTEERED card — not required by law; playing it sends a message.
    `tell` is the "what this tells them" coaching. `tellByObjective` lets
    the coaching change with the chosen objective (keyed by objective.key).
    `recommendWhen` lists objective keys for which this card is recommended
    (shown on by default). */
export interface VolunteeredCard {
  id: string;
  label: string;
  tell?: string;
  tellByObjective?: Record<string, string>;
  recommendWhen?: string[];
}

/** A page/section of the flow — a required group + a volunteered group.
    Either group may be empty. `intro` (optional) can vary by objective. */
export interface FlowSection {
  id: string;
  title: string;
  /** short framing under the title; may key off the objective. */
  intro?: string;
  introByObjective?: Record<string, string>;
  requiredHeading?: string;
  requiredNote?: string;
  required: RequiredField[];
  volunteeredHeading?: string;
  volunteeredNote?: string;
  volunteered: VolunteeredCard[];
}

/** The whole form as data. */
export interface PlotFlow {
  slug: string;
  /** eyebrow over the title, e.g. "Purchase Offer · the negotiation". */
  eyebrow: string;
  title: string;       // "Let's build your offer."
  tagline: string;     // "This isn't a form. Every line is a card..."
  /** the objective-first opener. If omitted, the flow skips straight to
      the sections (some short forms don't need an objective). */
  objectivePrompt?: { heading: string; body: string };
  objectives?: FlowObjective[];
  sections: FlowSection[];
  /** closing line on the review/sign step. */
  reviewNote?: string;
}
