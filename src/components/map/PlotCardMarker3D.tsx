"use client";

// PlotCardMarker3D — mounts a React HTML element as the content of a
// <gmp-marker> at a lat/lng/altitude inside <gmp-map-3d>.
//
// 2026-05-30 evening — simplified to a STATIC anchored card with NO
// rise animation and NO clipping wrapper. The animation work was
// removed because the previous wrapper broke the card's interaction
// model (B-press opened OS context menu, contents looked wrong).
// This version is the diagnostic for the far-side-anchor approach:
// we mount the card at a coordinate that's behind the property from
// the camera's POV and verify whether Google's photoreal building
// mesh Z-occludes the card's bottom in screen space.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PlotCardMarker3DProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  altitudeM?: number;
  children: ReactNode;
}

const CANDIDATE_MARKER_TAGS = [
  'gmp-marker',
  'gmp-advanced-marker',
] as const;

export default function PlotCardMarker3D({
  mapElRef,
  lat,
  lng,
  altitudeM = 0,
  children,
}: PlotCardMarker3DProps) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const markerRef = useRef<HTMLElement | null>(null);

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

      const marker = document.createElement(winnerTag) as HTMLElement & {
        position?: unknown;
      };
      try {
        (marker as HTMLElement & { position?: unknown }).position = {
          lat,
          lng,
          altitude: altitudeM,
        };
      } catch {
        try {
          marker.setAttribute('position', `${lat},${lng},${altitudeM}`);
        } catch { /* ignore */ }
      }
      marker.setAttribute('plot-card-billboard', '');

      // Host element for the React portal. No clipping, no transform,
      // no overflow tricks. Children render at their natural size and
      // Google places this whole element at the projected lat/lng pixel.
      const div = document.createElement('div');
      div.setAttribute('data-plot-card-host', '1');
      div.style.pointerEvents = 'auto';

      marker.appendChild(div);
      mapEl.appendChild(marker);

      createdMarker = marker;
      markerRef.current = marker;
      setHost(div);

      // eslint-disable-next-line no-console
      console.log(
        `[PlotCardMarker3D] mounted <${winnerTag}> at lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} alt=${altitudeM}m`
      );
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

  useEffect(() => {
    const m = markerRef.current as (HTMLElement & { position?: unknown }) | null;
    if (!m) return;
    try {
      m.position = { lat, lng, altitude: altitudeM };
    } catch {
      try {
        m.setAttribute('position', `${lat},${lng},${altitudeM}`);
      } catch { /* ignore */ }
    }
  }, [lat, lng, altitudeM]);

  if (!host) return null;
  return createPortal(children, host);
}
