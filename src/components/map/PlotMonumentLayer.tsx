"use client";

// PlotMonumentLayer — every parcel in the camera radius has its monument
// pre-mounted in the world, BURIED beneath the surface (altitudeM = -30m).
// Selection rises that parcel's monument to ground level with a heavy
// ease-out + slight settle bounce. Dismiss reverses the animation.
//
// Greg locked 2026-05-30 evening: "each place has its hidden huge slab
// monument below ready to rise." The monument is a property OF the parcel
// (data, not spawned at click). The world is always populated; selection
// just lifts the curtain.
//
// The monument lat/lng is the parcel's pre-computed BACKYARD ANCHOR
// (see properties-monument-anchor-migration.sql) — centroid offset 40%
// toward the longest exterior-ring edge midpoint, clamped to the polygon
// interior. So each parcel's monument lives in roughly the back third
// of its own lot.

import { useEffect, useRef } from "react";

interface Monument {
  apn: string;
  lat: number;
  lng: number;
}

interface Props {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  monuments: Monument[];
  /** APN of the currently-selected parcel, if any. That monument rises;
   *  every other monument stays buried. */
  selectedApn: string | null;
  /** Uniform scale applied to every mounted monument glb. */
  scale?: number;
  src?: string;
}

interface Model3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
  src: string;
  scale?: number | { x: number; y: number; z: number };
  orientation?: { heading?: number; tilt?: number; roll?: number };
}

const MODEL_TAG = 'gmp-model-3d-interactive';

// Altitude in meters. Buried far below ground at rest — invisible
// to the camera at every angle. Only the SELECTED parcel's monument
// rises to ground level on call. World stays unmarked at rest;
// selection lifts the curtain. Greg locked 2026-05-30 evening.
const BURIED_ALT_M = -30;
const RISEN_ALT_M = 0;
// Rise/sink durations
const RISE_MS = 850;
const SINK_MS = 550;

