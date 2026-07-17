'use client';

import { useCallback, useEffect, useState } from 'react';

// Flight-feel tuning persisted per browser per user. Four independent
// axes, each with its own slider so users can dial pan / turn / tilt /
// climb to their personal cruise feel without one knob overloading
// another. Defaults all sit at 1.0× — the helicopter-cruise pace
// tuned 2026-05-17.
//
//   speedMultiplier — scales pan (left stick) only.
//   turnRate        — scales yaw (right-X horizontal rotation) only.
//   tiltRate        — scales tilt (right-Y look up/down) only.
//   climbRate       — scales LT/RT trigger descent/ascent only.
//
// Idle hover wave compensation is intentionally NOT tunable. It's
// time-driven (not multiplier-driven) and protects the "alive at
// rest" feel from user-config disruption.

const STORAGE_KEY = 'plotmaps.flightTuning';
// Bump when the canonical defaults or slider ranges change so old
// stored values don't override the new defaults. Reading from a
// stale version returns the canonical defaults instead of the
// outdated numbers. Greg auto-migrated v3 → v4 (2026-05-21) to
// pick up the helicopter template centering.
const SCHEMA_VERSION = 7;

export interface FlightTuning {
  multiplier: number;  // pan
  turnRate: number;
  tiltRate: number;
  climbRate: number;
}

// Default tuning = Greg's locked canonical "Helicopter" template
// (2026-05-20). Lives in flightBaseConstants.ts so swapping templates
// later (jet / biplane / etc.) is a one-import change.
import { HELI_DEFAULT_TUNING } from './flightBaseConstants';
const DEFAULT_TUNING: FlightTuning = { ...HELI_DEFAULT_TUNING };

// Per-axis slider ranges. Each range is chosen so the canonical
// default multiplier sits at the slider's visual midpoint — meaning
// "drag to the middle" reproduces Greg's locked feel exactly.
// Width gives the user ±50% taste room on either side of canonical.
// Formula: width = canonical, so min = canonical × 0.5, max = canonical × 1.5.
// (For climb with very small canonical, we widen the floor slightly
// to allow finer cinematic settings.)
export interface AxisRange { min: number; max: number; }
export const AXIS_RANGES: Record<keyof FlightTuning, AxisRange> = {
  // FLIGHT SPEED + CLIMB RATE tops blown WAY up (Greg 2026-07-16): full slider
  // = rip across the globe and punch into SPACE in a few seconds, not cruise.
  //   • Climb max 1500× → climb.max = 30 m/s × 1500 = 45,000 m/s. The Kármán
  //     line (~100 km) in ~2.2 s — slam the lever, you're in space.
  //   • Speed max 400× → throttle.max = 85 px/s × 400 = 34,000 px/s of screen
  //     pan. Ground speed is altitude-scaled (metersPerScreenPixel × range), so
  //     at altitude full throttle carries you across continents per second.
  // The `pivot` in FlightTuningPanel anchors each default at the slider MIDPOINT,
  // so the bottom half stays fine/controllable and this huge headroom lives in
  // the top half. Ranges only WIDEN → old stored tunings stay valid (no schema
  // bump). Google's tile loader may lag at these speeds; the camera still flies.
  multiplier: { min: HELI_DEFAULT_TUNING.multiplier * 0.5, max: 400 },  // 0.52..400 — globe-crossing at altitude
  turnRate:   { min: HELI_DEFAULT_TUNING.turnRate   * 0.5, max: HELI_DEFAULT_TUNING.turnRate   * 1.5 },  // 0.50..1.50
  tiltRate:   { min: HELI_DEFAULT_TUNING.tiltRate   * 0.5, max: HELI_DEFAULT_TUNING.tiltRate   * 1.5 },  // 0.90..2.70
  climbRate:  { min: HELI_DEFAULT_TUNING.climbRate  * 0.3, max: 1500 },  // 0.3..1500 — ~45,000 m/s, into space in ~2s
};

// ── Named tiers (Greg 2026-07-16) ─────────────────────────────────────
// The abstract multiplier was unreadable ("0.99× vs 78.95×", <1 below the
// midpoint, extravagant above). Instead, the Flight Speed + Climb Rate sliders
// snap through IDENTIFIABLE tiers, each a fixed multiplier mapped to a real-
// world feel. Evenly spaced on the slider so every tier gets equal real-estate
// (no more lopsided pivot). `mult` feeds effectiveFlightValues exactly like a
// hand-dragged value; `note` is the human label shown live.
export interface FlightTier { name: string; mult: number; note: string; }

