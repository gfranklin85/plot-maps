'use client';

// useCameraChoreographer
// ------------------------------------------------------------------
// Smoothly animates a Google Maps camera between states using
// requestAnimationFrame + interpolation. Replaces hard snaps
// (setCenter / setZoom / setTilt / setHeading) with eased transitions
// across all four axes concurrently.
//
// Zero billing impact — we're animating between states the user would
// have ended up at anyway. Just nicer to watch.
//
// Usage:
//   const flyTo = useCameraChoreographer();
//   flyTo({ center: { lat, lng }, zoom: 19, tilt: 60, duration: 900 });
//
// Cancellation: starting a new flyTo cancels any in-flight animation.
// User input (drag/zoom) does NOT auto-cancel — wrap with onIdle if
// you want that behavior at the call site.

import { useCallback, useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

export type Easing =
  | 'linear'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeOutQuint'
  | 'easeInOutQuint';

const EASINGS: Record<Easing, (t: number) => number> = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: (t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
};

export interface FlyToOptions {
  center?: { lat: number; lng: number };
  zoom?: number;
  tilt?: number;
  heading?: number;
  duration?: number;     // ms, default 800
  easing?: Easing;       // default easeInOutCubic
  onComplete?: () => void;
}

interface AnimationState {
  rafId: number | null;
  onCancel?: () => void;
}

// Heading interpolation has to take the short way around the circle
// (e.g. 350° → 10° goes via 360, not the long way through 180).
function lerpHeading(from: number, to: number, t: number): number {
  const diff = ((to - from) % 360 + 540) % 360 - 180;
  return (from + diff * t + 360) % 360;
}

export function useCameraChoreographer() {
  const map = useMap();
  const stateRef = useRef<AnimationState>({ rafId: null });

  // Cancel any running animation on unmount so we don't leak frames.
  useEffect(() => {
    const state = stateRef.current;
    return () => {
      if (state.rafId !== null) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
    };
  }, []);

  const cancel = useCallback(() => {
    if (stateRef.current.rafId !== null) {
      cancelAnimationFrame(stateRef.current.rafId);
      stateRef.current.rafId = null;
      stateRef.current.onCancel?.();
    }
  }, []);

  const flyTo = useCallback((opts: FlyToOptions) => {
    if (!map) return;
    cancel();

    const duration = opts.duration ?? 800;
    const ease = EASINGS[opts.easing ?? 'easeInOutCubic'];

    // Snapshot the current camera state once. Snapping immediately is OK if
    // any axis is undefined (we just don't animate it).
    const startCenter = map.getCenter();
    const startZoom = map.getZoom() ?? 0;
    const startTilt = map.getTilt() ?? 0;
    const startHeading = map.getHeading() ?? 0;

    const startLat = startCenter?.lat() ?? 0;
    const startLng = startCenter?.lng() ?? 0;

    const targetLat = opts.center?.lat ?? startLat;
    const targetLng = opts.center?.lng ?? startLng;
    const targetZoom = opts.zoom ?? startZoom;
    const targetTilt = opts.tilt ?? startTilt;
    const targetHeading = opts.heading ?? startHeading;

    // Skip the animation entirely if duration is 0 or no axis would change
    const noChange =
      Math.abs(targetLat - startLat) < 1e-9 &&
      Math.abs(targetLng - startLng) < 1e-9 &&
      Math.abs(targetZoom - startZoom) < 1e-3 &&
      Math.abs(targetTilt - startTilt) < 1e-3 &&
      Math.abs(targetHeading - startHeading) < 1e-3;
    if (duration <= 0 || noChange) {
      if (opts.center) map.setCenter(opts.center);
      if (opts.zoom != null) map.setZoom(opts.zoom);
      if (opts.tilt != null) map.setTilt(opts.tilt);
      if (opts.heading != null) map.setHeading(opts.heading);
      opts.onComplete?.();
      return;
    }

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const raw = Math.min(1, elapsed / duration);
      const t = ease(raw);

      const lat = startLat + (targetLat - startLat) * t;
      const lng = startLng + (targetLng - startLng) * t;
      const zoom = startZoom + (targetZoom - startZoom) * t;
      const tilt = startTilt + (targetTilt - startTilt) * t;
      const heading = lerpHeading(startHeading, targetHeading, t);

      map.setCenter({ lat, lng });
      map.setZoom(zoom);
      map.setTilt(tilt);
      map.setHeading(heading);

      if (raw < 1) {
        stateRef.current.rafId = requestAnimationFrame(tick);
      } else {
        stateRef.current.rafId = null;
        opts.onComplete?.();
      }
    };

    stateRef.current.rafId = requestAnimationFrame(tick);
  }, [map, cancel]);

  return { flyTo, cancel };
}
