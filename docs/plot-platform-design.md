# Plot — Platform Design

*A prospecting game on a real estate market substrate.*

---

## 0. The product thesis

Plot is not a real estate CRM with gamification features bolted on. **Plot is a prospecting game whose leaderboard happens to be the real estate market.** The flight controller, gamepad, reticle, and cinematic camera are not power-user UX — they are the input device for the game. The map is the playing field. Every player has a hit-rate stat. Top players become known. Heuristics get attributed to discoverers. Side bets and tournaments are load-bearing engagement mechanics, not afterthoughts.

The serious infrastructure underneath (real verified buyers, real owner-controlled signal, real lender integrations, real agent CRM) is what makes the game *matter*. The game layer is what makes any of it actually grow.

A normal real estate platform competing against Zillow/Redfin/Compass/Opendoor is a hard fight. A weird, genuinely fun prospecting game that the incumbents cannot become without alienating their userbase is an asymmetric position. The cultural layer — community, leaderboards, hot streaks, named patterns, side bets, rivalries — is the moat. Software is cloneable in six months; community is not.

This document covers (1) the game framing, (2) the communication-layer thesis, (3) the technical substrate, (4) the regulatory structure, and (5) the build sequence.

---

## 0.5. The communication-layer thesis

Plot's deepest strategic bet — bigger than the game framing, bigger than any single feature — is that **the address is the permanent identifier of a property, the connection is a tradeable platform asset, and Plot's masking is the moat**.

Today's real estate prospecting industry is built on the phone number as the unit of contact. That model has structural problems: phone numbers churn, skip-trace data ages, every contact is per-call cost, and once a user has a number it leaves the platform forever. Every existing tool (Mojo, Batch, PropWire, Lead Sherpa) competes on the same data, sells it the same way, and burns the same renewal costs.

Plot inverts this:

1. **The address is the durable identifier.** Owners change, phone numbers change, but a property at 123 Main St stays at 123 Main St. Plot anchors connections to the address, not the phone number.
2. **A "connection" is the platform asset.** Once Plot establishes routing to a property's owner — via skip-trace + outreach + the owner getting onto Plot — that connection persists. Future users reach the owner *through Plot*, not through a phone number that left the building.
3. **Masking is what makes connections defensible.** Universal masking (no raw owner phone/name in the UI, ever) means users can't extract the data and route around Plot. The connection only works while the user is on Plot. That is the moat.
4. **Connection-rate accuracy compounds over time.** Every owner who self-scores effectively verifies the connection. Owners who post destination intent log in regularly. Owners who use the inbox stay active. Plot's data gets *more accurate* with usage, while every competitor's data gets less accurate as it ages.
5. **Internal messaging eventually replaces cold outreach.** Once enough owners are on Plot, the marginal value of skip-trace + carrier SMS drops to zero. Why pay $0.10 to skip-trace and $0.01 to SMS when you can DM the owner directly through Plot, with a higher response rate? The economics flip — the *outside* path becomes the expensive low-yield option, the *inside* path becomes the default.
6. **The phone number stops mattering.** A buyer doesn't need a number; they tap the house on the map, Plot routes the message, the receiver decides whether to engage. The communication is property-anchored, not person-anchored.

This produces an unusual financial shape: **software economics on top of a hardware-economics market.** Plot's marginal cost-to-serve approaches zero on properties that already have a Plot connection. Competitors stuck in the per-call cost-of-goods model can't catch up by buying more skip-trace data, because the value isn't in data anymore — it's in the aggregated routing graph.

The 5-10 year arc:

- **Phase 1-2: Better outreach.** Plot is a better way to send outreach via existing channels (SMS, mail, dial), with masking and templates. Most users still think they're using "a real estate tool."
- **Phase 3-4: Owner-side critical mass.** Enough owners self-score that the public layer has real density. Plot internal messaging becomes a viable channel — sometimes faster and better than SMS. Skip-trace becomes a one-time cost per property, not per inquiry.
- **Phase 5+: Phone numbers stop mattering for real estate.** A meaningful fraction of US residential properties have a Plot connection. New buyers/agents go to Plot first, not skip-trace tools. Phone-number-based platforms become legacy. Plot is the routing layer.

