"use client";

// PlotSummonedMonument — the ONE monument that rises from a selected
// parcel. Summon model: zero monuments at rest, exactly one in the world
// while a parcel is selected. Replaces the old bury-under-every-parcel
// layer (removed 2026-05-31).
//
// The gate is the parcel itself. The page mounts this component only when
// `selectedApn != null` — the server confirmed (via /api/parcels/at-point
// PostGIS ST_Contains) that the click landed INSIDE a real parcel. Street
// / POI / address clicks never set selectedApn, so no monument rises off
// a parcel.
//
// ANIMATION CONTRACT (Greg locked 2026-05-31): the box ONLY rises and
// lowers — it must NEVER just appear or vanish. Three cases:
//   1. Nothing up, select a parcel  → rise from underground.
//   2. Box up, deselect             → sink, then remove.
//   3. Box up, select a DIFFERENT   → sink the current box AT ITS OWN
//      parcel                          anchor, remove it, THEN rise a
//                                       fresh box at the new anchor.
// The element's anchor is frozen for that element's lifetime so a sink
// always plays at the spot the box actually occupies — never teleporting.

import { useEffect, useRef } from "react";
import {
  BURIED_ALT_M,
  RISEN_ALT_M,
  RISE_MS,
  SINK_MS,
  altAt,
} from "@/lib/monumentAnimation";

interface Props {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  /** Monument anchor — the parcel's stored monument_lat/lng (centroid).
   *  Null while nothing is selected. */
  lat: number | null;
  lng: number | null;
  /** True while a parcel is selected. False triggers the sink + removal. */
  active: boolean;
  /** Uniform glb scale. */
  scale?: number;
  src?: string;
}

interface Model3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
  src: string;
  scale?: number | { x: number; y: number; z: number };
}

const MODEL_TAG = "gmp-model-3d-interactive";

export default function PlotSummonedMonument({
  mapElRef,
  lat,
  lng,
  active,
  scale = 1,
  src = "/assets/markers/plot-beam.glb",
}: Props) {
  // The one live box: its element, its FROZEN anchor (so sinks play in
  // place), its current altitude, and the RAF/anim driving it.
  const boxRef = useRef<{
    el: Model3DInteractiveElement;
    anchor: { lat: number; lng: number };
    alt: number;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const animRef = useRef<{ from: number; to: number; startedAt: number; durationMs: number } | null>(null);
  // A box that's sinking on its way out, plus the new anchor (if any) to
  // rise once it's gone. Lets a re-select queue: sink old → rise new.
  const pendingRiseRef = useRef<{ lat: number; lng: number } | null>(null);

  const effectiveScale = (): number => {
    const w = window as unknown as { __plotMonumentScale?: number };
    return typeof w.__plotMonumentScale === "number" ? w.__plotMonumentScale : scale;
  };

  // Create a box element at an anchor, buried, and return the box record.
  const spawn = (anchor: { lat: number; lng: number }): typeof boxRef.current => {
    const mapEl = mapElRef.current;
    const def = window.customElements?.get?.(MODEL_TAG);
    if (!mapEl || !def) return null;
    const el = document.createElement(MODEL_TAG) as Model3DInteractiveElement;
    try { el.altitudeMode = "RELATIVE_TO_GROUND"; } catch { /* noop */ }
    try { el.position = { lat: anchor.lat, lng: anchor.lng, altitude: BURIED_ALT_M }; } catch { /* noop */ }
    try { el.src = src; } catch { /* noop */ }
    try { el.scale = effectiveScale(); } catch { /* noop */ }
    try { el.setAttribute("plot-summoned-monument", ""); } catch { /* noop */ }
    mapEl.appendChild(el);
    return { el, anchor, alt: BURIED_ALT_M };
  };

  // Apply altitude to the live box at its frozen anchor.
  const applyAlt = (alt: number) => {
    const box = boxRef.current;
    if (!box) return;
    box.alt = alt;
    try { box.el.position = { lat: box.anchor.lat, lng: box.anchor.lng, altitude: alt }; } catch { /* noop */ }
  };

  // Drive an animation to `to` over `durationMs`. onDone fires after it
  // lands. Reuses one RAF loop.
  const animateTo = (to: number, durationMs: number, onDone?: () => void) => {
    const box = boxRef.current;
    if (!box) { onDone?.(); return; }
    animRef.current = { from: box.alt, to, startedAt: performance.now(), durationMs };
    const doneCb = onDone;
    const tick = () => {
      const anim = animRef.current;
      const b = boxRef.current;
      if (!anim || !b) { rafRef.current = null; return; }
      const raw = Math.min(1, (performance.now() - anim.startedAt) / anim.durationMs);
      applyAlt(altAt(anim.from, anim.to, raw));
      if (raw >= 1) {
        applyAlt(anim.to); // snap (drops settle overshoot residue)
        animRef.current = null;
        rafRef.current = null;
        doneCb?.();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  };

  // Sink the current box, remove it, then run `after` (e.g. rise a new one).
  const sinkAndRemove = (after?: () => void) => {
    const box = boxRef.current;
    if (!box) { after?.(); return; }
    animateTo(BURIED_ALT_M, SINK_MS, () => {
      try { box.el.remove(); } catch { /* gone */ }
      boxRef.current = null;
      after?.();
    });
  };

  // Rise a fresh box at the given anchor (polls for map/registry readiness).
  const riseAt = (anchor: { lat: number; lng: number }) => {
    let attempts = 0;
    const tryRise = () => {
      attempts += 1;
      const box = spawn(anchor);
      if (!box) {
        if (attempts < 50) window.setTimeout(tryRise, 100);
        return;
      }
      boxRef.current = box;
      animateTo(RISEN_ALT_M, RISE_MS);
    };
    tryRise();
  };

  // Single effect owns the whole rise/sink/handoff logic. Re-runs whenever
  // selection (active) or the target anchor (lat/lng) changes.
  useEffect(() => {
    const wantAnchor = active && lat != null && lng != null ? { lat, lng } : null;
    const box = boxRef.current;

    if (!wantAnchor) {
      // Deselected → sink whatever's up.
      if (box) sinkAndRemove();
      return;
    }

    if (!box) {
      // Nothing up → rise at the new anchor.
      riseAt(wantAnchor);
      return;
    }

    // A box is already up. If it's the SAME anchor, leave it. If it's a
    // DIFFERENT parcel, sink the old one in place, then rise the new one.
    const same =
      Math.abs(box.anchor.lat - wantAnchor.lat) < 1e-9 &&
      Math.abs(box.anchor.lng - wantAnchor.lng) < 1e-9;
    if (same) return;

    pendingRiseRef.current = wantAnchor;
    sinkAndRemove(() => {
      const next = pendingRiseRef.current;
      pendingRiseRef.current = null;
      if (next) riseAt(next);
    });
  }, [active, lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep scale / src live on the current box.
  useEffect(() => {
    const box = boxRef.current;
    if (box) { try { box.el.scale = effectiveScale(); } catch { /* noop */ } }
  }, [scale]);
  useEffect(() => {
    const box = boxRef.current;
    if (box) { try { box.el.src = src; } catch { /* noop */ } }
  }, [src]);

  // Full cleanup on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      animRef.current = null;
      const box = boxRef.current;
      if (box) { try { box.el.remove(); } catch { /* noop */ } }
      boxRef.current = null;
    };
  }, []);

  return null;
}
