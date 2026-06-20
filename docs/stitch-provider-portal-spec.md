# Stitch spec — Plot Provider Portal (lender / insurer)

> Paste the **PROMPT** block below into Stitch. The sections after it are
> reference for you (Greg) + me when wiring the output back in. The whole
> point of this screen: it's the OTHER half of the offer marketplace. The
> buyer's Cost Cockpit shows numbers tagged *Estimate* until a licensed
> provider logs in HERE, claims the application, works the file, and types
> real numbers back — which flips the buyer's line to *Live quote*.

---

## PROMPT (paste into Stitch)

Design a clean, trustworthy **web dashboard for a mortgage lender (and a
near-identical variant for a home insurer)** called the **Plot Provider
Portal**. This is where a licensed loan officer logs in, sees a queue of
incoming buyer loan applications, claims one, works it, and submits a real
rate quote back to the buyer.

**Brand / theme — match exactly:**
- Light, white, professional. Background `#ffffff` with very soft blue-tinted
  panels.
- Primary brand blue `#1349d4`; darker blue for gradients/hovers `#122d8d`;
  soft blue tint for pills/fills `#e0e7fb`.
- Headline ink `#0c1322`; body text `#4a5568`; muted text `#8a93a4`.
- Cards: white `rgba(255,255,255,0.78)`, 1px border `rgba(19,73,212,0.10)`,
  soft shadow `0 12px 30px -22px rgba(20,50,120,0.4)`, radius 18px.
- Status colors: green `#1b9e6a` (quoted / done), amber `#b8860b` (waiting),
  blue `#1349d4` (in progress / yours).
- Font: Inter / Geist sans. Headlines extra-bold and tight.
- Buttons: pill-shaped; primary = blue gradient `#1349d4 → #122d8d`, white
  text. NO cyan, NO dark/neon theme.

**Layout — three screens:**

1. **Application Queue (home).** Left sidebar nav (Queue, My Files, Quotes
   Sent, Rate Sheet, Settings) with a small "PlotMaps · Provider" logo lockup
   at top. Main area: a page title "Incoming applications", a row of summary
   stat tiles (New today / In progress / Quoted / Avg response time), then a
   **table or card list of buyer applications**. Each row shows: buyer first
   name + last initial, property address, loan type (Conventional/FHA/VA),
   purchase price, down payment %, credit band, a **status pill**
   (New / Claimed / Quoted), time since submitted, and a primary **"Claim"**
   button (or "Open" if already claimed). New/unclaimed rows subtly
   highlighted.

2. **File Detail (claimed application).** Two-column. Left: read-only buyer +
   property summary (name, address, APN, price, down payment, loan type,
   occupancy, income, employer, credit band, source of down payment) shown as
   clean labeled fields grouped in cards. Right: the **Quote Builder** — a
   form where the loan officer enters the REAL numbers: interest rate (%),
   rate valid-until date, discount points, lender/origination fees,
   estimated PMI, and a free-text note to the buyer. A live **"What the buyer
   will see"** preview card updates as they type (monthly P&I + a green
   "Live quote" tag). Footer actions: "Save draft" + primary **"Send quote to
   buyer"**.

3. **Quote Sent (confirmation).** A success state confirming the quote was
   delivered to the buyer's Cost Cockpit, with a summary of what was sent and
   a "Back to queue" button.

**Tone:** efficient, lender-grade, calm. Think a modern fintech back-office
(Stripe/Mercury cleanliness) in Plot's blue. Data-dense but breathable.

Also produce the **insurer variant** of screens 1–2 where the Quote Builder
fields are: annual premium, coverage level (replacement/extended/ACV),
deductible, carrier name, quote valid-until, and a note — same layout, same
theme.

---

## Reference for wiring (not for Stitch)

### Data the portal reads (the claimed application)
Mirrors `LoanApplicationCard` / `InsuranceQuoteCard` capture + cockpit inputs:
- Loan: buyer name, property (address + APN from the parcel selection),
  purchasePrice, downPaymentPct, loanType, occupancy, income, employer,
  creditBand, downSource.
- Insurance: yearBuilt, sqft, roof, construction, coverage, + property/price.

### What the portal WRITES back (flips the cockpit tags)
This is the payload that turns a cockpit line from `pending-application` →
`live-provider`. Lines up with `src/lib/offer/types.ts`:
- **Lender →** `interestRate { value, source:'live-provider' }`,
  `rateValidUntil` (ISO), `pointsPct`, lender-fees override, PMI override,
  set `loanState: 'quoted-live'`.
- **Insurer →** `annualInsurance { value, source:'live-provider' }`,
  set `insuranceState: 'quoted-live'`.

### Workflow states (already typed)
`needs-application → application-submitted → provider-working → quoted-live`
(`ProviderState` in types.ts). The queue's status pills map 1:1:
New=application-submitted, Claimed=provider-working, Quoted=quoted-live.

### Backend it plugs into
The lead is created when the buyer submits a card. POST targets to build:
`/api/offer/loan-application`, `/api/offer/insurance-application`,
`/api/provider/claim`, `/api/provider/quote`. Ties into the prospecting
backend (memory: project_active_workstream_prospecting_backend). Auth: the
universal OAuth gate, but provider accounts are a distinct role.

### Licensing note (why this exists)
Plot is the cockpit + the pipe; the LICENSED provider originates the loan /
binds the policy. The portal is what makes Greg's MLO/insurance license
*optional upside* instead of required — partners can supply the real numbers.
