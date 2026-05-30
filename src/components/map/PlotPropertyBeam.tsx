"use client";

// PlotPropertyBeam — the cone-shaped projector emitter rendered IN the
// photoreal 3D world at the selected property's lat/lng. Locked
// 2026-05-30 evening per the in-world-stack spec.
//
// Visual: a translucent emissive blue cone that spreads outward and
// upward from a small emitter base on the roof, reaching the card
// anchor altitude. Built in Blender (.glb) NOT in JS — a single-color
// polyline filament can't render the volumetric / particle-wisp feel.
// Same pipeline as plot-pin.glb (PlotPinMarker).
//
// Mount: gmp-model-3d-interactive, RELATIVE_TO_GROUND, at the property's
// lat/lng. Google handles projection, depth, occlusion, camera tracking.
// No screen-space math.
//
// The .glb at /assets/markers/plot-beam.glb is the canonical asset.
// Until the file exists, this component mounts the marker but the model
// just won't render — no crash, no fallback geometry (consistent with
// PlotPropertyHighlight's "no fabricated footprint" rule).

import { useEffect, useRef } from "react";

interface Props {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Meters above ground for the emitter base (typically the roof).
   *  The cone's height comes from the .glb itself. Default 4m. */
  altitudeM?: number;
  /** Path to the .glb cone-emitter asset. */
  src?: string;
}

interface Model3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
  src: string;
}

const MODEL_TAG = 'gmp-model-3d-interactive';

export default function PlotPropertyBeam({
  mapElRef,
  lat,
  lng,
  altitudeM = 4,
  src = '/assets/markers/plot-beam.glb',
}: Props) {
  const modelRef = useRef<Model3DInteractiveElement | null>(null);

  useEffect(() => {
    let retryId: number | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 50;
    let createdModel: Model3DInteractiveElement | null = null;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      if (!mapEl) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        }
        return;
      }
      const def = window.customElements?.get?.(MODEL_TAG);
      if (!def) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`[PlotPropertyBeam] ${MODEL_TAG} not registered after retries.`);
        }
        return;
      }

      const m = document.createElement(MODEL_TAG) as Model3DInteractiveElement;
      try { m.altitudeMode = 'RELATIVE_TO_GROUND'; } catch { /* ignore */ }
      try { m.position = { lat, lng, altitude: altitudeM }; } catch { /* ignore */ }
      try { m.src = src; } catch { /* ignore */ }
      try { m.setAttribute('plot-property-beam', ''); } catch { /* ignore */ }

      mapEl.appendChild(m);
      createdModel = m;
      modelRef.current = m;
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (createdModel) {
        try { createdModel.remove(); } catch { /* already gone */ }
      }
      modelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try { m.position = { lat, lng, altitude: altitudeM }; } catch { /* ignore */ }
  }, [lat, lng, altitudeM]);

  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try { m.src = src; } catch { /* ignore */ }
  }, [src]);

  return null;
}