// SPEED (throttle.max = 85 px/s × mult, altitude-scaled to ground speed).
export const SPEED_TIERS: FlightTier[] = [
  { name: 'Drone',         mult: 0.6,  note: 'slow, hover-close' },
  { name: 'Helicopter',    mult: 1.04, note: 'cruise (default)' },
  { name: 'Cessna',        mult: 4,    note: 'small-plane pace' },
  { name: 'F-18',          mult: 20,   note: 'fighter-jet fast' },
  { name: 'City Travel',   mult: 60,   note: 'cross a city in seconds' },
  { name: 'Country Travel',mult: 150,  note: 'cross a state in seconds' },
  { name: 'Space Travel',  mult: 400,  note: 'rip across the globe' },
];

// CLIMB (climb.max = 30 m/s × mult).
export const CLIMB_TIERS: FlightTier[] = [
  { name: 'Cinematic',  mult: 0.5,  note: '~15 m/s — slow rise' },
  { name: 'Helicopter', mult: 1.0,  note: '~30 m/s — steady climb' },
  { name: 'Jet',        mult: 5,    note: '~150 m/s — fast ascent' },
  { name: 'Rocket',     mult: 50,   note: '~1,500 m/s — launch' },
  { name: 'Space',      mult: 1500, note: '~45,000 m/s — orbit in ~2s' },
];

/** Nearest tier to a raw multiplier (for showing the active name). */
export function nearestTier(tiers: FlightTier[], mult: number): FlightTier {
  let best = tiers[0];
  let bestD = Infinity;
  for (const t of tiers) {
    const d = Math.abs(Math.log(t.mult) - Math.log(Math.max(1e-6, mult)));
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

function clampAxis(n: number, axis: keyof FlightTuning): number {
  const { min, max } = AXIS_RANGES[axis];
  if (!Number.isFinite(n)) return DEFAULT_TUNING[axis];
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function readFromStorage(): FlightTuning {
  if (typeof window === 'undefined') return DEFAULT_TUNING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TUNING;
    const parsed = JSON.parse(raw) as Partial<FlightTuning> & { version?: number };
    // Schema version gate — stale stored values from before the
    // canonical-centering change get discarded so the user sees
    // the new defaults instead of their old custom tuning.
    if (parsed.version !== SCHEMA_VERSION) return DEFAULT_TUNING;
    const multiplier = clampAxis(typeof parsed.multiplier === 'number' ? parsed.multiplier : DEFAULT_TUNING.multiplier, 'multiplier');
    // Per-axis fallback: any missing axis falls back to the canonical
    // default for that axis (NOT to the multiplier — older tunings
    // had different scaling and would now produce wrong feel).
    const turnRate = clampAxis(
      typeof parsed.turnRate === 'number' ? parsed.turnRate : DEFAULT_TUNING.turnRate,
      'turnRate',
    );
    const tiltRate = clampAxis(
      typeof parsed.tiltRate === 'number' ? parsed.tiltRate : DEFAULT_TUNING.tiltRate,
      'tiltRate',
    );
    const climbRate = clampAxis(
      typeof parsed.climbRate === 'number' ? parsed.climbRate : DEFAULT_TUNING.climbRate,
      'climbRate',
    );
    return { multiplier, turnRate, tiltRate, climbRate };
  } catch {
    return DEFAULT_TUNING;
  }
}

function writeToStorage(t: FlightTuning) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...t, version: SCHEMA_VERSION }));
  } catch { /* ignore */ }
}

export function useFlightTuning() {
  const [tuning, setTuningState] = useState<FlightTuning>(DEFAULT_TUNING);

  useEffect(() => {
    setTuningState(readFromStorage());
  }, []);

  const setMultiplier = useCallback((multiplier: number) => {
    const clamped = clampAxis(multiplier, 'multiplier');
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, multiplier: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setTurnRate = useCallback((turnRate: number) => {
    const clamped = clampAxis(turnRate, 'turnRate');
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, turnRate: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setTiltRate = useCallback((tiltRate: number) => {
    const clamped = clampAxis(tiltRate, 'tiltRate');
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, tiltRate: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setClimbRate = useCallback((climbRate: number) => {
    const clamped = clampAxis(climbRate, 'climbRate');
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, climbRate: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setTuningState(DEFAULT_TUNING);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { tuning, setMultiplier, setTurnRate, setTiltRate, setClimbRate, resetToDefault };
}
