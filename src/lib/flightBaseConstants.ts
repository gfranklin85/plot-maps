// Single source of truth for the 3D-path airplane physics base
// constants. MapView3D imports these for its per-frame integration;
// FlightTuningPanel imports them to show effective live numbers
// next to each slider so Greg can dictate exact tuning values
// (e.g. "throttle MAX should be 250") instead of guessing slider
// positions.
//
// Keep this file boring — just numbers + the math that turns a
// slider multiplier into the effective value. No React, no DOM,
// no side effects. Both the engine and the panel re-read these
// every frame so a change here ripples everywhere.

// Base physics constants — these are the ENGINE's 1.0× anchor and
// stay stable so existing tuning math doesn't shift under our feet.
// The "Helicopter" defaults Greg locked 2026-05-20 are not these
// numbers — they're these numbers MULTIPLIED by the canonical
// multipliers below (HELI_DEFAULT_TUNING). The slider ranges are
// chosen so each axis's canonical multiplier sits at the visual
// midpoint of its slider.
//
// Future aircraft templates (jet, biplane, etc.) will be additional
// "*_DEFAULT_TUNING" multiplier objects swapped at runtime.
export const FLIGHT_BASE = {
  // Throttle (left-stick-Y → forward/back pan along heading).
  // Reverse uses 0.4× of forward MAX (handles "back up gently"
  // without the craft snapping into full reverse).
  THROTTLE_ACCEL: 170,      // px/s² (screen-pan accel anchor)
  THROTTLE_MAX:   85,       // px/s top forward speed
  THROTTLE_DRAG:  0.965,    // per-frame decay base (^60dt)
  REVERSE_RATIO:  0.4,      // reverse cap = -MAX × this

  // Strafe (left-stick-X → sideways pan perpendicular to heading).
  STRAFE_ACCEL: 150,
  STRAFE_MAX:   75,
  STRAFE_DRAG:  0.96,

  // Yaw (right-stick-X → rotate heading).
  YAW_ACCEL: 110,           // deg/s² (bumped 2026-05-18)
  YAW_MAX:   45,            // deg/s
  YAW_DRAG:  0.94,

  // Tilt (right-stick-Y → look up/down via cam.pitch).
  TILT_ACCEL: 80,           // deg/s²
  TILT_MAX:   26,           // deg/s
  TILT_DRAG:  0.86,

  // LT/RT dolly (analog descent/ascent along view ray).
  //
  // Two-zone altitude-aware curve (Greg locked 2026-05-20):
  //   ≤ 300 ft (≈91 m) — PROSPECTING zone. Slow, controllable. This
  //     is where fine altitude matters (firing, building inspection,
  //     curb-level work). Rate = LOW_ALT_RATE.
  //   ≥ 600 ft (≈183 m) — TRAVEL zone. Fast. At this altitude the
  //     user has different intentions and slow climb wastes time —
  //     either get them higher to look around or back down to work.
  //     Rate = HIGH_ALT_RATE.
  //   300..600 ft — smooth linear ramp between the two rates so the
  //     transition is felt as acceleration, not a snap.
  //
  // Both endpoints scale by the user's climb-rate slider so dialing
  // 0.5× halves the whole curve, 1.7× maxes the whole curve. The
  // altitude SHAPE is fixed; the magnitudes are user-tunable.
  ZOOM_DOLLY_LOW_ALT_RATE:  0.2,     // (retired — RY now drives direct climb)
  ZOOM_DOLLY_HIGH_ALT_RATE: 1.4,     // (retired)
  ZOOM_DOLLY_LOW_ALT_M:  91,
  ZOOM_DOLLY_HIGH_ALT_M: 183,
  ZOOM_DOLLY_RATE_PER_SEC: 0.2,      // (retired)

  // Vertical climb (RIGHT-STICK-Y → direct ascent/descent in m/s).
  // Engine 1.0× anchor — slider scales this. Greg flagged the prior
  // accidental climb felt fast; pick a calm base and let the user
  // tune up from the centered slider.
  CLIMB_ACCEL: 60,                   // m/s² (how quickly RY reaches max)
  CLIMB_MAX:   30,                   // m/s top vertical speed
  CLIMB_DRAG:  0.88,                 // per-frame decay base (^60dt)
} as const;

// CANONICAL "Helicopter" template — the multipliers that, when fed
// to the engine's base constants above, produce Greg's locked feel
// (screenshot 2026-05-20). Each slider's range is chosen so this
// value sits at the slider's visual midpoint.
export const HELI_DEFAULT_TUNING = {
  multiplier: 1.04,    // pan — accel 177, max 88 px/s (rev 35)
  turnRate:   1.0,     // yaw — accel 110, max 45°/s (8s per 360)
  tiltRate:   1.8,     // look (LY) — accel 144, max 46.8°/s
  climbRate:  1.0,     // climb (RY) — accel 60, max 30 m/s (centered fresh)
} as const;

/**
 * Effective tuning values given the four user multipliers. Both the
 * engine and the panel compute these the same way so the numbers
 * the user sees match the numbers the engine uses.
 *
 * Sliders scale BOTH acceleration AND max velocity (the latter was
 * added 2026-05-19 — without it, the slider lies past ~1.5× because
 * the cap doesn't move). One multiplier per axis category.
 */
export function effectiveFlightValues(t: {
  multiplier: number;   // pan (throttle + strafe)
  turnRate: number;     // yaw
  tiltRate: number;     // tilt
  climbRate: number;    // dolly
}) {
  return {
    throttle: {
      accel: FLIGHT_BASE.THROTTLE_ACCEL * t.multiplier,
      max:   FLIGHT_BASE.THROTTLE_MAX   * t.multiplier,
      reverseMax: FLIGHT_BASE.THROTTLE_MAX * t.multiplier * FLIGHT_BASE.REVERSE_RATIO,
    },
    strafe: {
      accel: FLIGHT_BASE.STRAFE_ACCEL * t.multiplier,
      max:   FLIGHT_BASE.STRAFE_MAX   * t.multiplier,
    },
    yaw: {
      accel: FLIGHT_BASE.YAW_ACCEL * t.turnRate,
      max:   FLIGHT_BASE.YAW_MAX   * t.turnRate,
      // Seconds for a full 360 at terminal velocity. Greg-readable.
      secondsPerSpin: 360 / (FLIGHT_BASE.YAW_MAX * t.turnRate),
    },
    tilt: {
      accel: FLIGHT_BASE.TILT_ACCEL * t.tiltRate,
      max:   FLIGHT_BASE.TILT_MAX   * t.tiltRate,
    },
    climb: {
      // Right-stick-Y → direct vertical velocity in m/s.
      accel: FLIGHT_BASE.CLIMB_ACCEL * t.climbRate,
      max:   FLIGHT_BASE.CLIMB_MAX   * t.climbRate,
    },
  };
}

