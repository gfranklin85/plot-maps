'use client';

import { useCallback, useEffect, useState } from 'react';

// Flight-feel tuning persisted per browser per user. Two independent
// axes:
//
//   speedMultiplier — scales pan + yaw + tilt acceleration. The
//     "horizontal" flight feel: how fast you move across the world,
//     turn, and look around.
//
//   climbRate — scales the LB/RB dolly (descent/ascent). This is NOT
//     a camera zoom — it's the rate at which the eye climbs or
//     descends through the world. Some users want pan to feel fast
//     but descent to feel cinematic + slow (or vice versa).
//
// Three opinionated presets cover the expected range for each axis;
// the sliders let enthusiasts dial them exactly.
//
// localStorage shape:
//   plotmaps.flightTuning = {
//     preset: 'pilot' | 'newcomer' | 'pro' | 'custom',
//     multiplier: 0.6 | 1.0 | 1.6 | <custom>,   // speed
//     climbRate?: 0.6 | 1.0 | 1.6 | <custom>,   // optional for back-compat
//   }
//
// Old saved tunings (multiplier only) still load — climbRate defaults
// to the same value as multiplier on first load if missing.

const STORAGE_KEY = 'plotmaps.flightTuning';

export type FlightPreset = 'newcomer' | 'pilot' | 'pro' | 'custom';

export interface FlightTuning {
  preset: FlightPreset;
  /** Flight speed multiplier — pan (left stick) + tilt (right-Y look).
   *  Yaw is broken out as turnRate. 0.3..2.5 useful range. */
  multiplier: number;
  /** Climb rate multiplier — LT/RT trigger descent/ascent. Independent
   *  of speed so users can have fast pan + cinematic climb. */
  climbRate: number;
  /** Turn rate multiplier — right-X yaw (horizontal rotation) speed.
   *  Independent so users can dial cinematic-slow horizon pans OR
   *  snappy combat-feel turns without affecting pan/tilt feel.
   *  Idle hover wave compensation is unaffected (time-driven, not
   *  multiplier-driven) — protected per Greg's "don't allow tuning
   *  that disrupts designed compensation inputs." */
  turnRate: number;
}

// Preset values. Pilot = 1.0 = the tuning that's been flying as the
// default since the 2D path was tuned. Newcomer is gentle; Pro is
// twitchier for advanced flyers + future dogfight.
export const PRESET_MULTIPLIERS: Record<Exclude<FlightPreset, 'custom'>, number> = {
  newcomer: 0.6,
  pilot:    1.0,
  pro:      1.6,
};

const DEFAULT_TUNING: FlightTuning = { preset: 'pilot', multiplier: 1.0, climbRate: 1.0, turnRate: 1.0 };

function clampMultiplier(n: number): number {
  if (!Number.isFinite(n)) return 1.0;
  // Floor at 0.1× so users can crawl — Greg flagged the previous
  // 0.3× minimum was still "pretty fast" at the new base constants
  // because the underlying world is huge.
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
    const preset: FlightPreset = (parsed.preset === 'newcomer' || parsed.preset === 'pilot' ||
                                  parsed.preset === 'pro' || parsed.preset === 'custom')
      ? parsed.preset : 'pilot';
    const multiplier = clampMultiplier(typeof parsed.multiplier === 'number' ? parsed.multiplier : 1.0);
    // Back-compat: old saved tunings without these fields fall back
    // to the speed multiplier value, preserving the prior single-knob
    // feel until the user touches the new sliders.
    const climbRate = clampMultiplier(
      typeof parsed.climbRate === 'number' ? parsed.climbRate : multiplier,
    );
    const turnRate = clampMultiplier(
      typeof parsed.turnRate === 'number' ? parsed.turnRate : multiplier,
    );
    return { preset, multiplier, climbRate, turnRate };
  } catch {
    return DEFAULT_TUNING;
  }
}

function writeToStorage(t: FlightTuning) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch { /* ignore quota / private-mode failures */ }
}

/**
 * Flight tuning hook. Returns the current speed multiplier + climb
 * rate + preset, plus mutators. Use the multiplier to scale pan/yaw/
 * tilt accel; use climbRate to scale the LB/RB dolly speed.
 */
export function useFlightTuning() {
  // Lazy initial — SSR sees default; effect re-reads from storage on mount.
  const [tuning, setTuningState] = useState<FlightTuning>(DEFAULT_TUNING);

  useEffect(() => {
    setTuningState(readFromStorage());
  }, []);

  const setPreset = useCallback((preset: FlightPreset) => {
    const next: FlightTuning = preset === 'custom'
      ? { preset, multiplier: tuning.multiplier, climbRate: tuning.climbRate, turnRate: tuning.turnRate }
      : { preset, multiplier: PRESET_MULTIPLIERS[preset], climbRate: PRESET_MULTIPLIERS[preset], turnRate: PRESET_MULTIPLIERS[preset] };
    setTuningState(next);
    writeToStorage(next);
  }, [tuning.multiplier, tuning.climbRate, tuning.turnRate]);

  const setMultiplier = useCallback((multiplier: number) => {
    const clamped = clampMultiplier(multiplier);
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, preset: 'custom', multiplier: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setClimbRate = useCallback((climbRate: number) => {
    const clamped = clampMultiplier(climbRate);
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, preset: 'custom', climbRate: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const setTurnRate = useCallback((turnRate: number) => {
    const clamped = clampMultiplier(turnRate);
    setTuningState(prev => {
      const next: FlightTuning = { ...prev, preset: 'custom', turnRate: clamped };
      writeToStorage(next);
      return next;
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setTuningState(DEFAULT_TUNING);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { tuning, setPreset, setMultiplier, setClimbRate, setTurnRate, resetToDefault };
}
