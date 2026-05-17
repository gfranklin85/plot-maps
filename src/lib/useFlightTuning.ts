'use client';

import { useCallback, useEffect, useState } from 'react';

// Flight-feel tuning persisted per browser per user. Single master
// multiplier scales pan + yaw + tilt + dolly velocity together so
// users can dial overall responsiveness from "cautious sightseeing"
// to "race over the city." Three opinionated presets cover the
// expected range; the slider lets enthusiasts dial it exactly.
//
// localStorage shape:
//   plotmaps.flightTuning = { preset: 'pilot' | 'newcomer' | 'pro' | 'custom',
//                             multiplier: 0.6 | 1.0 | 1.6 | <custom> }
//
// The map page + gamepad controller multiply their per-axis
// acceleration / max-velocity constants by this multiplier each
// frame. The shape of the flight feel (cubic stick, drag, glide-to-
// stop) stays constant; only the *speed* scales.

const STORAGE_KEY = 'plotmaps.flightTuning';

export type FlightPreset = 'newcomer' | 'pilot' | 'pro' | 'custom';

export interface FlightTuning {
  preset: FlightPreset;
  multiplier: number;  // 0.3..2.5 useful range; soft-clamped on read
}

// Preset values. Pilot = 1.0 = the existing tuning that's been
// flying as the default since the 2D path was tuned. Newcomer is
// gentle; Pro is twitchier for advanced flyers + future dogfight.
export const PRESET_MULTIPLIERS: Record<Exclude<FlightPreset, 'custom'>, number> = {
  newcomer: 0.6,
  pilot:    1.0,
  pro:      1.6,
};

const DEFAULT_TUNING: FlightTuning = { preset: 'pilot', multiplier: 1.0 };

function clampMultiplier(n: number): number {
  if (!Number.isFinite(n)) return 1.0;
  if (n < 0.3) return 0.3;
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
    return { preset, multiplier };
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
 * Flight tuning hook. Returns the current master multiplier + preset
 * plus mutators. Use the multiplier to scale velocity / accel
 * constants in flight code.
 */
export function useFlightTuning() {
  // Lazy initial — SSR sees default; effect re-reads from storage on mount.
  const [tuning, setTuningState] = useState<FlightTuning>(DEFAULT_TUNING);

  useEffect(() => {
    setTuningState(readFromStorage());
  }, []);

  const setPreset = useCallback((preset: FlightPreset) => {
    const next: FlightTuning = preset === 'custom'
      ? { preset, multiplier: tuning.multiplier }
      : { preset, multiplier: PRESET_MULTIPLIERS[preset] };
    setTuningState(next);
    writeToStorage(next);
  }, [tuning.multiplier]);

  const setMultiplier = useCallback((multiplier: number) => {
    const clamped = clampMultiplier(multiplier);
    // Moving the slider auto-flips preset to 'custom' unless the
    // value exactly matches a preset.
    let preset: FlightPreset = 'custom';
    for (const [name, value] of Object.entries(PRESET_MULTIPLIERS)) {
      if (Math.abs(value - clamped) < 0.01) {
        preset = name as FlightPreset;
        break;
      }
    }
    const next: FlightTuning = { preset, multiplier: clamped };
    setTuningState(next);
    writeToStorage(next);
  }, []);

  const resetToDefault = useCallback(() => {
    setTuningState(DEFAULT_TUNING);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { tuning, setPreset, setMultiplier, resetToDefault };
}
