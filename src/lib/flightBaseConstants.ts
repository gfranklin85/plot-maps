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
  YAW_MAX:   45,            // deg/s (bumped 2026-05-18)
  YAW_DRAG:  0.94,

  // Tilt (right-stick-Y → look up/down via cam.pitch).
  TILT_ACCEL: 80,           // deg/s²
  TILT_MAX:   26,           // deg/s
  TILT_DRAG:  0.86,

  // LT/RT dolly (analog descent/ascent along view ray).
  // Effective speed = base × current cam.range × slider × dt,
  // so the displayed "effective" is "fraction of range per second
  // at full trigger" — independent of altitude.
  ZOOM_DOLLY_RATE_PER_SEC: 0.2,
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
    dolly: {
      // % of current range per second at full trigger.
      ratePerSec: FLIGHT_BASE.ZOOM_DOLLY_RATE_PER_SEC * t.climbRate,
    },
  };
}
