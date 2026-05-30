"use client";

import { useEffect, useState } from "react";

// PlotPinMarker — the Plot 3D pin asset rendered IN the photoreal
// world at a property's lat/lng.
//
// Locked 2026-05-30 evening. Replaces the screen-space projection
// approach (which fought Google's chrome and projection math for
// 3 days) with the cathedral move: a real 3D model anchored in
// world space via Google's gmp-model-3d-interactive primitive.
// The model is the Plot pin (mint emissive node on a charcoal
// surveyor's stake — see public/assets/markers/plot-pin.glb).
//
// gmp-model-3d-interactive is Google's official primitive for
// custom 3D models anchored at lat/lng/altitude with click handling.
// Google handles all projection, depth, occlusion, and camera
// tracking internally. No screen-space math, no chrome to fight.
//
// Click events fire gmp-click on the model — our handler receives
// the click and opens the property popup card. The card itself
// stays as a React glass component for now (separate concern); a
// later pass may make the card a 3D model too.
//
// Behavior:
//   - Mounts <gmp-model-3d-interactive> at lat/lng/altitudeM as a
//     child of gmp-map-3d. Google handles the rest.
//   - src points at /assets/markers/plot-pin.glb (a .glb file produced
//     by Blender — the mint-emissive surveyor stake).
//   - onClick fires when the user clicks the pin in the 3D world.
//   - Updates position when lat/lng/altitudeM change without remount.
//   - Cleans up on unmount.

interface PlotPinMarkerProps {
  /** Map element ref (gmp-map-3d host). */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Altitude above ground in meters. The pin's origin is at the
   *  bottom of its spike, so altitudeM=0 plants the spike on the
   *  ground and the node sits ~4m above. */
  altitudeM?: number;
  /** Path to the .glb asset. Defaults to the canonical Plot pin. */
  src?: string;
  /** Click handler — fires when the user clicks the pin in 3D space. */
  onClick?: () => void;
}

interface Model3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
  src: string;
}

const MODEL_TAG = 'gmp-model-3d-interactive';

export default function PlotPinMarker({
  mapElRef,
  lat,
  lng,
  altitudeM = 0,
  src = '/assets/markers/plot-pin.glb',
  onClick,
}: PlotPinMarkerProps) {
  const [model, setModel] = useState<Model3DInteractiveElement | null>(null);

  // Mount the model element as a child of gmp-map-3d.
  useEffect(() => {
    let retryId: number | null = null;
    const MAX_ATTEMPTS = 50;
    let attempt = 0;
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
          console.warn(
            '[PlotPinMarker] gmp-model-3d-interactive not registered after retries. Pin will not appear.'
          );
        }
        return;
      }

      const m = document.createElement(MODEL_TAG) as Model3DInteractiveElement;
      try { m.altitudeMode = 'RELATIVE_TO_GROUND'; } catch { /* ignore */ }
      try { m.position = { lat, lng, altitude: altitudeM }; } catch { /* ignore */ }
      try { m.src = src; } catch { /* ignore */ }
      try { m.setAttribute('plot-property-pin', ''); } catch { /* ignore */ }

      mapEl.appendChild(m);
      createdModel = m;
      setModel(m);
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (createdModel) {
        try { createdModel.remove(); } catch { /* already gone */ }
      }
      setModel(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update model position when lat/lng/altitude change.
  useEffect(() => {
    if (!model) return;
    try {
      model.position = { lat, lng, altitude: altitudeM };
    } catch { /* ignore */ }
  }, [model, lat, lng, altitudeM]);

  // Update src if it changes (rare — e.g. status pin variants).
  useEffect(() => {
    if (!model) return;
    try { model.src = src; } catch { /* ignore */ }
  }, [model, src]);

  // Wire the click handler. gmp-model-3d-interactive dispatches
  // gmp-click when the user clicks the model in 3D space.
  useEffect(() => {
    if (!model || !onClick) return;
    const handler = (e: Event) => {
      try { (e as Event & { stop?: () => void }).stop?.(); } catch { /* ignore */ }
      onClick();
    };
    model.addEventListener('gmp-click', handler);
    return () => {
      model.removeEventListener('gmp-click', handler);
    };
  }, [model, onClick]);

  return null;
}