Every Phase 1 feature in this document is step one of that arc. The build doesn't change; the *why* underneath it is bigger than "ship a prospecting tool."

---

## 1. The four-sided market

| Actor | Wins by | Pays for | Verification |
|---|---|---|---|
| **Owner** | Controlling signal, escaping cold-call hell, market visibility without listing commitment | Free (consumer side) | Optional self-claim via address mailer or skip-trace match |
| **Agent** | Paid prospecting tool that compounds with use; new referral stream from buyers needing representation | SaaS subscription + per-outreach fees | DRE license # on file |
| **Buyer (unverified)** | Inquiry capability, contributes to public layer, first-look on what they surface, engagement credits | Per-inquiry fees, optional subscription | Identity only |
| **Buyer (verified preapproved)** | Exclusive private responses, premium status, off-market access | Per-inquiry fees (lower than unverified), verification fee | NMLS-validated lender preapproval |
| **Lender** | Branded credibility in every preapproved buyer's outreach; warm channel for borrower re-engagement | Sponsored placement + integration fees | NMLS license # |

### The four-sided flywheel

```
                 ┌─────────────────────────────────────┐
                 │                                     │
                 ▼                                     │
   Agents pay for prospecting tool                     │
            │                                          │
            ▼                                          │
   Agent outreach seeds private markers                │
            │                                          │
            ▼                                          │
   Some owners self-score publicly                     │
            │                                          │
            ▼                                          │
   Public layer becomes valuable                       │
            │                                          │
            ▼                                          │
   Buyers (verified + unverified) see real signal      │
            │                                          │
            ├─→ Unverified buyer inquiries seed more   │
            │   public-layer scores ───────────────────┤
            │                                          │
            ├─→ Verified buyers convert; lenders gain  │
            │   visibility ────────────────────────────┤
            │                                          │
            └─→ Agents see real public signal in their │
                farms, value of agent product rises ───┘
```

Each side's spend creates value for at least one of the other sides. The system is positive-sum across all actors and the platform monetizes the infrastructure underneath each interaction.

---

## 2. The two-layer marker system

### Layer A: Agent-private (per-account CRM)
Every agent maintains their own readiness markers on properties in their farm. Visible only to that agent when logged in. Their CRM made spatial. Free-text notes attached. Persists across sessions, survives owner self-scoring (independent record).

### Layer B: Owner-public (platform-wide)
When an owner self-scores their property, that record is the authoritative public signal. One row per property. Owner controls visibility level: private-to-the-agent-who-reached-out / shared-with-verified-buyers / fully-public.

### Render rules per role

