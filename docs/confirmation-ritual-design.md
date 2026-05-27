# Confirmation Ritual — Design Doc

**Status:** Draft, 2026-05-27
**Owner:** Greg Franklin
**Tag:** Core Product Surface / Interaction Language

---

## TL;DR

Every targetable interaction in Plot is a confirmation ritual: **aim → engage → travel → impact → reveal**. Tether launches from operator space, travels toward target, impacts with synchronized sound + illumination + arrival on a single frame, then the PropertyCard reveals 50–150ms later. The reveal feels caused by the connection.

Plot's interaction layer is not "click and a popup appears." It is a deliberate physical-causality ceremony. Timing is the feature; visuals are skin.

This doc locks the spec for v1 prototype (screen-space tether) and outlines v2 (world-space 3D tether). The cathedral version of "clicking on a parcel."

---

## Why now

Today: cursor + click works. PropertyCard opens. It works mechanically. But it has zero ceremony. The popup appears with no causality — it could've been a tooltip, a keyboard shortcut, anything. The interaction is functional but inert.

Greg's garage conversation 2026-05-27: this is the layer where Plot stops being "a map app" and becomes interaction-ritual software people physically remember. Most software never reaches this level of intentionality. Plot can.

Architectural prerequisites are met: cursor system works, click resolver routes to the right data, parcel polygons exist for Kings + soon other counties. The ground is ready. Time to lay the ceremony on top.

---

## The five phases

### Phase 1 — Aim (continuous)

User's cursor is rendered as a **custom theodolite reticle** inside the map container. OS cursor hidden in that container only. Real cursor functionality preserved everywhere else — moves across monitors, into/out of the map, click events fire identically.

Visual: thin linework, calibration ticks, optional center dot. Restrained. Surveying instrument vocabulary, NOT gamer crosshair.

### Phase 2 — Hover acquisition (when reticle moves over a targetable parcel/address)

Reticle subtly **shifts state**:
- Color tint (parchment → faint coral or coral-tipped ticks)
- Tick activation (calibration marks brighten)
- Optional subtle scale or ring pulse

**No popup. No card. No noisy UI.** This is instrument awareness, not interaction. Returns to neutral state when off-target.

The hover state needs a cheap target-presence query: cursor position → projected ground lat/lng → "is there a Plot parcel or address near here?" Debounced ~100ms, cached aggressively.

### Phase 3 — Engage (t=0)

User presses A / clicks. The ritual begins.

- t=0: Click event fires
- t=0–50ms: Tether launches from operator origin
- v1 origin: screen-bottom-center of viewport
- v2 origin: anchored to user's craft/cockpit in 3D world space

### Phase 4 — Travel (t=50–500ms, distance-scaled)

Tether visibly moves from origin toward the reticle's current screen position. Travel time scales modestly with distance — closer targets resolve faster, distant targets feel like a real connection traversing space.

**Vocabulary:** information transfer beam, calibration lock, cable, magnetic coupling. Not laser. Not weapon. Optical and electrical, not combat.

