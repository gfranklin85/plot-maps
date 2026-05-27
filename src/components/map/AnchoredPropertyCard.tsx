"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// AnchoredPropertyCard — Plot's PropertyCard rendered IN the 3D world
// at a parcel's lat/lng, using Google's Marker3DInteractiveElement as
// the anchor. Google's renderer handles projection, depth, occlusion,
// and camera tracking; we just provide the HTML content.
//
// Architecture:
//   - Mounts a <gmp-marker-3d-interactive> inside the <gmp-map-3d>
//     element passed in via mapElRef
//   - The marker itself is invisible (we hide its default appearance);
//     all visible content is the custom HTML we portal into it
//   - Google positions the marker at lat/lng/altitude in world space;
//     the camera matrix automatically projects it to the correct
//     screen pixel each frame as the camera moves
//   - When camera flies, card follows the building. When building goes
//     off-screen or behind camera, marker is hidden by Google's renderer
//
// Greg locked 2026-05-27: cathedral grade. No screen-space hack.

interface AnchoredPropertyCardProps {
  /** The <gmp-map-3d> element we attach the marker to. */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  /** World position to anchor the card at. */
  lat: number;
  lng: number;
  /** Altitude above ground in meters. Default: 8m so the card floats
   *  slightly above the building, not buried in it. */
  altitudeM?: number;
  /** Content to render inside the marker. */
  children: ReactNode;
}

// Minimal interface for the Map3D marker primitive.
interface Marker3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string; // 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND' | 'ABSOLUTE'
  // Marker3DInteractive can carry arbitrary HTML children; Google's
  // renderer composites them at the projected screen position.
}

export default function AnchoredPropertyCard({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  children,
}: AnchoredPropertyCardProps) {
  const markerRef = useRef<Marker3DInteractiveElement | null>(null);
  // Portal target — a stable DOM node inside the marker that we
  // re-render React content into. Created once, reused across renders
  // so React doesn't tear down + rebuild the card every camera frame.
  const portalHostRef = useRef<HTMLDivElement | null>(null);

  // Mount the marker once on first render.
  useEffect(() => {
    const mapEl = mapElRef.current;
    if (!mapEl) return;

    const marker = document.createElement('gmp-marker-3d-interactive') as Marker3DInteractiveElement;
    marker.altitudeMode = 'RELATIVE_TO_GROUND';
    marker.position = { lat, lng, altitude: altitudeM };

    // Portal host — a div inside the marker that React will own.
    // We mount it AS a child of the marker. Google's renderer positions
    // the marker; the host inherits the projected screen transform.
    const host = document.createElement('div');
    host.style.cssText = `
      position: relative;
      pointer-events: auto;
      transform: translate(-50%, -100%);
      will-change: transform;
    `;
    marker.appendChild(host);
    mapEl.appendChild(marker);

    markerRef.current = marker;
    portalHostRef.current = host;

    return () => {
      // Cleanup: remove the marker from the map. React handles the
      // portal-content teardown automatically when this effect unmounts.
      try { marker.remove(); } catch { /* already removed */ }
      markerRef.current = null;
      portalHostRef.current = null;
    };
    // mapElRef is a ref (stable); lat/lng changes are handled by the
    // separate effect below so we don't rebuild the marker on every
    // camera tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng changes (different parcel selected).
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.position = { lat, lng, altitude: altitudeM };
  }, [lat, lng, altitudeM]);

  // Portal the React children into the marker's host div.
  if (!portalHostRef.current) return null;
  return createPortal(children, portalHostRef.current);
}
