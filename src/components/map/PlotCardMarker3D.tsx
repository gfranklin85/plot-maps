"use client";

// PlotCardMarker3D — mounts a React HTML element as the content of a
// 3D marker at a lat/lng/altitude inside <gmp-map-3d>.
//
// 2026-06-06 — wired for the photoreal 3D map. The correct primitive is
// gmp-marker-3d-interactive (Marker3DInteractiveElement), which anchors
// HTML content at {lat,lng,altitude} and — critically — does NOT auto-pan
// the camera on mount (only gmp-popover does; that was the zoom-on-select
// bug). Research-confirmed, see reference_gmp_3d_anchor_no_pan. Falls back
// to the 2D marker tags if the 3D one isn't registered.
//
// The card portals into a host <div> appended as the marker's content.
// Screen-facing + crisp — we never tilt the readable layer.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface PlotCardMarker3DProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  altitudeM?: number;
  children: ReactNode;
}

// 3D marker tags first (correct for gmp-map-3d photoreal); 2D as fallback.
const CANDIDATE_MARKER_TAGS = [
  'gmp-marker-3d-interactive',
  'gmp-marker-3d',
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
