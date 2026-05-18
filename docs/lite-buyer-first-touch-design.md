# Plot Lite — First-Touch Design Doc

**Status:** v1 spec, pre-build
**Owner:** Greg + Claude
**Last updated:** 2026-05-17
**Related memories:** TV living-room thesis · Atmospheric rendering thesis · Surveyor identity · Stylization overlay pipeline · Floating-drifting UX primitive · Brand voice (vintage cartography in stylized realism) · Cold open · Pin system as product surface

---

## Why this exists

Plot has grown from "a prospecting CRM" into a multi-mode spatial product. The first surface a logged-in user sees has to be designed *for a specific user in a specific mode*, not for "everyone." This doc is the design for one mode only: the **Lite-tier casual buyer**, on a couch or at a desk, opening Plot to shop for a house they could actually buy.

A separate doc will cover Pro Agent first-touch; that surface is a different artifact.

## The bigger frame: map as application

The Lite first-touch is the first concrete instance of a larger architectural shift: **the map is the application**, not a page within it. Settings, Imports, Contacts, Admin, Leads — over time, all of these become parchment drift-panels that open *over* the map rather than separate pages that navigate away from it. The map loads once when you sign in and stays alive for the entire session; everything else floats on top.

We do not rebuild that all at once. We absorb it incrementally:

- New surfaces are designed map-first by default.
- Existing pages migrate to drift-panels one at a time as we touch them for other reasons.
- The Lite first-touch is the proving ground — once the surveyor's tool tray + drift-card patterns are real on the Lite landing, every future surface inherits the same vocabulary.
- For surfaces that don't fit cleanly over a map (CSV imports, large multi-step forms), we get creative on a case-by-case basis rather than forcing them into the panel pattern. Greg has the creative call on those moments.

## The user, named

It's 8:47pm Tuesday. The Lite buyer is on their couch in Hanford. Dinner is over, the TV is on, they paid for Plot Lite a week ago. They've opened Plot maybe four times. Not in a rush. They are looking for **a house they could actually buy**, and what they don't yet know is that the one they want isn't on the MLS yet — it's owned by someone they've never met who hasn't thought about selling.

They have an Xbox controller in hand, sitting 8 feet from a 55" TV. They have not typed anything tonight and don't plan to.

The first 30 seconds have to make them feel: **this is mine, this is real, this is alive, I want to fly.**

---

## The opening shot

When Plot loads, they do not see a dashboard. They see **their own hometown from above, in motion, in the actual atmosphere of right now**, with Plot's chrome quietly settling in around the edges.

**Camera:** starts at altitude ~600m over the centroid of their saved hometown, tilt ~45°, heading rotating *very slowly* — ~2°/sec. Slower than a real helicopter would orbit. Meditative. Western-movie opener. The map is the wallpaper, and the wallpaper is alive.

**Atmosphere (per the atmospheric rendering thesis):** The stylization overlay reads:
- Solar position from user's lat/lng + clock (via suncalc, free, ~2KB)
- Live weather from Open-Meteo (free, no key) or OpenWeatherMap free tier
- AQI from AirNow + PurpleAir for Central Valley smoke awareness
- Season from date

It applies shader passes — color-grading LUT, fog density, vignette tint, particle pass for rain/snow/dust, bloom modulation — so the map renders in the user's *actual* current atmosphere. Hanford clear evening, sun just below the horizon, warm amber wash and long shadows. If it's raining in Hanford, it rains in Plot. If wildfire smoke is settling into the Valley, the map shows it.

**No music. Optional ambient pad (defaults off):** wind, distant birds, single soft chime. Per the brand-voice memory: "stylized realism," no Hollywood swell.

**What is NOT on screen:** sidebar, top nav, list of features, the word "dashboard," any reference to leads/calls/imports/admin. None of that exists for a Lite buyer. This is their mode.

---

## The chrome that settles in

After ~1.5 seconds — long enough for the rotation to register as deliberate — small artifacts fade in at the corners of the screen. Per the brand voice: vintage cartography, surveyor's tools, brass-and-parchment.

### Top center — the dateline
A small parchment strip drifts in from the top edge:

> **Tuesday Evening · Hanford, California · Clear, 78° · sunset 12 minutes ago**
>
> *2,341 parcels in view*

A surveyor's logbook entry. No greeting, no "Welcome back." The weather + parcel count are alive; they update as the camera moves and as conditions change.

### Bottom left — the surveyor's tool tray
A horizontal row of small brass/wood implements, ~40px tall, slightly clustered like tools on a desk:

| Tool | Function |
|---|---|
| Compass | Heading lock / point-north |
| Dividers | Draw a survey circle |
| Flag stake | Mark a parcel |
| Postcard envelope | Start an inquiry |
| Brass lantern | Toggle parcel layer |

No labels. They are **artifacts**. Hovering or focusing one shows a parchment tooltip *above* it ("Mark a Stake," "Draw a Survey Circle") rendered as if hand-written. Each corresponds to a real Plot action, but the user is invited to *touch them and find out*. Discovery is the onboarding.

