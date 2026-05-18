'use client';

import { useCallback, useEffect, useState } from 'react';

// ── POI visibility preference ───────────────────────────────────────
//
// Google's POI labels + business icons (Starbucks, gas stations,
// schools, hospitals, etc.) are Google's product surface, not ours.
// On a flight surface they read as noise against the "world is the
// canvas" framing.
//
// This hook persists a simple boolean preference per browser. The
// default is HIDDEN — clean immersive map. User can flip on if they
// need to see businesses for prospecting context.
//
// Future granular control (per-family toggles: business / school /
// medical / etc.) lives in Greg's layer-control thinking; this is
// the simple v1 that gets the noise off the screen now.

const STORAGE_KEY = 'plotmaps.poiVisible';

function readFromStorage(): boolean {
  if (typeof window === 'undefined') return false;  // default hidden
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    return raw === 'true';
  } catch {
    return false;
  }
}

function writeToStorage(visible: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, visible ? 'true' : 'false');
  } catch { /* ignore */ }
}

export function usePoiVisibility() {
  const [poisVisible, setPoisVisibleState] = useState<boolean>(false);

  useEffect(() => {
    setPoisVisibleState(readFromStorage());
  }, []);

  const togglePois = useCallback(() => {
    setPoisVisibleState(prev => {
      const next = !prev;
      writeToStorage(next);
      return next;
    });
  }, []);

  const setPoisVisible = useCallback((visible: boolean) => {
    setPoisVisibleState(visible);
    writeToStorage(visible);
  }, []);

  return { poisVisible, togglePois, setPoisVisible };
}
