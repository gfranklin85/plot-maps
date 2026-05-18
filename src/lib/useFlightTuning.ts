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

function clampMultiplier(n: number): number {
  if (!Number.isFinite(n)) return 1.0;
  if (n < 0.1) return 0.1;
  if (n > 2.5) return 2.5;
  return n;
}

function readFromStorage(): FlightTuning {
  if (typeof window === 'undefined') return DEFAULT_TUNING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TUNING;
    const parsed = JSON.parse(raw) as Partial<FlightTuning>;
    const multiplier = clampMultiplier(typeof parsed.multiplier === 'number' ? parsed.multiplier : 1.0);
    // Back-compat: old saved tunings without per-axis fields fall
    // back to the speed multiplier value, preserving prior feel
    // until the user touches the new sliders.
    const turnRate = clampMultiplier(
      typeof parsed.turnRate === 'number' ? parsed.turnRate : multiplier,
    );
    const tiltRate = clampMultiplier(
      typeof parsed.tiltRate === 'number' ? parsed.tiltRate : multiplier,
    );
    const climbRate = clampMultiplier(
      typeof parsed.climbRate === 'number' ? parsed.climbRate : multiplier,
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
    const clamped = clampMultiplier(multiplier);
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, multiplier: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setTurnRate = useCallback((turnRate: number) => {
    const clamped = clampMultiplier(turnRate);
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, turnRate: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setTiltRate = useCallback((tiltRate: number) => {
    const clamped = clampMultiplier(tiltRate);
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, tiltRate: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setClimbRate = useCallback((climbRate: number) => {
    const clamped = clampMultiplier(climbRate);
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
