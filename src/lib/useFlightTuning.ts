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

const DEFAULT_TUNING: FlightTuning = {
  multiplier: 1.0,
  turnRate: 1.0,
  tiltRate: 1.0,
  climbRate: 1.0,
};

// Per-axis slider ranges. 1.0× is always the "designed default" feel
// (the value the base accel constants in MapView3D are tuned to), so
// the panel UI can still anchor a tick at 1.0. Bounds differ because
// the right "fast/slow" envelope is different per axis:
//
//   pan   — 0.1..2.5 (wide; user preferences vary the most here)
//   turn  — 0.5..4.0 (skewed UP — right-stick yaw was too slow at 1.0×)
//   tilt  — 0.1..2.5
//   climb — 0.05..1.2 (skewed DOWN — LT/RT was too fast at 1.0×)
//
// Greg dialed both 2026-05-18 after live flight: turn felt sluggish
// even at the high end, climb felt spaceship-fast even at the low end.
export interface AxisRange { min: number; max: number; }
export const AXIS_RANGES: Record<keyof FlightTuning, AxisRange> = {
  multiplier: { min: 0.5,  max: 5.0 },
  turnRate:   { min: 0.5,  max: 4.0 },
  tiltRate:   { min: 0.1,  max: 2.5 },
  climbRate:  { min: 0.05, max: 1.2 },
};

function clampAxis(n: number, axis: keyof FlightTuning): number {
  const { min, max } = AXIS_RANGES[axis];
  if (!Number.isFinite(n)) return 1.0;
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
    const multiplier = clampAxis(typeof parsed.multiplier === 'number' ? parsed.multiplier : 1.0, 'multiplier');
    // Back-compat: old saved tunings without per-axis fields fall
    // back to the speed multiplier value, preserving prior feel
    // until the user touches the new sliders.
    const turnRate = clampAxis(
      typeof parsed.turnRate === 'number' ? parsed.turnRate : multiplier,
      'turnRate',
    );
    const tiltRate = clampAxis(
      typeof parsed.tiltRate === 'number' ? parsed.tiltRate : multiplier,
      'tiltRate',
    );
    const climbRate = clampAxis(
      typeof parsed.climbRate === 'number' ? parsed.climbRate : multiplier,
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