// Heavy ease-out — the monument decelerates sharply at the top, with a
// 5% overshoot + settle so it feels like a heavy object coming to rest,
// not a tween. Curve: ease-out cubic, then a small spring-back pass.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Spring-style overshoot: at t=1, value = 1.05, then settles back to 1.0.
function easeOutWithSettle(t: number): number {
  if (t < 0.85) {
    const local = t / 0.85;
    return easeOutCubic(local) * 1.05;
  }
  const local = (t - 0.85) / 0.15;
  // Decay from 1.05 → 1.00
  return 1.05 - 0.05 * easeOutCubic(local);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export default function PlotMonumentLayer({
  mapElRef,
  monuments,
  selectedApn,
  scale = 1,
  src = '/assets/markers/plot-beam.glb',
}: Props) {
  // One DOM element + one animation-state per APN, indexed by APN.
  const modelsRef = useRef<Map<string, Model3DInteractiveElement>>(new Map());
  const animStateRef = useRef<Map<string, { startedAt: number; from: number; to: number; durationMs: number }>>(new Map());
  const rafRef = useRef<number | null>(null);

  // Mount / unmount monuments as the viewport set changes.
  //
  // Refs aren't reactive — if mapElRef.current is null on first run we
  // can't just bail and wait for a re-render; the effect won't fire
  // again until `monuments` changes (which may never happen if the
  // bbox fetch resolved before the map mounted). Same for the custom-
  // elements registry. So poll the readiness conditions from inside
  // the effect with a setTimeout retry, matching PlotPropertyBeam.
  useEffect(() => {
    let retryId: number | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 50;
    let cancelled = false;

    const sync = () => {
      if (cancelled) return;
      attempt += 1;
      const mapEl = mapElRef.current;
      const def = window.customElements?.get?.(MODEL_TAG);
      if (!mapEl || !def) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(sync, 100);
        } else {
          console.warn('[monument] gave up after', attempt, 'attempts: mapEl=', !!mapEl, 'def=', !!def);
        }
        return;
      }

      const currentApns = new Set(monuments.map(m => m.apn));
      const mounted = modelsRef.current;

      // Remove monuments that left the viewport
      const apnsToRemove: string[] = [];
      mounted.forEach((_, apn) => { if (!currentApns.has(apn)) apnsToRemove.push(apn); });
      apnsToRemove.forEach(apn => {
        const el = mounted.get(apn);
        if (el) { try { el.remove(); } catch { /* already gone */ } }
        mounted.delete(apn);
        animStateRef.current.delete(apn);
      });

      // Mount monuments that entered the viewport
      let mountedCount = 0;
      for (const m of monuments) {
        if (mounted.has(m.apn)) continue;
        const el = document.createElement(MODEL_TAG) as Model3DInteractiveElement;
        try { el.altitudeMode = 'RELATIVE_TO_GROUND'; } catch { /* noop */ }
        try { el.position = { lat: m.lat, lng: m.lng, altitude: BURIED_ALT_M }; } catch { /* noop */ }
        try { el.src = src; } catch { /* noop */ }
        try { el.scale = scale; } catch { /* noop */ }
        try { el.setAttribute('plot-monument', m.apn); } catch { /* noop */ }
        mapEl.appendChild(el);
        mounted.set(m.apn, el);
        mountedCount += 1;
      }
      console.log(
        '[monument] viewport sync:',
        'incoming=', monuments.length,
        'newly_mounted=', mountedCount,
        'removed=', apnsToRemove.length,
        'total_mounted=', mounted.size,
        'attempt=', attempt,
      );
    };

    sync();

    return () => {
      cancelled = true;
      if (retryId !== null) window.clearTimeout(retryId);
    };
  }, [monuments, mapElRef, src, scale]);

  // Update positions on any existing monument when its lat/lng changes
  useEffect(() => {
    const mounted = modelsRef.current;
    for (const m of monuments) {
      const el = mounted.get(m.apn);
      if (!el) continue;
      try {
        const altitude = el.position?.altitude ?? BURIED_ALT_M;
        el.position = { lat: m.lat, lng: m.lng, altitude };
      } catch { /* noop */ }
    }
  }, [monuments]);

  // Selection → trigger rise/sink animations
  useEffect(() => {
    const mounted = modelsRef.current;
    const now = performance.now();
    const hasMatch = selectedApn ? mounted.has(selectedApn) : null;
    console.log(
      '[monument] selection effect: selectedApn=', selectedApn,
      'mounted_total=', mounted.size,
      'selected_is_mounted=', hasMatch,
    );

    mounted.forEach((el, apn) => {
      const isSelected = apn === selectedApn;
      const currentAlt = el.position?.altitude ?? BURIED_ALT_M;
      const targetAlt = isSelected ? RISEN_ALT_M : BURIED_ALT_M;

      // Skip if already at target and not animating
      if (currentAlt === targetAlt && !animStateRef.current.has(apn)) return;

      // Skip if already animating toward this target
      const existing = animStateRef.current.get(apn);
      if (existing && existing.to === targetAlt) return;

      console.log(
        '[monument] scheduling anim:', apn,
        'from=', currentAlt, 'to=', targetAlt,
        'isSelected=', isSelected,
      );

      animStateRef.current.set(apn, {
        startedAt: now,
        from: currentAlt,
        to: targetAlt,
        durationMs: isSelected ? RISE_MS : SINK_MS,
      });
    });

    // Kick the RAF loop if not already running
    if (rafRef.current === null && animStateRef.current.size > 0) {
      const tick = () => {
        const t = performance.now();
        const mountedNow = modelsRef.current;
        const anims = animStateRef.current;
        let stillAnimating = false;

        const finished: string[] = [];
        anims.forEach((anim, apn) => {
          const el = mountedNow.get(apn);
          if (!el) { finished.push(apn); return; }
          const elapsed = t - anim.startedAt;
          const raw = Math.min(1, elapsed / anim.durationMs);
          const isRising = anim.to > anim.from;
          // Rising uses settle curve (overshoot + decay); sinking uses
          // ease-in (gathering speed downward, no overshoot).
          const eased = isRising ? easeOutWithSettle(raw) : easeInCubic(raw);
          const alt = anim.from + (anim.to - anim.from) * eased;
          try {
            const cur = el.position;
            if (cur) el.position = { lat: cur.lat, lng: cur.lng, altitude: alt };
          } catch { /* noop */ }
          if (raw >= 1) {
            // Snap to target so we don't carry the 5% overshoot rounding
            try {
              const cur = el.position;
              if (cur) el.position = { lat: cur.lat, lng: cur.lng, altitude: anim.to };
            } catch { /* noop */ }
            finished.push(apn);
          } else {
            stillAnimating = true;
          }
        });
        finished.forEach(apn => anims.delete(apn));

        if (stillAnimating) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [selectedApn, monuments]);

  // Cleanup all monuments + RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      modelsRef.current.forEach(el => { try { el.remove(); } catch { /* noop */ } });
      modelsRef.current.clear();
      animStateRef.current.clear();
    };
  }, []);

  return null;
}