- **Agent logged in:** their private markers UNION public markers (visually distinguished by shape/stroke).
- **Owner logged in:** public markers (everyone's) + their own private record(s).
- **Verified buyer logged in:** public markers + private-to-them markers from their own inquiries.
- **Unverified buyer logged in:** public markers only + their own inquiry status indicators.

### Visual language (proposed)

- **Color**: readiness score (1–5, plus gray "no data").
- **Shape/stroke**: layer source — solid filled = public/owner-set, ringed/dashed = private/agent-set, MLS-pin shape = active listing.
- **Badge overlay**: verification level on public markers (owner-claimed-and-verified vs. owner-claimed-unverified vs. owner-unspecified).

### Conflict resolution

When an agent has a private score *and* the owner self-scores publicly, both persist. Agent UI shows both: *"Your read: 3. Owner self-scored: 4."* That delta is itself useful information.

---

## 3. The three outreach channels

### Channel 1 — Agent SMS prospecting (private result)

Agent uses the existing skip-trace + dialer infrastructure to send an SMS via their own provisioned Twilio number. Owner replies (text or web form) → score writes to **agent-private layer only**. Agent paid for the outreach, owns the resulting lead.

### Channel 2 — Verified preapproved buyer inquiry (private result)

Buyer with NMLS-validated preapproval sends an inquiry. Message body cites the verifying lender + NMLS#. Response → private to buyer + their agent (if looped in). Verification = proof of capital = exclusivity, mirroring the agent rule.

### Channel 3 — Unverified buyer inquiry (public result)

Buyer pays per-inquiry without verification. Owner response → **public layer**. The buyer who triggered it gets a first-look window (24–48h) before the score becomes broadly visible. Engagement credits accrue toward future inquiries based on activity.

### Channel 4 — Platform consumer ads (public result)

Plot runs ads ("see what your home looks like to today's buyers"). Owner self-scores via the consumer landing page directly, without any specific actor having reached out. Score is public from the start.

### Message templates by channel

**Agent prospecting:**
> *"Hi [first name], [Agent] with [Brokerage] here. [Real comp / context]. Quick question — on 1–5, how interested are you in selling in the next few years? Reply a number, or tap [link] for the full picture. Reply STOP to opt out."*

**Verified buyer inquiry:**
> *"Hi — I'm a verified preapproved buyer through [Lender, NMLS #XXXXX], approved up to [bracket], looking specifically in [neighborhood]. I came across your property at [address] on Plot. If the right offer came along, would you consider it? Verify my preapproval and respond at [link]. — [First name only], via Plot. Reply STOP to opt out."*

**Unverified buyer inquiry:**
> *"Hi — a buyer on Plot is looking in your area. They're curious whether you'd consider selling if the right offer came. Tap [link] to share your readiness anonymously and see who's watching your neighborhood. Reply STOP to opt out."*

(Note: unverified messages identify the platform as the sender, not the buyer, since the buyer hasn't earned the credibility frame.)

**Consumer ad landing:**
> *"What's your home worth to today's buyers — without listing? See real buyer interest in your area. Set your readiness, choose who sees it, get found by buyers serious about your specific home."*

The framing of each channel matches the data destination. No fine print; the headline is honest about what's happening.

---

## 4. The game layer

### Core loop

1. **Survey:** Player flies the map looking for targets. Reticle hovers a property, popup surfaces info (build year, last sale, comps, ownership tenure, etc).
2. **Predict:** Player decides whether to inquire. Inquiry costs credits. Higher-confidence guesses on cold/unsurveyed properties have biggest upside.
3. **Resolve:** Owner does or doesn't respond. Response is scored 1–5.
4. **Score:** Player's hit rate updates. Streaks tracked. Pattern matches detected.
5. **Reward:** Engagement credits accrue. Loyalty pricing improves. Status badges level up.
6. **Repeat:** Player keeps prospecting, building accuracy reputation.

### Stats tracked per player

- **Hit rate**: % of inquiries that surface ≥4 readiness scores.
- **Volume**: total inquiries sent.
- **Streak**: consecutive ≥4 hits.
- **Coverage**: % of properties in player's chosen farm/region inquired.
- **Accuracy by segment**: hit rate broken down by neighborhood, property type, build era, etc.
- **Discovery score**: bonus for surfacing scores in low-coverage areas (rewards exploration over exploitation).

### Pattern discovery

Players can annotate their own theories ("1970s tract homes near major freeways with original owners over 70"). Tag a candidate set. Platform tracks the set's hit rate over time. High-performing theories get attributed to the discoverer, named (e.g., "Franklin's Heuristic"), and visible to other players. Power users build reputations as pattern hunters.

ML-discovered patterns also surface — the platform itself runs regression on the surfaced data and can highlight emergent clusters ("properties matching X criteria are scoring 3.2x average — first noticed by [discoverer]").

### Social affordances

- **Friend lists, shared maps.** "Look at this neighborhood I farmed last quarter."
- **Comment threads on properties** (between players, never visible to owners).
- **Comparison views.** "You and Jake have both farmed this neighborhood — here's how your reads compare."
- **Tournaments and seasons.** Periodic challenges with prize pools (platform credits, status, exclusive features). Resets engagement, generates content, drives press.
- **Leaderboards.** Regional, national, segment-specific.

### Status system

Players progress through tiers based on activity + accuracy:

- **Spotter** (default) — base capabilities.
- **Scout** — proven accuracy unlocks higher inquiry rate limits, premium analytics.
- **Verified Preapproved Buyer** — earned through real-world preapproval, unlocks exclusive responses + special badge in messages.
- **Pattern Hunter** — earned by discovering 3+ named heuristics.
- **Top X% in [Region]** — leaderboard-driven, refreshed seasonally.

Status is visible socially. Verification is a status flex, not just a regulatory tier.

---

## 4.5. Communication, abuse prevention, and the Plot recorded intro

Plot is a real platform with real owners on the other end. Outreach is *empowered* — users get creative latitude on letters, on calls, on internal messages — and *accountable*. The abuse-prevention model is five layers, none of which is a sending budget or a daily cap.

### 1. Plot controls the affordances structurally
Users pick from what Plot built. There is no raw freeform power "underneath" the UI to escape into. The Plot system text invitation, for example, is fixed-template by design — users don't compose it because they don't need to. Direct mail uses user-authored templates but those go through the template authoring page, not freeform per-property edits.

### 2. AI moderation on every outbound message and letter
Before any user-authored communication leaves Plot, an LLM screens it for harassment, threats, deception, fair-housing violations, and obvious bad-faith intent. Failed messages bounce back to the user with a friendly "rephrase this" prompt. Repeated failures escalate: warning → temporary suspension → ban. The user never gets a free pass on bad-intent content because they paid for the message slot.

### 3. Pre-use acknowledgment flow on first sign-in
Before a user can send anything from Plot, they pass through a non-skippable acknowledgment:
- Standard ToS (legal paperwork).
- Plot Maps etiquette guide — what's acceptable outreach, what isn't, what consequences look like.
- Clear, non-threatening notice that all activity is logged and the user is identified to Plot.

The framing matters: it's not surveillance theater, it's "this is a real platform with real owners; you're a known actor here." Most people self-regulate when they know they're identified. The acknowledgment makes that knowledge explicit instead of implicit.

### 4. Owner-side ergonomic controls
- One-tap **decline templates** ("Not selling at this time," "Not selling unless [condition]," "Take me off this list"). Owner doesn't compose anything emotional.
- **Block-this-user** button — owner one-taps; the user can never contact that property again. Plot logs it for moderation.
- **No-further-inquiries** preference — already in `owner_preferences` schema, gates Plot text invitations from any sender.
- Per-(buyer, property) inquiry limits — one initial inquiry; on decline, 30-day mute on that property; on explicit owner stop, permanent mute. Prevents the casual-buyer-can't-take-no failure mode without restricting professional users on other properties.

### 5. The Plot recorded intro on cold calls
Phone calls placed through Plot do not bridge directly. When the call lands, Plot plays a short pre-recorded intro to the owner: *"Hi — this is Plot Maps. A buyer interested in your property is calling. Press 1 to take the call now, press 2 to schedule a callback, or press 3 to decline."*

Three outcomes, all consensual:
- **Live answer (press 1):** Plot bridges the parties.
- **Schedule callback (press 2):** Owner gets a Plot SMS or in-app prompt to pick a callback time. Plot routes the call back at that time. This converts cold calls into warm scheduled calls — a feature no agent currently has access to.
- **Decline (press 3):** Polite end. Plot says "Thanks, we'll let them know." Caller's inbox shows the inquiry was attempted and declined. No awkward hangup, no escalation.

The owner is never ambushed by a stranger; the caller pays no cost when respectful and is filtered out when impatient. Cold-call UX inversion: the *intrusion* pays the friction, not the *conversation*.

### What is NOT in the abuse-prevention model
Explicitly out: sending budgets, daily caps, tier-aware allotments, trust ladders. A user pays, a user acts; if they cross the line, layers 1-4 handle it. Their spend ceiling is what they want to pay. Plot does not handcuff paying customers based on "user maturity" — that cuts against the a la carte unit economics and treats customers as problems to be managed instead of users to be served.

### Casual-buyer vs. professional asymmetry
Investors and seasoned agents have built-in emotional regulation around rejection — they take a "no," they move on. Casual home-shopping buyers don't always have that, and Plot's persistent inbox is more visible than the phone-call ephemera the cold-call industry has historically lived in. The rate-limit-per-(buyer, property) controls in layer 4 are specifically designed for this asymmetry: one inquiry, then a mute on decline. The casual-buyer's worst impulses are technically prevented from compounding without restricting professional users from operating across many properties.

---

## 5. Regulatory structure (DRE / RESPA / TCPA / A2P)

### DRE §10137 — California real estate compensation

Cannot pay unlicensed persons for performing acts requiring a license (soliciting sellers, finding/referring buyers for compensation, etc.). **Implication for Plot:** unverified-buyer engagement rewards CANNOT be structured as "earn money when you surface leads someone else buys." That's a referral payment to unlicensed users.

### RESPA §8 — Federal settlement services kickbacks

In any federally-related mortgage transaction, no fee or thing of value can be exchanged for the referral of settlement service business. Severe penalties (criminal). Same toxic shape as DRE.

### What IS allowed

1. **Information products with engagement-based pricing.** Unverified buyers buy *market intelligence for their own home search*, with loyalty credits for active use. Not a lead bounty — a frequent-flyer program for using a SaaS.
2. **Consumer rebates at closing.** RESPA explicitly permits rebates to the consumer in their own transaction. If a Plot user buys a home they found on Plot, closing rebate is fine.
3. **Licensee-to-licensee referral fees.** Properly disclosed, between licensed parties, fully legal.

### Plot's compliant reward structure

| Mechanism | Legal shape | Triggered by |
|---|---|---|
| Engagement credits | SaaS loyalty pricing | Account activity, retention, consumer referrals |
| First-look window | Information product feature | Sending an inquiry that produces a public score |
| Closing rebate | RESPA-compliant consumer rebate | Buyer transacts on a property |
| Verification cost savings | Tier upgrade pricing | Becoming a verified preapproved buyer |
| Tournament prizes | Promotional — credits, status, swag | Game performance |

**No mechanism pays a user for surfacing a lead that another user transacts on.** The behavioral dynamic (engaged users prospecting actively) is preserved through engagement credits + first-look + closing rebates. The legal shape is "consumer with loyalty pricing benefits."

### Marketing copy constraint

- ❌ "Earn rebates when properties you surface become hot leads."
- ❌ "Make money discovering off-market homes."
- ✅ "Active prospectors get loyalty pricing on future inquiries."
- ✅ "Earn engagement credits while you hunt for your next home."
- ✅ "Find your home on Plot, get a closing rebate."

The copy must reflect the legal shape, not the behavioral analogy. Internally we can think of it as a kickback economy; externally it must read as engagement loyalty.

### TCPA / A2P 10DLC

- All outbound SMS regulated. STOP keyword honored permanently. Sending hours respected. One inquiry per buyer per property, ever (rate limit + spam control).
- A2P 10DLC registration required before scaling. Greg to confirm Twilio account registration status.
- Per-channel templates submitted with registration so carriers see legitimate business purpose.
- Verified-preapproval messaging will likely get cleaner carrier acceptance than unverified-buyer messaging — frame the verification as a business legitimacy signal during registration.

### The lead marketplace (deferred)

A "marketplace where high-readiness public scores are tradeable" is the most legally exposed feature and is **deferred to Phase 4+**. Building it requires:
- Real estate attorney consultation in California.
- Plot operating as or in partnership with a licensed brokerage.
- Clear separation between "public information layer" (anyone can see) and "lead transaction" (licensee-to-licensee with proper disclosures).

For Phase 1–3, the public layer is just **public information**. Anyone can see it. Nobody sells access to specific leads. Plot monetizes the *infrastructure* (inquiry sending, verification services, premium subscriptions, agent prospecting tools), not the leads themselves.

### Pre-launch legal must-haves

1. Real estate attorney consult in CA — brokerage operations + tech platform structuring.
2. E&O and tech-platform liability insurance.
3. ToS that disclaims Plot from being party to buyer/seller representation. Plot is an information service + communication infrastructure.
4. Privacy policy covering buyer intent data, owner readiness data, and the public-layer data.
5. Fair Housing acknowledgment in agent + buyer ToS — filters can be neighborhood/price/property only, never demographic.

---

## 6. Data model

### Core tables

```
properties
  id                    pk
  address               text
  city, state, zip      text
  lat, lng              numeric
  parcel_id             text (assessor data)
  build_year, sqft, ... text/numeric
  ... (existing schema)

property_readiness_public   -- ONE row per property max
  property_id            fk → properties
  owner_user_id          fk → users (nullable until claimed)
  score                  int (1–5)
  comments               text
  set_at                 timestamp
  visibility             enum('private_to_initiator', 'verified_buyers_only', 'public')
  source                 enum('agent_inquiry', 'verified_buyer_inquiry', 'unverified_buyer_inquiry', 'owner_direct', 'consumer_ad')
  triggered_by_inquiry_id fk → property_inquiries (nullable, the inquiry that prompted this)
  verification_level     enum('unverified', 'skip_trace_match', 'address_mailer_verified')
  promoted_to_public_at  timestamp (nullable, for owner-flipped private→public)

property_readiness_agent    -- one row per (property, agent) pair
  property_id            fk → properties
  agent_user_id          fk → users
  score                  int (1–5)
  notes                  text
  last_contact_at        timestamp
  contact_count          int

property_inquiries          -- audit log of every outreach
  id                     pk
  property_id            fk → properties
  initiator_user_id      fk → users
  initiator_role         enum('agent', 'verified_buyer', 'unverified_buyer', 'platform_ad')
  buyer_verification_id  fk → buyer_verifications (nullable)
  represented_by_agent_id fk → users (nullable, buyer's agent if looped in)
  message_template_id    fk → message_templates
  sent_at                timestamp
  reply_received_at      timestamp (nullable)
  outcome                enum('no_reply', 'rated_private', 'rated_public', 'conversation_open', 'unsubscribed')
  exclusivity            enum('exclusive_to_initiator', 'public_with_first_look', 'public')
  first_look_expires_at  timestamp (nullable)

buyer_verifications
  id                     pk
  buyer_user_id          fk → users
  preapproval_amount     int
  preapproval_bracket    text (e.g. "$700k-$750k", what owner sees)
  lender_name            text
  lender_nmls_id         text
  loan_officer_nmls_id   text
  verified_at            timestamp
  expires_at             timestamp
  verification_status    enum('pending', 'verified', 'expired', 'denied')
  verification_method    enum('nmls_lookup', 'lender_api', 'manual_review')

player_stats               -- the game layer
  user_id                pk
  inquiries_total        int
  inquiries_high_hit     int  -- ≥4 score replies
  hit_rate               numeric (computed)
  current_streak         int
  best_streak            int
  coverage_by_region     jsonb
  discovery_score        int
  status_tier            enum('spotter', 'scout', 'pattern_hunter', 'verified_buyer', ...)
  badges                 jsonb

engagement_credits         -- the loyalty ledger
  id                     pk
  user_id                fk → users
  delta                  int (positive = earned, negative = spent)
  reason                 text (audit)
  inquiry_id             fk → property_inquiries (nullable)
  created_at             timestamp

named_heuristics           -- discovered patterns
  id                     pk
  discoverer_user_id     fk → users
  name                   text
  criteria              jsonb (filter spec)
  hit_rate               numeric (computed periodically)
  discovered_at          timestamp
  ml_or_human            enum('human', 'ml')

messages                   -- SMS conversation log
  id                     pk
  inquiry_id             fk → property_inquiries
  direction              enum('outbound', 'inbound')
  twilio_sid             text
  from_number, to_number text
  body                   text
  status                 text (queued/sent/delivered/failed)
  received_at            timestamp
```

### Key indices

- `property_readiness_public(property_id)` unique
- `property_readiness_agent(agent_user_id, property_id)` unique
- `property_inquiries(initiator_user_id, sent_at desc)` — player's history
- `property_inquiries(property_id, sent_at desc)` — property's inquiry history
- `buyer_verifications(buyer_user_id, expires_at desc)` — current verification lookup
- `engagement_credits(user_id, created_at desc)` — credit balance computation

### Render-time SQL pattern

Map view for an agent in their farm region:

```sql
-- agent's private layer
SELECT p.*, pra.score, 'private' as layer
FROM properties p
JOIN property_readiness_agent pra ON pra.property_id = p.id
WHERE pra.agent_user_id = :me AND p.lat BETWEEN ... AND p.lng BETWEEN ...

UNION ALL

-- public layer visible to this agent
SELECT p.*, prp.score, 'public' as layer
FROM properties p
JOIN property_readiness_public prp ON prp.property_id = p.id
WHERE prp.visibility IN ('public', 'verified_buyers_only')   -- agents see verified-buyer-tier
  AND p.lat BETWEEN ... AND p.lng BETWEEN ...
```

For a buyer (verified or unverified), the agent-layer query is omitted and the visibility filter is tightened.

---

## 7. Build sequence

### Phase 1 — Agent SMS prospecting + private layer (weeks)

**Goal:** Ship a paid agent prospecting product immediately. No public layer, no buyer-side, no marketplace. Agents pay, get a much better dialer + skip-trace + SMS combo than anything else on the market.

- A2P 10DLC registration (parallel paperwork track, ~3-10 days).
- `messages` table + Twilio SMS send wrapper.
- `/api/sms/send` endpoint — agent sends from their provisioned number.
- `/api/sms/inbound` webhook — Twilio posts incoming, parser writes to `messages`.
- `property_readiness_agent` table + write path on inbound text reply (regex `\b[1-5]\b`).
- Property popup: "Send rating request" button next to existing dial button.
- Map renders agent's private markers (color = score).
- Reply-via-link short-URL service + minimal web form fallback for richer responses.
- `/api/skip-trace/lookup` instrumented with timing (`console.time`) so we can measure for the phone-icon-as-dial UX later.
- One-tap-to-dial: phone icon click fires skip-trace + dialer init in parallel.

**What this proves:** Reply rates, carrier filtering behavior, agent willingness to pay for the upgraded experience, Twilio cost economics.

### Phase 2 — Game layer + agent-side intelligence (weeks)

**Goal:** Make the agent prospecting product a *game* with stats, streaks, and patterns. Layer in real comps so messages actually lead with substance.

- `player_stats` table + computation jobs.
- Hit rate / streak / coverage UI in the agent dashboard.
- Map UI: heatmap of agent's own coverage, gaps, streaks.
- Comps source plugged in (start with ATTOM or whichever MLS aggregator Greg can access). Message templates pull real recent nearby sale.
- `named_heuristics` table + UI for agents to define + track their own theories.
- Bulk send with throttling, rate-limiting, A2P-compliant per-property cap.
- Auto-categorize inbound replies; surface "needs human" to agent inbox.
- Engagement credits ledger (`engagement_credits`) — even though only agents are using the system, instrument the credit system so it's ready for buyer-side later.

**What this proves:** Whether the game framing actually grips agents, whether real comps materially change reply rates, whether agents start treating accuracy as identity.

### Phase 3 — Owner self-service + public layer (months)

**Goal:** Open the public layer. Owners can claim their property and self-score. Public markers start populating the shared map.

- Owner-facing `/claim/[property]` route.
- Verification flow: skip-trace match (fast, weak) and address-mailer code (slow, strong). Show verification badge on the public marker.
- Owner dashboard: readiness slider, visibility selector (private-to-initiator / verified-buyers-only / public), conversation inbox.
- `property_readiness_public` writes from owner self-score.
- Map UI: render public layer with distinct visual language.
- Notification system: agent gets pinged when an owner in their farm self-scores.
- Consumer-side landing page + ad campaign launch.

**What this proves:** Whether owners adopt self-service when prompted, what % choose public visibility, whether the public layer becomes useful enough that buyers want in.

### Phase 4 — Buyer side + verification + lender integration (months)

**Goal:** Open the platform to buyers. Verified preapproval becomes a real status. Lender integrations roll in.

- Buyer onboarding flow.
- NMLS lookup integration for lender + loan officer validation.
- Lender preapproval verification: API integration with major lenders, manual review backstop.
- `buyer_verifications` table + verification workflow.
- Buyer inquiry endpoint (verified path: private exclusive, unverified path: public-with-first-look).
- Buyer-side map (read-only public layer + their own inquiries).
- "Loop in agent" workflow — buyer can attach their own agent, or request a Plot-network agent (with referral fee mechanics on closed deals).
- Lender sponsored-placement system + ad unit.
- Buyer pricing tiers: subscription, per-inquiry, verification fee.

**What this proves:** Whether verified buyers convert at meaningful rates, whether their messages outperform agent messages, whether lenders pay for placement.

### Phase 5 — Tournaments, social, marketplace (months+)

**Goal:** Cultural layer. Tournaments, social features, and (with attorney blessing) the lead marketplace.

- Tournament infrastructure with prize pools.
- Friend lists, shared maps, comment threads.
- Pattern leaderboards, named-heuristic discovery flows.
- Lead marketplace pilot — *only after* attorney consult and probably brokerage license partnership in place. Plot-as-seller, licensee-as-buyer model.
- Buyer-of-record kickback at closing (RESPA-compliant rebate).

**What this proves:** Whether the cultural layer actually happens, whether it drives retention beyond what the game stats alone produce.

---

## 8. Open questions to resolve before Phase 1

These are the decisions that should be locked before any code in Phase 1, in order of priority:

1. **A2P 10DLC registration status.** Greg to check Twilio console → Messaging → Regulatory Compliance. If unregistered, kick off registration immediately — it's the long pole on Phase 1 timeline.

2. **Comps data source for Phase 2.** ATTOM, MLS via aggregator (Trestle/Bridge/SimplyRETS), Estated, or wait for direct MLS membership? The decision affects message template quality, which affects reply rates, which affects whether agents stay paying customers.

3. **Per-agent number vs. shared platform number for SMS.** Already trending per-agent (existing infrastructure). Confirm.

4. **Real estate attorney engaged.** Before Phase 3, definitely. Ideal: engaged before Phase 2 so Phase 3 design can be reviewed before build.

5. **Brokerage licensing posture for the lead marketplace.** Phase 4+ but the answer ("become a brokerage" vs. "partner with one" vs. "skip the marketplace forever") shapes the long-term business model.

6. **Verification cost economics.** What does NMLS-validated preapproval verification cost the platform? What does it cost the buyer? Margin? Greg to investigate FinLocker, Plunk, lender API pricing.

7. **Default visibility for owner self-score.** Recommendation: shared-with-verified-buyers as default (goldilocks — useful for the marketplace without being a billboard). Confirm.

---

## 9. The strategic argument, restated

A normal real estate platform with normal UX competing against the incumbents is a hard fight. The fight Plot can win is being the platform that's *more fun to use* than anyone else, *more honest with owners* than anyone else, and *more economically aligned across all four sides of the market* than anyone else.

The flight controller, the cinematic camera, the reticle, the gamepad — these aren't quirky. They're the product. The seriousness underneath (verified preapproved buyers, owner control, lender integrations, real comps) is what makes the game worth playing.

Don't let conventional advice sand down the strange parts. The strangeness is the strategy.

---

*Document v1 — captured from design conversation between Greg and Claude. Pressure-test, mark up, refine. Build follows.*
