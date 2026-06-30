# RPA Teardown — Plot's offer instrument

> Method (Greg, 2026-06-17): go deeper than a lawyer. A lawyer asks "what does
> this say / is it enforceable." We ask **three questions on every line**:
> 1. **What's our objective here?** (before reading the line)
> 2. **Why does this line exist, and should we even be saying it?** (does it
>    serve us, or serve them / give a card away?)
> 3. **Say it in playground language** — what happens, to whom, plainly.
>
> Every line is a CARD, not a fact. Their two voices are "ask a descriptive
> fact" or "lay out what happens if X," both in defensive legalese. We use
> NEITHER — straight playground talk. We are NOT reproducing CAR's copyrighted
> form; Greg (CA Broker) authors Plot's own instrument. This doc is the spec
> the TurboTax-style engine gets built from.
>
> See memory/project_rpa_negotiation_instrument.md.

---

## PAGE 1

### Date Prepared
- **States:** the date the offer was prepared.
- **Leverage:** minor — but a date *is* a clock. Mostly scaffolding here.
- **Plot:** auto-filled, but note it starts timelines; surface where it matters.

### 1A / 1B — Who is offering, on what property
- **States:** the Buyer(s) making the offer; the Property by street address + APN
  + city/county/zip.
- **Leverage:** descriptive. The APN is the precise legal identity of the lot
  (Plot already has this from the map/parcel system — auto-fill).
- **Plot:** pre-filled from the map selection. No typing. The thing they're
  offering on is the parcel they were already standing on / flying over.

### 1C / 1D — "terms follow" + "who the Parties are"
- **States:** 1C = acknowledgment that the terms are specified below/following;
  1D = defines "Buyer and Seller" as "the Parties."
- **Leverage:** ZERO. Pure scaffolding — legalese defining its own terms before
  using them. Plumbing, not a card.
- **Plot:** these vanish. "Terms follow" is just TRUE in a guided flow (the next
  screen IS the terms). "Who the Parties are" = the two names already on the
  offer, or a single click-acknowledge. We don't make people read a sentence
  telling them they're about to read sentences.

### 2 — AGENCY (first big translation win)
- **States:** discloses who represents whom — buyer's brokerage/agent, seller's
  brokerage/agent, and whether anyone is acting as a DUAL agent (both sides);
  plus acknowledgment that multiple buyers may be competing.
- **Why it's really here / leverage:** exists because of a real conflict-of-
  interest problem, but written to COVER THE BROKERAGES legally, not to make the
  buyer UNDERSTAND the dynamic. A buyer signs "dual agency" with no felt sense
  that the same brokerage now profits from both sides and its loyalty is split.
  That ignorance = the "unfounded preconceived inaccurate convention" (people
  assume their agent is purely theirs).
- **Plot (plain-language, plain-stakes):** make the dynamic FELT, not disclosed.
  e.g. "Heads up: Jenny works for the seller. If you also let her represent you,
  she's working both sides — she can't fully fight for just you. Here's what
  that means for you →". Transparency as a WEAPON: (a) honest for everyone,
  (b) quietly elevates the buyer's-agent-who-only-works-for-YOU as the better
  deal (serves Plot's agents).

### 3 — TERMS / MONEY (the buried treasure — the thesis in miniature)
- **States:** the financial shape — Purchase Price; Close-of-Escrow timing;
  Expiration of Offer; Initial Deposit (+ increased deposit); Loan Amount(s) with
  interest-rate ceiling + points + loan type (FHA/VA/conv); Additional financing;
  Occupancy type; **Balance of Down Payment / cash to close**; total. It details
  HOW WELL-CAPITALIZED the buyer is and EXACTLY what they're leveraging.
- **The dual nature (Greg's insight):** this section is BOTH (a) a CONDITION the
  buyer must meet to stay accountable (good — sets the bar) AND (b) **a MESSAGE to
  the listing agent about your financial strength.** Nobody building these
  realizes they're sending a message — they think they're stating a fact.
- **The legal reality (answers to Greg's questions):**
  - **No law forces a buyer to itemize reserves / true cash position / what
    they're leveraging.** What's actually required is narrow: the offer must
    state its MATERIAL TERMS (price, cash vs. financed, contingencies) so there's
    a definite, enforceable contract; and IF the offer is financing-contingent,
    the financing terms DEFINE that contingency (the bar that lets the buyer
    walk). CAR's form asks for MORE granularity than the law requires.
  - **It does NOT have to be this transparent.** The necessary/volunteered line
    runs right through item 3:
    - **NECESSARY (enforceable backbone):** the price; cash-vs-financed; and — if
      you want a financing contingency — enough loan-term definition to anchor
      it. Down-payment/cash-to-close matters because it's price − loan and must
      reconcile.
    - **VOLUNTEERED (a message you may not mean to send):** the interest-rate
      ceiling, points, precise reserve picture, "All Cash" flex, exact down-
      payment balance beyond what reconciles the math. Each is a CARD.
      "Not to exceed 6.300%" tells them how tight your qualification is. A big
      cash-to-close says "I'm strong, push me." A thin one says "I'm stretched,
      squeeze me on repairs."
  - **It IS relative to your objectives — that's the whole point.** Same true
    finances, presented differently by goal:
    - Want the seller to TRUST THE CLOSE (beat other offers) → show strength,
      signal certainty.
    - Want ROOM TO RENEGOTIATE after inspection / not invite a higher counter →
      disclose only what forms the contract + defines your contingency; don't
      hand over the full reserve picture.
- **Plot's version (what CAR structurally cannot do):** BEFORE filling item 3,
  ask **"what's your objective on this offer?"** Then:
  - (a) show which fields are REQUIRED to make the contract real + keep the
    contingency,
  - (b) flag which are OPTIONAL disclosures that send a message,
  - (c) tell you, in playground language, WHAT MESSAGE each one sends
    ("Filling in this rate cap tells their agent how tight your loan is. You
    don't have to. Want to?").
  The agent builds the SAME legal offer but CHOOSES which cards to show —
  instead of reflexively flipping them all face-up because CAR printed a blank.
  **That is the difference between a form and an instrument.** CAR defaults to
  maximum disclosure; Plot makes disclosure a deliberate, coached choice tied to
  your objective.

### Buyer's Initials / footer
- **States:** initials per page, brokerage footer, form revision.
- **Plot:** initials become the e-sign trail (captured once, applied where
  needed). Footer = Plot's own instrument identity, not CAR's.

---

## OPEN THREADS surfaced on page 1 (carry forward)
- **Objective-first framing:** the engine should capture the agent's OBJECTIVE
  for THIS offer up front, then coach every disclosure choice against it.
- **Agent protection** (commission secured before the offer leaves their hands)
  and **priced-offer gate** (% up front to view) — not on page 1's face, but
  they wrap the whole instrument. Design separately.
- **"Required vs. volunteered" engine:** a reusable distinction applied to every
  field across all pages — the core mechanic.
