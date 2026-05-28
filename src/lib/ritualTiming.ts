// Confirmation-ritual timing constants — single source of truth.
//
// Every component in the ritual (CustomReticle, RitualTether, parcel
// illumination, ritualAudio, PropertyCard reveal) reads from this
// object. Tune in ONE place, ripple everywhere.
//
// Greg's locked direction 2026-05-27: timing IS the feature. Visuals
// are skin. Don't tune values in scattered components. Don't polish
// visuals before the rhythm here is locked.
//
// See docs/confirmation-ritual-design.md for the canonical spec.

export const RITUAL_TIMING = {
  // Phase 3 — Engage. User pressed A / clicked. The clock starts here.
  // (Reserved for future debounce / pre-roll if we ever need it.)
  ENGAGE_DELAY_MS: 0,

  // Phase 3 → 4. Tether launches from operator origin (viewport bottom
  // center in v1). This is the "wind-up" before travel begins.
  LAUNCH_DURATION_MS: 50,

  // Phase 4 — Travel. Tether visibly traverses from origin to target.
  // Distance-scaling lives in the tether component; this is the base
  // duration for an average-distance target. Closer = faster, farther
  // = slower, clamped on both ends so the rhythm doesn't drift too far.
  TRAVEL_DURATION_MS: 450,
  TRAVEL_DURATION_MIN_MS: 300,
  TRAVEL_DURATION_MAX_MS: 700,

  // Phase 5 — Impact frame. Computed as LAUNCH + TRAVEL by callers.
  // Listed here as a derived value for clarity; do not edit directly.
  // (Sound peak + parcel illumination peak + tether arrival ALL fire
  // on this frame. Off-by-one breaks the spell.)
  get IMPACT_FRAME_OFFSET_MS(): number {
    return this.LAUNCH_DURATION_MS + this.TRAVEL_DURATION_MS;
  },

  // Phase 5.5 — Vertical rebound (the "node bounces up" beat).
  // Greg locked 2026-05-28: the design-intelligence breakthrough.
  // On impact, the energy REDIRECTS vertically — a beam shoots up
  // from the property to where the card will land. This is what
  // separates "popup opens" from "information is deployed."
  //
  // Pressure pause: brief beat between impact and rise. Sells
  // the redirection mentally — the impact compresses, then releases
  // upward. Without it, the rise reads as a continuation of the
  // incoming tether instead of a NEW direction.
  REBOUND_PRESSURE_PAUSE_MS: 40,
  // Rise duration: how long the vertical beam takes to extend from
  // impact point to popup altitude. Fast enough to feel snappy,
  // slow enough to read as movement (not a flash).
  REBOUND_RISE_DURATION_MS: 220,
  // Stabilization hold: the beam holds at full extension before the
  // popup fades in. The "stand still and present yourself" beat.
  REBOUND_STABILIZE_MS: 80,
  // Vertical pixel distance the beam extends (in screen space for v1;
  // v2 with world-space 3D this becomes meters). The popup's bottom
  // edge sits at impactY - REBOUND_RISE_DISTANCE_PX.
  REBOUND_RISE_DISTANCE_PX: 140,

  // Phase 6 — Reveal. PropertyCard fades in after the beam rises +
  // stabilizes. The card must feel DEPLOYED by the beam, not
  // coincident with it.
  // Derived: rebound (pause + rise + stabilize) is the full lead-up
  // to reveal. Caller computes the absolute reveal timestamp.
  REVEAL_DELAY_AFTER_IMPACT_MS: 40 + 220 + 80, // pressure + rise + stabilize

  // Phase 7 — Decay. Tether fades, parcel illumination drops to a
  // sustained "selected" glow, sustained glow persists until card is
  // dismissed.
  // Vertical beam stays VISIBLE under the popup as the umbilical
  // connecting card to property (does not fade until dismiss).
  REBOUND_BEAM_RETRACT_MS: 200,
  TETHER_FADE_MS: 200,
  ILLUMINATION_PEAK_HOLD_MS: 50,
  ILLUMINATION_DECAY_TO_SUSTAINED_MS: 150,
  SUSTAINED_TO_IDLE_MS: 150,

  // Hover-acquisition feedback (Phase 2 — pre-engage). When reticle
  // moves over a targetable parcel/address, the reticle shifts state.
  // Debounced ground-projection query rate. 10Hz feels responsive
  // without thrashing the projection math or the backend.
  HOVER_QUERY_RATE_HZ: 10,
  HOVER_STATE_TRANSITION_MS: 120,
} as const;

export type RitualTiming = typeof RITUAL_TIMING;
