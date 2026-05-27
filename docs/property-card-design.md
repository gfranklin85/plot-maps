# PropertyCard — Design Doc

**Status:** Draft, 2026-05-27
**Owner:** Greg Franklin
**Tag:** Core Product Surface

---

## TL;DR

Plot's single most-seen UI surface. Every selection — Plot address, Plot parcel, pin, Google POI fallback — opens this card. Two states: **Anchored** (compact card floating over the property with a leader pointing at it) and **Expanded** (full-detail side panel). Single-card mode (new selections replace the open card; no stacking). Plot owns the visual entirely — Google's popover never shows.

This is a cathedral surface. It deserves the same care as the pin system. We're not building a tooltip; we're building Plot's primary unit of interaction.

---

## Why now

Greg's call 2026-05-27: "We want one rich popup, first to appear over the property, but if there's a ton of info to look at, we should be able to expand it to the side."

The current PropertyPopup is fixed to the bottom-left corner. It works mechanically but doesn't feel attached to the world — there's no visual link between "this card" and "that house." Meanwhile Google's own popovers (when not suppressed) DO anchor over their POIs, which feels right by comparison. Plot needs to win that comparison and then surpass it.

This also fixes a real bug surfaced today: clicking different things produces overlapping cards (Plot card + Google popover lingering simultaneously). Single-card mode + full Google suppression solves both.

---

## The interaction model

### State 1 — Anchored (default)

**Trigger:** any selection. User clicks a house, taps a pin, A-presses a POI through the cursor — all paths land here.

**Behavior:**
- Card floats over the property's screen position with a leader (tail) pointing down at it
- Tracks the target's screen position every frame as the camera moves; card stays attached to the building
- Compact size: ~280px wide, ~140-180px tall depending on data
- Content: address headline + 1-2 lines of key context + primary action row + Expand affordance
- Dismissible: B-press, ESC, X-button on the card, or click somewhere else on the map
- Replaces any previously-open card (single-card mode, no stack)

**Why anchored vs corner-pinned:**
- The card IS information about THAT property, so it should be visually attached
- Mirrors the user's mental model: I aimed at this house → here's its card → I look away → card stays with the house, not with my screen
- Matches Google's anchored pattern but in Plot's brand

### State 2 — Expanded (side panel)

**Trigger:** User clicks/A-presses the "Expand" affordance on the anchored card (chevron icon, "More" button, or tap the card body).

**Behavior:**
- Card animates from anchored position → side of screen (default: right edge)
- Becomes a tall scrollable panel filling ~360-420px of screen width × full height
- Property on the map gets a subtle highlight ring so the link between card and target is preserved
- Content expands to full record: assessor data, history, talking points, owner record, contact paths, ammo actions, notes
- Action buttons stick to the bottom of the panel so they're always reachable
- Dismissible: B-press, ESC, X-button on the panel header, or fly-far (target leaves viewport)
- Selecting a new property while expanded: panel content swaps to the new property (still expanded); old highlight ring moves to new target

**Why side-panel and not full-screen modal:**
- User is still flying; map needs to remain visible to maintain spatial context
- Side panel = "expanded view while still in flight" instead of "different page"
- Cathedral analogue: a notebook open to one side, plane still in flight

### State 3 — Dismiss

**Trigger:** B-press (controller), ESC, X-button, click outside.

**Behavior:**
- Card or panel slides away; highlight ring fades
- Map is clean; reticle/cursor returns to normal idle state

---

## Edge cases and rules

### Edge-collision (anchored card near screen edges)

The card has a default position relative to the target (offset above + slight left). When the target sits near an edge:

- **Target near top edge** → card flips below the target, leader points UP
- **Target near right edge** → card shifts left so it's still visible, leader bends to point at target
- **Target near left edge** → mirror of right edge
- **Target near bottom edge** → card stays above (default), but extra padding from bottom-bar UI

The leader (tail) always points at the target's actual lat/lng screen-projection. If the leader would have to bend more than ~45°, the card repositions to a side where it doesn't.

### Off-screen target