For v1: an animated SVG line or particle stream from origin to target. Smooth easing (likely `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out-expo equivalent), gradient or animated dash. Crude is fine. Timing is the feature.

### Phase 5 — Impact (one frame, t≈500ms)

**Three things happen on the same frame:**

1. **Sound peak** — short transient (200–400ms total envelope, but peak hits here). Calibration lock / electrical relay / magnetic coupling. Web Audio API scheduled via `AudioContext.currentTime`, NOT `<audio>` tag.
2. **Parcel polygon illumination peak** — the target parcel polygon glows. Brand parchment-cream stroke + warm interior fill, brightest at this frame. World-space rendering (we have the polygons; we know which one is under the cursor). For addresses without polygons, fall back to a ground-circle ripple at the address point.
3. **Tether arrival** — beam/line reaches target endpoint.

This frame is what the brain interprets as physical causality. Off-by-one-frame breaks the spell.

### Phase 6 — Reveal (t=550–650ms)

PropertyCard fades in. Small intentional delay after impact — 50–150ms. The card must feel CAUSED by the connection, not coincidental.

PropertyCard's own design ([[project-property-card-design]]) takes over from here: anchored over target with leader, expandable to side panel.

### Phase 7 — Decay (continuous after reveal)

- Tether fades out over ~200ms after impact
- Parcel illumination drops from peak to a sustained "selected" glow over ~150ms
- Sustained glow persists until card is dismissed
- On dismiss, illumination fades to neutral over ~150ms

---

## The locked timing table

```
t=0ms        Click / A-press / engage
t=0–50ms     Tether launches from operator origin
t=50–500ms   Travel (distance-scaled within range)
t=500ms      IMPACT FRAME:
               · Sound peak
               · Parcel illumination peak
               · Tether arrival
t=550–650ms  PropertyCard reveals
t=550–700ms  Tether fades out
t=550–650ms  Illumination drops to sustained glow
```

These numbers are starting values. The prototype's job is to find the right tuning. Treat them as load-bearing once tuned — they shouldn't drift across surfaces (parcel click, pin click, postcard send, all should share the same rhythm).

---

## v1 scope (prototype)

**In scope:**

1. **CustomReticle component** — hides OS cursor in map container, renders theodolite reticle synced to cursor pixel
2. **Hover acquisition state** — reticle shifts when over a targetable parcel/address
3. **Tether (screen-space)** — SVG line/beam from viewport-bottom-center to reticle, animated on click
4. **Impact effects** — placeholder sound (Web Audio) + parcel polygon illumination (Kings County polygons)
5. **PropertyCard reveal delay** — small `setTimeout` between click and card-open
6. **Timing prototype harness** — tunable constants in one place so we can iterate on milliseconds without hunting through code

**Not in v1 (deferred):**

- World-space 3D tether (v2 — Blender asset, attached to user's craft)
- Final reticle visual (placeholder SVG fine for prototype)
- Final tether visual (placeholder line/beam fine)
- Final sound (placeholder transient fine; Greg sources real audio later)
- Parcel-less address ripple (add once basic ritual works for parcel case)
- Multi-target ritual (skip-trace, postcard) — same architecture, different targets, follow-up sprints

---

## Technical architecture

### Cursor / reticle layer

**File:** `src/components/map/CustomReticle.tsx`

- Listens to `mousemove` on `window` for cursor x/y
- Renders a fixed-positioned div with the reticle SVG at `transform: translate(x, y)`
- `cursor: none` CSS rule scoped to the map container only (not the rest of Plot UI)
- Hover state managed by a ref — reticle component reads "is over target" from a shared state, applies hover class
- No React re-render on cursor move; CSS transforms only

### Hover acquisition

**Mechanism:**
- Throttled (~10Hz) sample of cursor's projected ground lat/lng
- Query: `/api/parcels/at-point` + `/api/addresses/at-point` in parallel, debounced
- Cache results by lat/lng grid bucket (~1m precision) so re-hover is instant
- If either returns a hit → set `hoverTargetRef.current = true`, reticle shifts state
- If both null → `hoverTargetRef.current = false`, reticle neutral

### Tether (v1, screen-space)

**File:** `src/components/map/RitualTether.tsx`

- Full-viewport `<svg>` overlay, `pointer-events: none`, sits above the map and below the reticle
- On engage event: launches a `<line>` from `(viewport.width / 2, viewport.height)` to current cursor pixel
- Animates via Web Animations API (`element.animate(...)`) — JS controls timing; CSS transitions can't sync precisely enough
- After impact frame, tether fades and is removed

### Impact illumination

**Reuses:** existing parcel overlay infrastructure (`ParcelOverlay.tsx` / `Parcel3DOverlay.tsx`). We add a per-parcel "ritual state" — `idle | activating | sustained` — and the overlay renders different styles per state.

On impact frame:
- Set target parcel's ritual state to `activating`
- Brand-styled stroke + warm fill at peak intensity
- After 150ms, transition to `sustained` (dimmer glow)
- On card dismiss, transition to `idle`

For addresses without polygon coverage: render a circle ripple at the address point. Same impact frame, same timing.

### Sound

**File:** `src/lib/ritualAudio.ts`

- Single `AudioContext` instantiated lazily on first user gesture
- Preload a short impact sample (placeholder until Greg sources real one)
- On engage: schedule `source.start(impactTime)` where `impactTime = audioContext.currentTime + (travelDurationMs / 1000)`
- Web Audio scheduling guarantees frame-accurate playback; `<audio>` tags do not

### State machine

**Where:** new hook `useRitual()` in `src/lib/useRitual.ts`

States: `idle | aiming | engaging | traveling | impacting | revealing | sustained | decaying`

Transitions are time-based; impact frame fires synchronized callbacks (sound, illumination, PropertyCard reveal trigger). Page subscribes to ritual state and renders/animates accordingly.

### Timing constants

**File:** `src/lib/ritualTiming.ts` — single source of truth for ALL timing constants.

```ts
export const RITUAL_TIMING = {
  ENGAGE_DELAY_MS: 0,
  LAUNCH_DURATION_MS: 50,
  TRAVEL_DURATION_MS: 450,    // tunable per-distance
  IMPACT_FRAME_OFFSET_MS: 500, // launch + travel
  REVEAL_DELAY_AFTER_IMPACT_MS: 100,
  TETHER_FADE_MS: 200,
  ILLUMINATION_PEAK_HOLD_MS: 50,
  ILLUMINATION_DECAY_TO_SUSTAINED_MS: 150,
  SUSTAINED_TO_IDLE_MS: 150,
} as const;
```

Every component reads from this object. Tune in one place, ripple everywhere. This is the prototype harness.

---

## v2 — world-space tether (post-prototype)

Once v1 timing is locked, the tether evolves:

- **Origin in 3D world space** — anchored to the user's craft / cockpit / pilot avatar belly
- **Travels in 3D** — projected per-frame from world origin to world impact point with proper perspective
- **Material** — Blender-authored asset (Greg's specialty), imported as glTF or splat
- **Impact 3D effect** — small particle burst at parcel surface, lit by canonical warm upper-left light
- **Camera-relative anchor** — when user banks, the tether origin moves with the craft

The timing table stays the same. Only the rendering surface changes. This is intentional — the rhythm is the load-bearing piece; the visuals are upgrades on top of an already-tuned ritual.

Don't make the Blender asset until v1 timing is locked.

---

## Sound design

Greg's locked direction:

**YES:** calibration lock, instrument confirmation, magnetic coupling, electrical connection, relay engagement, optical synchronization, data uplink, soft metallic precision, restrained electrical resonance, low-frequency tactile confirmation, clean transient.

**NO:** laser gun, explosion, arcade zap, sci-fi weapon, music notes.

**Format:** short WAV or MP3, ~200–400ms total length, peak in first ~80ms of file. Mono or stereo, 48kHz preferred.

**Sourcing options:**
- Generated synthesis (TidalCycles, SuperCollider — Greg's domain)
- Field recording (real instruments — clicks, locks, relays, springs)
- Licensed libraries (Boom Library "Cinematic Toolbox", A Sound Effect "Electrical Mechanisms")

For prototype: any short clean transient works. Replace with final sample once timing is locked.

---

## Anti-patterns (do not do)

- ❌ Don't open PropertyCard on click. Open it on impact + reveal-delay.
- ❌ Don't use `<audio>` tags for the impact sound. Use AudioContext.
- ❌ Don't tune timing values in scattered components. Use the single constants file.
- ❌ Don't make the ritual fire on hover. Hover acknowledgment ≠ ritual.
- ❌ Don't make the tether visible at idle. It's event-driven, not ambient.
- ❌ Don't polish visuals before timing is locked. Crude line + correct rhythm beats beautiful line + wrong rhythm.
- ❌ Don't break the cursor system. The Steam Input + browser Gamepad API hybrid stays. We're adding render + audio layers on top.
- ❌ Don't lore-trap. The tether is an instrument tool, not a weapon, not a magic spell, not a sci-fi gun.

---

## Sequencing within this design

1. Create `src/lib/ritualTiming.ts` with the constants table
2. Create `src/components/map/CustomReticle.tsx` — hides OS cursor in map container, renders theodolite SVG at cursor pixel
3. Wire hover acquisition (debounced cursor → ground projection → parcel/address presence check → ref-based hover class)
4. Create `src/components/map/RitualTether.tsx` — full-viewport SVG, animates on engage event
5. Create `src/lib/ritualAudio.ts` — AudioContext setup, preloaded impact sample, scheduled playback
6. Extend parcel overlay with `ritual` state — `idle | activating | sustained`
7. Create `src/lib/useRitual.ts` — state machine + synchronized impact-frame callback
8. Wire PropertyCard reveal to use `REVEAL_DELAY_AFTER_IMPACT_MS` after engage instead of immediate
9. **Tune the constants** — this is the actual work. Iterate on milliseconds until it feels physical.
10. Live test against the address layer in Kings County (parcels exist) AND a non-parcel address (ripple fallback)

Step 9 is the load-bearing one. Steps 1–8 are scaffolding.

---

## Related project memories

- [[project-confirmation-ritual-thesis]] — the canonical principle
- [[project-property-card-design]] — the reveal phase
- [[project-controller-cursor-model]] — the input layer that triggers the ritual
- [[project-plot-address-layer-thesis]] — the data the ritual reveals
- [[project-pin-system-as-product-surface]] — same design tier, related rituals (pin placement)
- [[project-stylization-overlay-pipeline]] — impact illumination is part of this pipeline
- [[project-cockpit-as-product]] — v2 tether origin lives here
- [[feedback-cathedral-mode]] — this surface IS the cathedral
- [[feedback-no-basic-css-magic]] — visuals get the craftsman touch, not CSS gradient defaults
