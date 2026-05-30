"use client";

// PlotPropertyBeam — the cone-shaped projector emitter + card slab
// rendered IN the photoreal 3D world at the selected property's lat/lng.
// Locked 2026-05-30 evening per the in-world-stack spec.
//
// Visual: translucent emissive blue beam dispersion topped by a solid
// white card slab. Built in Blender, exported to
// public/assets/markers/plot-beam.glb.
//
// Mount: gmp-model-3d-interactive, RELATIVE_TO_GROUND, at the property's
// lat/lng. Google handles projection, depth, occlusion, camera tracking.
//
// 2026-05-30 evening update: added scale + orientation props because
// the initial deploy showed the glb rendering tiny and lying flat. The
// glTF Y-up conversion at export time can rotate the model unexpectedly
// and Google's gmp-model-3d-interactive defaults scale to 1, which is
// often too small for world-context visibility.

import { useEffect, useRef } from "react";

interface Orientation {
  /** Compass bearing the model faces (0 = north, 90 = east). */
  heading?: number;
  /** Forward/backward lean in degrees. */
  tilt?: number;
  /** Roll about the model's forward axis. */
  roll?: number;
}

interface Props {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Meters above ground for the model's origin point. Default 0
   *  (sits on the roof). The model itself extends upward in its
   *  local +Z from this point. */
  altitudeM?: number;
  /** Uniform scale multiplier. Default 1 (use model's exported units).
   *  Bump to 5-15 if the model is appearing tiny on the photoreal map. */
  scale?: number;
  /** heading/tilt/roll override in degrees. Default 0 on all axes
   *  (model faces north, stands upright, no roll). */
  orientation?: Orientation;
  /** Path to the .glb asset. */
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

export default function PlotPropertyBeam({
  mapElRef,
  lat,
  lng,
  altitudeM = 0,
  scale = 1,
  orientation = { heading: 0, tilt: 0, roll: 0 },
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
      try { m.scale = scale; } catch { /* ignore */ }
      try { m.orientation = orientation; } catch { /* ignore */ }
      try { m.setAttribute('plot-property-beam', ''); } catch { /* ignore */ }
      // eslint-disable-next-line no-console
      console.log(`[PlotPropertyBeam] mounted at ${lat},${lng},${altitudeM}m scale=${scale}`);

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

  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try { m.scale = scale; } catch { /* ignore */ }
  }, [scale]);

  useEffect(() => {
    const m = modelRef.current;
    if (!m) return;
    try { m.orientation = orientation; } catch { /* ignore */ }
  }, [orientation]);

  return null;
}