If the user flies until the property's projected screen position leaves the viewport:
- **Anchored state:** card auto-dismisses with a soft fade. Property is no longer in view; the card has nothing to point at.
- **Expanded state:** card stays open (it's a work surface now, not a context tooltip). Highlight ring stays where the target is, even off-screen. A small chevron-arrow on the panel can point "target is X°→ that way" for orientation.

### Multiple targets at the same screen position (POI + address + parcel all at the same point)

Already resolved by the unified click resolver priority: pin > parcel > address > Google POI. The card opens for the winning type. No "which one do you mean" picker.

### Camera-tracking performance

The card position is updated every frame the camera moves. Math is: lat/lng → screen pixel via Map3D's `cameraToLatLngAndAltitude` (or the reverse projection if Map3D exposes one) → CSS transform on the card div. Already cheap (one matrix-mult per frame). We've been doing similar work for the cursor poke.

If perf becomes a concern at scale: throttle to 30Hz, debounce updates while camera velocity > some threshold (visually invisible — when you're flying fast, the card can lag 1-2 frames behind without anyone noticing).

---

## Visual / content spec

### Anchored card

```
┌────────────────────────────────────┐
│  327 C St                       ✕  │  ← address headline + dismiss
│  327 C St, Lemoore, CA 93245       │  ← full address tail
│                                    │
│  ─────────────────────────────     │
│  [Walk]  [📨 Invite]  [📞 Dial]    │  ← primary actions
│                                    │
│  Open Full Record  ▸               │  ← expand affordance
└────────────────────────────────────┘
                  ▽   ← leader pointing at property
```

- **Headline:** Plot's font-headline, extra-bold, brand navy
- **Tail line:** font-body, small, on-surface-variant
- **Actions:** matches current PropertyPopup's action pills (Walk + Invite + Dial), kept compact
- **Background:** parchment with subtle shadow (matches landing/brand surface treatment)
- **Border:** thin ink stroke; leader tail uses same stroke
- **Leader:** SVG triangle + connecting line, snaps to bottom-center by default

### Expanded panel

Same content as the current full PropertyPopup, but laid out vertically with a sticky header at top (address + dismiss) and sticky action footer at bottom (primary action row). Everything else scrolls.

Sections (collapsed by default, expandable):
- **At a glance** (key facts pill row, always visible)
- **Assessor record** (parcel-tier counties)
- **Owner record** (skip-trace, ammo-debited; placeholder + CTA if not yet fetched)
- **Property history** (sales, listings, comps)
- **Outreach history** (Plot's own log of touches)
- **Notes** (user's notes, save inline)
- **Talking points** (script generator)

Already exists in current PropertyPopup; the redesign just changes the chrome (anchored vs corner) and the container (side panel instead of fixed-bottom-left).

---

## Suppressing Google's popover

The wart in today's screenshot: Google's "327 C St / Maps" white card still appears for some click paths. The fix:

- Every gmp-click handler branch (POI placeId branch, surface position branch, address-layer hit, parcel-layer hit) calls `event.stop()` AND `event.stopPropagation()` AND `event.preventDefault?.()` before doing anything else. Belt-and-suspenders.
- Also set `gmp-map-3d`'s `default-popover` attribute (if exposed) to a non-default value, OR intercept any popover-creation DOM mutation via MutationObserver as a last resort.
- For Steam Input's synthetic clicks on POIs: same path. The browser doesn't distinguish synthetic vs real for purposes of event.stop().

This belongs in this design doc because "PropertyCard is Plot's only card" is the whole product position. Google's popover is a leak from underneath; suppressing it is part of taking ownership.

---

## Technical architecture

### Component tree

```
<PropertyCard>             ← top-level controller
  ├ <AnchoredCard>         ← state=anchored
  │   ├ leader (SVG)
  │   └ card body (compact)
  └ <ExpandedPanel>        ← state=expanded
      ├ sticky header
      ├ scroll body (existing PropertyPopup sections, refactored)
      └ sticky footer (action pills)
```

State machine: `{ kind: 'closed' | 'anchored' | 'expanded', target: ResolvedTarget }`. Owned by the page (`src/app/map/page.tsx`), passed in as props.

### Anchor projection

New util `latLngToScreenPx(map: Map3DElement, lat: number, lng: number, altitude: number): {x, y, visible}`.

Uses Map3D's matrix to project the target's lat/lng to a screen pixel. Returns `visible: false` when the projected point is behind the camera or outside viewport. Called every frame the card is anchored. Falls into existing camera-ref pattern (no React re-render per frame; mutate ref + CSS transform via direct DOM).

### Refactor of the existing PropertyPopup

Existing `PropertyPopup.tsx` is the *content* (the sections, the resolvers). We keep that as the **inner content** of `<ExpandedPanel>` essentially unchanged. The *chrome* (positioning, sizing, anchor vs side-panel) is new — that's what `PropertyCard` is.

This is important: the existing resolver branches (parcel/gpoi/addr) and the data-rendering code is already correct. We're not rewriting that. We're putting it in a different frame.

---

## Animation language

- **Open (closed → anchored):** card fades in + scales from 0.92 → 1.0, 180ms, ease-out. Leader draws from 0% → 100% along its length, 220ms, ease-out.
- **Expand (anchored → expanded):** card slides from its anchored position to the screen edge over 280ms, ease-in-out. Simultaneously: leader fades out, card grows in width/height to side-panel dimensions, body sections fade in staggered by ~40ms each. Highlight ring on map fades in last.
- **Dismiss:** mirror of open. 120ms.

These are placeholders for v1 — final timings get tuned during build. Don't over-spec animation in a doc.

---

## Scope of v1

**In v1:**
- State machine (closed / anchored / expanded)
- Anchored card with leader, camera-tracking
- Expand affordance + transition to side panel
- Side panel scrollable, contains existing PropertyPopup content
- Dismissal paths (X, B-press, ESC, click outside)
- Google popover suppression (event.stop on all branches)
- Off-screen auto-dismiss for anchored state
- Single-card mode (new selection replaces open card)

**Not in v1 (follow-up sprints):**
- Cinematic open animation polish (V1 ships with simple fade/slide)
- Edge-collision handling beyond the basics (start with always-above; flip-below if needed)
- Highlight ring on the target (simple highlight in v1, branded ring later)
- Multi-card / clipboard mode (deferred; v2 if users want it)
- Mobile touch path (separate design sprint)
- Card-as-pin-customization (the eventual "drag your card to pin it permanently" feature)

---

## Visual brand integration

This card is Plot's most-visible surface. It uses:
- **Parchment background** with subtle warm light (matches landing, surveying field manual brand)
- **Brand navy ink** for headings, **coral hallmark** for primary actions
- **Theodolite-style decorative elements** in expanded panel section dividers (subtle, not overwhelming)
- **Drop shadow** with a slight warm tint, matching upper-left canonical light direction
- **Typography:** existing font-headline + font-body stack

The card should feel like a page torn from Plot's surveying encyclopedia — same material as the landing.

---

## Sequencing within this design

1. Implement `latLngToScreenPx` projection util
2. Build `<AnchoredCard>` component (positioning + leader SVG)
3. Build `<ExpandedPanel>` (refactor existing PropertyPopup content into it)
4. Wire state machine in page.tsx, replacing current `selectedLead` single-state model
5. Implement Google popover suppression (gmp-click event.stop in all branches)
6. Add dismiss paths
7. Animation passes (open / expand / dismiss)
8. Live test against the address layer with controller + mouse paths

---

## Resolved direction (locked 2026-05-27)

1. **Side-panel placement:** opens on right OR left depending on screen space, AND **user-movable** — drag the panel by its header to dock to the other side. Position persists per session. v1: defaults to right; v2 adds drag-to-dock.
2. **Highlight ring on the property when card is open:** YES. Subtle pulsing ring drawn at the target's ground projection. Brand-styled (parchment-cream stroke + slow breathing pulse). When the card expands to side panel, the ring stays on (the only thing keeping the visual link between panel and target). When card closes, ring fades.
3. **Leader visual:** branded, not generic. Direction stays in this doc as "ink-drawn line from the card to a small surveyor's flag planted at the target." Final spec lives in the Affinity design pass; build v1 with a clean SVG line + small triangle tip and replace asset later. The leader is a brand surface, not a tooltip arrow.
4. **Hover-preview:** NOT default-on (would distract during flight). Surfaces only under specific conditions:
   - User is **idle** (no stick input for 1.5s+) AND cursor is parked on a building → tiny pre-card preview fades in (just street number + name if available)
   - During **active flight**, hover-preview stays off — only explicit A-press / click promotes to full card
   - Tunable; v1 ships with idle-only trigger and we'll see if it's the right threshold
   - The "preview card" is a third state of PropertyCard ("hint") — even smaller than anchored, dismissed by any movement

---

## Related project memories

- [[project-plot-address-layer-thesis]] — every click goes through this card now
- [[project-pin-system-as-product-surface]] — same design tier as pins; this is the "what happens after you click a pin" surface
- [[project-floating-drifting-ux-primitive]] — pattern overlap for drift-in / drift-out chrome
- [[project-controller-cursor-model]] — A-press from the cursor lands here
- [[feedback-cathedral-mode]] — this surface deserves it
- [[project-master-logomark-locked]] — visual brand alignment
- [[project-brand-voice-analog-digital-fusion]] — parchment material + theodolite motifs