### Bottom right — the floating-drift card
About 3 seconds in, a card drifts in from the right edge, settles, and stays. This uses the floating-drifting UX primitive memory:

> 🪶 **3 parcels caught my eye nearby**
>
> ⋅ A 1962 ranch on a half-acre lot, owner since 1987
> ⋅ A vacant 0.4 acre lot on Iona, no structure yet
> ⋅ The Magnolia Avenue house with the orchard out back
>
> *[ tap to see them on the map ]*

The Surveyor (per brand voice) is *noticing things on the user's behalf*. Three real parcels from local data, selected by a cheap server-side heuristic:

1. Longest-tenure single-family owner within ~1km radius (absentee bias)
2. Most interesting vacant parcel (largest or zoned residential)
3. One "character" pick (has orchard / vineyard / pool / unusual lot shape)

Selection is deterministic per session — user can come back to the same three. A small refresh button in the card reshuffles. Returning visits with unread owner responses promote *that* to the card slot first: "🪶 The owner at 224 E D St wrote back."

**Why this card matters:** it does the cold-start work for the user. They don't have to *know* where to look or what to look for. Plot does the looking. The card is the moment they realize Plot isn't a tool they have to operate — it's a partner that brings things to them.

### Top right — the user's mark
Tiny corner element: user's initials in a brass medallion ("GF"), and underneath a small parchment ribbon:

> **Surveyor, 1st Class**
> *commissioned May 10, 2026*

User identity per the Surveyor memory. No "settings gear," no avatar dropdown. Their identity is rendered *as a character in the world*, not as an account-UI element. Click to manage account if they want — but it doesn't beg.

---

## The first interaction

User does one of three things:

### 1. Touch a control (controller stick or mouse)
The slow rotation stops. Camera responds — left stick pans, right stick rotates, triggers climb/dive. Already-built gamepad flight controller behavior. The dateline and drift-card stay; the brass tool tray subtly highlights.

**This is the magic moment.** The wallpaper *becomes* a vehicle. They are *flying their hometown*.

### 2. Tap a tool in the tray
Cursor jumps to the tool, tooltip shows. Press A (or click) → tool activates. Compass enters heading-lock mode, dividers enter draw-circle mode, etc. **First-time activation fires a single brief coach card** ("Press A on a parcel to plant a stake. Stakes track who you're watching.") and never again. No pre-flight tutorial. Learning through doing.

### 3. Tap one of the three "caught my eye" parcels in the drift card
Camera flies (uses the existing camera choreographer) to the parcel, pitch nudges down to 60°, parcel polygon highlights with a parchment-gold outline, PropertyPopup opens with the layout we just built. Two interactions in, they're looking at a specific real house.

---

## What the buyer can do from here

Everything Lite-tier already does — but **the surface itself never goes away.** No page transitions. The map is always the canvas. UI floats on top as drift-cards and parchment panels. Actions feel like working a desk:

- **Mark a stake** → tiny red flag appears on the map (per pin-system memory)
- **Draw a survey circle** around a listing → parcels inside light up, drift-card lists them
- **Send a postcard** → envelope tool, parchment-styled compose drift-card, recipient masked (Lite never sees owner names), postcard queued
- **Send a text invitation** → same flow, different artifact
- **Save a "field"** (named saved view) → brass plaque appears on the side rail, click flies camera back to that exact pose

No menus. Every action has a *physical analog in the surveyor's world.* The brand work pays compound interest here.

---

## What the buyer never sees in Lite mode

- Owner names
- Mailing addresses
- Pro features (Dialer, AI Receptionist, Imports)
- The word "CRM"
- "Campaign," "lead," "follow-up"
- Numerical performance dashboards

The buyer is not a salesperson. They are a *shopper with style.* Plot doesn't reframe them as anything else.

---

## What changes session to session

- **First visit ever:** Cold Open ("The Survey") plays before this surface — 90s cinematic with user's name in credits, ending in a fade into this shot. After that, they never see it again unless invoked manually.
- **Returning visit:** "Caught my eye" card surfaces fresh picks. Unread owner responses promote to the card slot first.
- **No-data hometown:** card adapts: "🪶 Hanford isn't fully mapped yet. Want to be notified when it lands? Here's what's nearby in Lemoore." Turns a limitation into a list-building moment.

---

## The page in one sentence

**The Lite buyer's first surface is their hometown from the air at the actual time and weather of right now, with the Surveyor noticing three things on their behalf and a brass tool tray waiting at the bottom of the screen.**

Not a dashboard. Not a launcher. Not a feature pitch. An *invitation to fly and notice*.

---

## Build sequence

What ships in what order. Each phase is shippable and creates value on its own.

### Phase 1 — The opening shot, minus the atmosphere (1 sprint)
- Lite-route lands on a full-bleed map at user's hometown, ~600m altitude, ~45° tilt
- Slow auto-orbit (2°/sec) until first user input
- Top-center dateline drift-card with static text ("Tuesday Evening · Hanford, California · 2,341 parcels in view")
- Bottom-right "caught my eye" drift-card with 3 hardcoded sample picks for Hanford
- Strip ALL existing dashboard chrome from this route
- Lite-edition gate — Pro users skip past this to their own first-touch

