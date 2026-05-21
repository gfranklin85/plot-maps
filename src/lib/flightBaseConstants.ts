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

// CANONICAL "Helicopter" baseline (Greg locked 2026-05-20 from live
// flight). These ARE the 1.0×-slider numbers. Numbers were chosen
// by flying the previous defaults, dialing each slider until the
// feel landed, then promoting the effective values shown in
// FlightTuningPanel to the new base. Sliders re-center so 1.0×
// sits visually mid-slider.
//
// Future aircraft templates (jet, biplane, etc.) will live as
// alternate FLIGHT_BASE objects swapped at runtime.
export const FLIGHT_BASE = {
  // Throttle (left-stick-Y → forward/back pan along heading).
  // Reverse uses 0.4× of forward MAX (handles "back up gently"
  // without the craft snapping into full reverse).
  THROTTLE_ACCEL: 177,      // px/s² (was 170, locked from 1.04× live)
  THROTTLE_MAX:   88,       // px/s top forward speed (was 85)
  THROTTLE_DRAG:  0.965,    // per-frame decay base (^60dt)
  REVERSE_RATIO:  0.4,      // reverse cap = -MAX × this

  // Strafe (left-stick-X → sideways pan perpendicular to heading).
  // Locked at the same 1.04× scale the throttle was reading.
  STRAFE_ACCEL: 156,        // was 150
  STRAFE_MAX:   78,         // was 75
  STRAFE_DRAG:  0.96,

  // Yaw (right-stick-X → rotate heading). Greg sat at 1.00× on the
  // live readouts so the prior 2026-05-18 values stay.
  YAW_ACCEL: 110,
  YAW_MAX:   45,
  YAW_DRAG:  0.94,

  // Tilt (right-stick-Y → look up/down via cam.pitch). Greg dialed
  // 1.80× live so the new base is the effective values (144, 46.8).
  TILT_ACCEL: 144,          // was 80
  TILT_MAX:   46.8,         // was 26
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
  ZOOM_DOLLY_LOW_ALT_RATE:  0.034,   // 3.4% range/sec at full trigger (≤ 300 ft)
  ZOOM_DOLLY_HIGH_ALT_RATE: 0.238,   // 23.8% range/sec at full trigger (≥ 600 ft)
  ZOOM_DOLLY_LOW_ALT_M:  91,         // 300 ft in meters
  ZOOM_DOLLY_HIGH_ALT_M: 183,        // 600 ft in meters

  // Legacy single-rate field — kept for the FlightTuningPanel readout
  // anchor. The engine reads the zone-aware values above.
  ZOOM_DOLLY_RATE_PER_SEC: 0.034,
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
      // Both altitude-zone endpoints, scaled by the user's slider.
      // The engine reads these via dollyRateForAltitude() below.
      lowAltRate:  FLIGHT_BASE.ZOOM_DOLLY_LOW_ALT_RATE  * t.climbRate,
      highAltRate: FLIGHT_BASE.ZOOM_DOLLY_HIGH_ALT_RATE * t.climbRate,
      lowAltM:  FLIGHT_BASE.ZOOM_DOLLY_LOW_ALT_M,
      highAltM: FLIGHT_BASE.ZOOM_DOLLY_HIGH_ALT_M,
      // Legacy single-rate readout (for panels that show a flat number).
      ratePerSec: FLIGHT_BASE.ZOOM_DOLLY_RATE_PER_SEC * t.climbRate,
    },
  };
}

/**
 * Altitude-aware dolly rate. Below LOW_ALT_M = slow (prospecting);
 * above HIGH_ALT_M = fast (travel); linear ramp between. Greg's
 * 2026-05-20 spec: keep fine control where curb-level work happens,
 * stop wasting the user's time climbing through travel altitudes.
 *
 * Returns the "fraction of current range per second at full trigger"
 * value the engine multiplies into its dolly translation.
 */
export function dollyRateForAltitude(altitudeM: number, climbRateMultiplier: number): number {
  const lowRate  = FLIGHT_BASE.ZOOM_DOLLY_LOW_ALT_RATE  * climbRateMultiplier;
  const highRate = FLIGHT_BASE.ZOOM_DOLLY_HIGH_ALT_RATE * climbRateMultiplier;
  const lowAlt   = FLIGHT_BASE.ZOOM_DOLLY_LOW_ALT_M;
  const highAlt  = FLIGHT_BASE.ZOOM_DOLLY_HIGH_ALT_M;

  if (altitudeM <= lowAlt) return lowRate;
  if (altitudeM >= highAlt) return highRate;
  // Linear ramp through the transition zone.
  const t = (altitudeM - lowAlt) / (highAlt - lowAlt);
  return lowRate + (highRate - lowRate) * t;
}
