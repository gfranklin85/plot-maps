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
  multiplier: { min: HELI_DEFAULT_TUNING.multiplier * 0.5, max: HELI_DEFAULT_TUNING.multiplier * 1.5 },  // 0.52..1.56
  turnRate:   { min: HELI_DEFAULT_TUNING.turnRate   * 0.5, max: HELI_DEFAULT_TUNING.turnRate   * 1.5 },  // 0.50..1.50
  tiltRate:   { min: HELI_DEFAULT_TUNING.tiltRate   * 0.5, max: HELI_DEFAULT_TUNING.tiltRate   * 1.5 },  // 0.90..2.70
  climbRate:  { min: HELI_DEFAULT_TUNING.climbRate  * 0.3, max: HELI_DEFAULT_TUNING.climbRate  * 1.7 },  // 0.051..0.289
};

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
    const parsed = JSON.parse(raw) as Partial<FlightTuning>;
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
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
