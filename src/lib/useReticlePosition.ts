'use client';

import { useCallback, useEffect, useState } from 'react';

// localStorage key. Per-browser-per-profile is fine for v1; we can move
// this to the profiles table later if cross-device sync becomes a need.
const STORAGE_KEY = 'plotmaps.reticlePosition';

// Default position. Y=0.42 matches the previous tilt-aware focal-point
// placement so the default visual position is unchanged from before
// drag-to-place existed.
const DEFAULT_X = 0.5;
const DEFAULT_Y = 0.42;

export interface ReticlePosition {
  xFraction: number;
  yFraction: number;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  if (n < 0.05) return 0.05;
  if (n > 0.95) return 0.95;
  return n;
}

function readFromStorage(): ReticlePosition {
  if (typeof window === 'undefined') return { xFraction: DEFAULT_X, yFraction: DEFAULT_Y };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { xFraction: DEFAULT_X, yFraction: DEFAULT_Y };
    const parsed = JSON.parse(raw) as Partial<ReticlePosition>;
    return {
      xFraction: clamp01(typeof parsed.xFraction === 'number' ? parsed.xFraction : DEFAULT_X),
      yFraction: clamp01(typeof parsed.yFraction === 'number' ? parsed.yFraction : DEFAULT_Y),
    };
  } catch {
    return { xFraction: DEFAULT_X, yFraction: DEFAULT_Y };
  }
}

/**
 * Drag-to-place position for the airplane-mode reticle. Stored in
 * localStorage as a 0..1 viewport fraction so it survives window
 * resize. Drag the reticle to move it; double-click resets to default.
 */
export function useReticlePosition() {
  // Lazy initial state so SSR doesn't read localStorage during render.
  // SSR-pass uses the default; the effect below syncs to storage on
  // mount. The reticle isn't visible on the server anyway, so the
  // single-frame mismatch is invisible.
  const [position, setPositionState] = useState<ReticlePosition>({ xFraction: DEFAULT_X, yFraction: DEFAULT_Y });

  useEffect(() => {
    setPositionState(readFromStorage());
  }, []);

  const setPosition = useCallback((next: ReticlePosition) => {
    const clamped: ReticlePosition = {
      xFraction: clamp01(next.xFraction),
      yFraction: clamp01(next.yFraction),
    };
    setPositionState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    } catch { /* ignore quota / private-mode failures */ }
  }, []);

  const resetPosition = useCallback(() => {
    setPositionState({ xFraction: DEFAULT_X, yFraction: DEFAULT_Y });
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  return { position, setPosition, resetPosition };
}

export const RETICLE_DEFAULT_POSITION: ReticlePosition = {
  xFraction: DEFAULT_X,
  yFraction: DEFAULT_Y,
};
