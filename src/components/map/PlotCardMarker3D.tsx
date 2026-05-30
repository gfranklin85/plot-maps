"use client";

// PlotCardMarker3D — mounts a React HTML billboard as the content of
// a gmp-marker-3d-interactive at lat/lng/altitude in world space.
//
// Locked 2026-05-30 evening. Replaces AnchoredPropertyCard's manual
// screen-space projection (which was silently falling back to top-center
// because the polled camera state from gmp-map-3d wasn't matching the
// projection math's expectations).
//
// Google's gmp-marker-3d-interactive accepts arbitrary HTML children
// via its <slot>. The browser places that HTML at the marker's world
// position, with Google handling projection, depth, occlusion, and
// camera tracking internally. No screen-space math. No fallback path.
// This is the same primitive family we already use for the 3D Plot pin
// (PlotPinMarker via gmp-model-3d-interactive).
//
// Implementation:
//   1. Create a gmp-marker-3d-interactive at lat/lng/altitudeM
//   2. Create a host <div> inside it
//   3. Portal the React children into that host
//   4. Google projects the marker each frame; the HTML rides along

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PlotCardMarker3DProps {
  /** Map element ref (gmp-map-3d host). */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Meters above ground. The card floats over the building. */
  altitudeM?: number;
  children: ReactNode;
}

interface Marker3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
}

const MARKER_TAG = 'gmp-marker-3d-interactive';

export default function PlotCardMarker3D({
  mapElRef,
  lat,
  lng,
  altitudeM = 12,
  children,
}: PlotCardMarker3DProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const markerRef = useRef<Marker3DInteractiveElement | null>(null);

  // Mount the marker + host div as a child of gmp-map-3d.
  useEffect(() => {
    let retryId: number | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 50;
    let createdMarker: Marker3DInteractiveElement | null = null;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      if (!mapEl) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        }
        return;
      }
      const def = window.customElements?.get?.(MARKER_TAG);
      if (!def) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn('[PlotCardMarker3D] gmp-marker-3d-interactive not registered after retries.');
        }
        return;
      }

      const marker = document.createElement(MARKER_TAG) as Marker3DInteractiveElement;
      try { marker.altitudeMode = 'RELATIVE_TO_GROUND'; } catch { /* ignore */ }
      try { marker.position = { lat, lng, altitude: altitudeM }; } catch { /* ignore */ }
      try { marker.setAttribute('plot-card-billboard', ''); } catch { /* ignore */ }

      // Host element — receives the React children via portal. Sits
      // inside the marker so Google tracks its world position.
      const div = document.createElement('div');
      div.setAttribute('data-plot-card-host', '1');
      // The marker positions its origin at the world point; we want the
      // card to sit ABOVE that point (so the property reads first, card
      // floats above). The host applies a CSS transform so the card's
      // bottom anchors at the marker's world position.
      div.style.position = 'relative';
      div.style.transform = 'translate(-50%, -100%)';
      div.style.pointerEvents = 'auto';

      marker.appendChild(div);
      mapEl.appendChild(marker);

      createdMarker = marker;
      markerRef.current = marker;
      setHost(div);
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (createdMarker) {
        try { createdMarker.remove(); } catch { /* already gone */ }
      }
      markerRef.current = null;
      setHost(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng/altitude change without remount.
  useEffect(() => {
    const m = markerRef.current;
    if (!m) return;
    try {
      m.position = { lat, lng, altitude: altitudeM };
    } catch { /* ignore */ }
  }, [lat, lng, altitudeM]);

  if (!host) return null;
  return createPortal(children, host);
}
