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

  // Phase 6 — Reveal. PropertyCard fades in this many ms AFTER impact.
  // Critical: the card must feel CAUSED by the impact, not coincident.
  // 100ms is the locked starting value; tune during the timing sprint.
  REVEAL_DELAY_AFTER_IMPACT_MS: 100,

  // Phase 7 — Decay. Tether fades, parcel illumination drops to a
  // sustained "selected" glow, sustained glow persists until card is
  // dismissed.
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
