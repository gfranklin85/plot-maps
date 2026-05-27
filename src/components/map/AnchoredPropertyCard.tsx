"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// AnchoredPropertyCard — Plot's PropertyCard rendered IN the 3D world
// at a parcel's lat/lng, using Google's gmp-marker-3d-interactive as
// the anchor. Google's renderer handles projection, depth, occlusion,
// and camera tracking; we just provide the HTML content.
//
// Architecture:
//   - Mounts a <gmp-marker-3d-interactive> inside the <gmp-map-3d>
//     element passed in via mapElRef
//   - Portals React children into a host div child of the marker so
//     React owns the inner content while Google owns positioning
//   - When map element isn't ready at first mount (common — Map3D
//     mounts async), we poll for it and retry; once mounted, we
//     trigger a state update so the portal renders into the live host
//   - Updates marker position on lat/lng change without rebuilding
//
// Greg locked 2026-05-27: cathedral grade. No screen-space hack.

interface AnchoredPropertyCardProps {
  /** The <gmp-map-3d> element we attach the marker to. */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  /** World position to anchor the card at. */
  lat: number;
  lng: number;
  /** Altitude above ground in meters. */
  altitudeM?: number;
  /** Content to render inside the marker. */
  children: ReactNode;
}

// Minimal interface for the Map3D marker primitive.
interface Marker3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string; // 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND' | 'ABSOLUTE'
}

export default function AnchoredPropertyCard({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  children,
}: AnchoredPropertyCardProps) {
  // Host node we portal React children into. State (not ref) so a
  // re-render fires once the host exists and the portal renders.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [marker, setMarker] = useState<Marker3DInteractiveElement | null>(null);
  // Track whether the marker element type is even supported by the
  // current Maps library load. If not, we'll skip mounting and the
  // page can fall back gracefully.
  const [supported, setSupported] = useState<boolean | null>(null);

  // Mount loop — polls for the map element until it's ready, then
  // creates the marker + host once. Tolerates the common case where
  // React mounts this component before Map3D has finished its async
  // attribute/element registration.
  useEffect(() => {
    let attached = false;
    let retryId: number | null = null;
    const MAX_ATTEMPTS = 50; // 50 × 100ms = 5s budget
    let attempt = 0;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      if (!mapEl) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          setSupported(false);
        }
        return;
      }

      // Verify the custom element type is defined. customElements.get
      // returns the constructor if registered; if Maps3D didn't load
      // the marker module, this returns undefined.
      const definedCtor = window.customElements?.get?.('gmp-marker-3d-interactive');
      if (!definedCtor) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn('[AnchoredPropertyCard] gmp-marker-3d-interactive not registered after retries; card will not render in world.');
          setSupported(false);
        }
        return;
      }

      const m = document.createElement('gmp-marker-3d-interactive') as Marker3DInteractiveElement;
      m.altitudeMode = 'RELATIVE_TO_GROUND';
      m.position = { lat, lng, altitude: altitudeM };

      const hostDiv = document.createElement('div');
      hostDiv.style.cssText = `
        position: relative;
        pointer-events: auto;
        transform: translate(-50%, -100%);
        will-change: transform;
      `;
      m.appendChild(hostDiv);
      mapEl.appendChild(m);

      setMarker(m);
      setHost(hostDiv);
      setSupported(true);
      attached = true;
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (attached) {
        try { marker?.remove(); } catch { /* already gone */ }
      }
      setMarker(null);
      setHost(null);
    };
    // mapElRef is a stable ref; lat/lng/altitude changes are handled
    // by the position-update effect below so we don't rebuild on every
    // selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng changes (different parcel selected).
  useEffect(() => {
    if (!marker) return;
    marker.position = { lat, lng, altitude: altitudeM };
  }, [marker, lat, lng, altitudeM]);

  // If the marker element isn't supported, fall back: render the card
  // as a fixed-position centered overlay so the user STILL gets a card,
  // just not world-anchored. Better than nothing while we investigate.
  if (supported === false) {
    return (
      <div
        style={{
          position: 'fixed',
          left: '50%',
          top: '20%',
          transform: 'translate(-50%, 0)',
          zIndex: 50,
          pointerEvents: 'auto',
        }}
      >
        {children}
      </div>
    );
  }

  if (!host) return null;
  return createPortal(children, host);
}
