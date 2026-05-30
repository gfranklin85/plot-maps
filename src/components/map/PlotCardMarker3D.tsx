"use client";

// PlotCardMarker3D — mounts a React HTML element as the content of a
// <gmp-marker> at a lat/lng/altitude inside <gmp-map-3d>. Google projects
// the marker in world space and tracks the camera; our HTML rides along.
//
// CORRECTED 2026-05-30 evening. Earlier version used
// gmp-marker-3d-interactive — wrong primitive. The 3D-suffixed marker
// variants anchor 3D model files (.glb) and do NOT accept HTML children.
// The classic gmp-marker IS the HTML-billboard primitive on gmp-map-3d
// (per Google's "Add HTML markers" doc:
// developers.google.com/maps/documentation/javascript/3d/marker-html-css).
//
// Pattern (per spec):
//   <gmp-map-3d ...>
//     <gmp-marker position="lat,lng,altitude">
//       <div>...your HTML here...</div>
//     </gmp-marker>
//   </gmp-map-3d>
//
// Implementation:
//   1. Create a <gmp-marker> as a child of gmp-map-3d
//   2. Create a host <div> inside the marker
//   3. Portal the React children into that host
//   4. Google's marker handles projection + camera tracking

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

// Google has shipped multiple HTML-marker element names over the lifetime
// of the Maps JS API. On photoreal 3D maps the docs say "gmp-marker"
// works as a child of gmp-map-3d, but the registered tag in the loaded
// libraries may be one of the AdvancedMarker variants instead. We probe
// the registry on mount and use whichever is actually defined, logging
// the winner so the next teammate isn't guessing.
const CANDIDATE_MARKER_TAGS = [
  'gmp-marker',                // docs example for HTML on gmp-map-3d
  'gmp-advanced-marker',       // AdvancedMarkerElement (2D marker, registered by 'marker' library)
] as const;

export default function PlotCardMarker3D({
  mapElRef,
  lat,
  lng,
  altitudeM = 12,
  children,
}: PlotCardMarker3DProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLElement | null>(null);

  // Mount the marker + host div as a child of gmp-map-3d.
  useEffect(() => {
    let retryId: number | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 50;
    let createdMarker: HTMLElement | null = null;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      if (!mapEl) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        }
        return;
      }
      const winnerTag = CANDIDATE_MARKER_TAGS.find(
        (t) => !!window.customElements?.get?.(t)
      );
      if (!winnerTag) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn(
            `[PlotCardMarker3D] No candidate marker element registered: ${CANDIDATE_MARKER_TAGS.join(', ')}`
          );
        }
        return;
      }
      // eslint-disable-next-line no-console
      console.log(`[PlotCardMarker3D] using <${winnerTag}> at ${lat},${lng},${altitudeM}m`);

      const marker = document.createElement(winnerTag);
      // gmp-marker's position attribute is "lat,lng[,altitude]" (string).
      // gmp-advanced-marker also accepts a comma-separated position string.
      marker.setAttribute('position', `${lat},${lng},${altitudeM}`);
      marker.setAttribute('plot-card-billboard', '');

      // Host element — receives the React children via portal. The host
      // is inside the marker so Google tracks its world position.
      const div = document.createElement('div');
      div.setAttribute('data-plot-card-host', '1');
      // Anchor the card's bottom-center at the marker's world point so
      // the property reads first and the card floats above.
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
      m.setAttribute('position', `${lat},${lng},${altitudeM}`);
    } catch { /* ignore */ }
  }, [lat, lng, altitudeM]);

  if (!host) return null;
  return createPortal(children, host);
}