### Phase 2 — Surveyor's tool tray (1 sprint)
- Bottom-left tray with 5 artifact icons (assets: Affinity per the tool-asset memory)
- Hover/focus tooltip system (parchment-styled, drifts up from tool)
- Tool activation wired to: compass, dividers, flag stake, postcard, lantern
- First-activation coach cards (one-shot, persisted)

### Phase 3 — Live "caught my eye" heuristic (1 sprint)
- Server-side function `/api/surveyor/caught-my-eye?lat&lng` that scores nearby parcels
- 3 categories per session: longest-tenure absentee, best vacant, character pick
- Deterministic seed per session, refresh button reshuffles
- Returning-visit logic: unread owner responses promote to slot 1

### Phase 4 — Atmospheric rendering (multi-sprint, lands incrementally)
This is the atmospheric thesis becoming real. Each tier ships independently and the map gets visibly better with each.

**4a — Time-of-day light (1 sprint)**
- Mount Three.js scene as `WebGLOverlayView` on the existing Google Map
- Add `suncalc` for solar position
- Color-grading LUT pass keyed on sun elevation (cold blue dawn → warm gold noon → amber sunset → deep blue night)
- Subtle vignette tint following sun direction
- This alone transforms the feel — no API calls, all local math

**4b — Live weather state (1 sprint)**
- Server route that fetches Open-Meteo for user's lat/lng, caches 10 min
- Discrete weather states: clear / overcast / rain / fog / snow / haze / thunderstorm / dust
- Fog density + color pass driven by state
- Bloom intensity modulation
- Dateline updates with live weather string ("Clear, 78°")

**4c — Particles for active weather (1 sprint)**
- Sprite-based rain / snow / dust pass
- Only renders when weather state demands it
- `prefers-reduced-motion` quiets the particle count
- Honest accessibility, not an off switch

**4d — AQI / smoke awareness (1 sprint)**
- AirNow + PurpleAir for hyperlocal AQI
- Brown-haze pass when PM2.5 elevated
- Critical for Central Valley wildfire season
- Dateline can flag it: "Smoky, 78° · AQI 142"

### Phase 5 — Returning-visit & no-data-hometown polish (1 sprint)
- Unread-response promotion logic in caught-my-eye card
- No-data-hometown copy variant
- Manual cold-open replay entry point (settings menu artifact)

---

## What this requires technically

Mostly already-built or already-planned:

- Gamepad flight controller — built
- 3D camera + photoreal tiles + parcel overlay — built
- PropertyPopup with Pro/Lite render policies — built
- Surveyor brand voice — locked in memory
- Vintage-cartography asset language — in the design backlog
- Stylization overlay pipeline — specced, this is the work to actually mount it
- Floating-drifting UX primitive — specced, this is the work to build the first instance
- Server-side "caught my eye" heuristic — new, lightweight, runs on existing `properties` + `property_layers`
- Brass tool tray icons — new asset work (Affinity)
- Cold Open — separate project (cold-open memory)

Infrastructure ready. What this design unlocks is a coherent *first moment* that uses all of it together for the first time.

---

## Open questions

These are flagged in the original conversation; capturing here so they don't get lost.

1. **Hometown source.** Profile already has `defaultMapCenter`. For Lite buyers, do we ask at signup ("Where do you want to start looking?"), infer from billing address, or both? Most important onboarding decision for this surface.

2. **Caught-my-eye heuristic — full content menu.** Beyond the three I proposed, candidates to consider:
   - Recent off-market activity (permit pulled)
   - Parcels with owner-set self-score already
   - Parcel a paid agent is *not* watching (anti-territory pitch)
   - Sensitive: owners over 70 in long-tenure homes (discussable)

3. **Tools-in-tray final set.** Compass / dividers / flag stake / postcard / lantern. Does this match the Lite feature surface? Anything missing (search? recenter?), anything redundant?

4. **Pace.** Slow rotation, 4-5s drift-in, ambient sound default off. Right feel or punchier?

5. **Cold-Open frequency.** Always first session of each day? Only the very first time forever? Memory argues "the single most important brand moment" — leans toward more frequent. But the Tuesday-night returning buyer doesn't want a 90s gate.

---

## Verification — how we know it's working

- Open Plot as a Lite user → land on the map, hometown centered, slow orbit active, dateline + tool tray + drift-card all rendered within ~3 seconds
- Touch any control → orbit stops, camera responds, chrome stays
- Tap each tool in the tray → tooltip renders, tool activates, first-time coach card fires exactly once
- Tap a "caught my eye" parcel → cinematic fly-to, polygon highlight, popup opens with full Kings data
- Pro user signing in lands somewhere ELSE entirely — the Lite first-touch never gates them
- Atmospheric pass (when 4a lands): toggle system clock to noon vs midnight, observe shader pass changes
- Atmospheric pass (when 4b lands): force a weather state via dev tool, observe fog/bloom update
