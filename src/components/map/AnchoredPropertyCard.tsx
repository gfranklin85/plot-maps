"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// AnchoredPropertyCard — Plot's PropertyCard rendered IN the 3D world,
// anchored at a parcel's lat/lng via Google's PopoverElement
// (<gmp-popover>). This is Map3D's native primitive for HTML content
// anchored to a world position; Google handles projection, depth,
// occlusion, and camera tracking internally.
//
// Architecture:
//   - Creates a <gmp-popover> with positionAnchor = {lat, lng, altitude}
//   - Portals React children into the popover's default slot, where
//     they render with real DOM layout (real bounding boxes, real
//     event handling — unlike children of gmp-marker-3d-interactive
//     which are detached from layout flow)
//   - Polls for the popover element type to register (Map3D's preview
//     library mounts asynchronously); retries up to 5 seconds
//   - On lat/lng change, updates positionAnchor without rebuild
//   - Graceful fallback: if PopoverElement isn't registered, renders
//     the card as a centered fixed overlay so the user still gets UI
//
// Locked 2026-05-27 after research confirmed gmp-popover is the
// canonical Map3D HTML-anchor primitive (GA Oct 2025).

interface AnchoredPropertyCardProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Altitude above ground in meters. */
  altitudeM?: number;
  children: ReactNode;
}

interface PopoverElement extends HTMLElement {
  positionAnchor: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
  open: boolean;
  lightDismissDisabled?: boolean;
}

const POPOVER_TAG = 'gmp-popover';

export default function AnchoredPropertyCard({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  children,
}: AnchoredPropertyCardProps) {
  const [popover, setPopover] = useState<PopoverElement | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    let attached = false;
    let retryId: number | null = null;
    const MAX_ATTEMPTS = 50; // 5s budget at 100ms intervals
    let attempt = 0;
    let createdPopover: PopoverElement | null = null;

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
      // PopoverElement is registered as the custom element gmp-popover.
      // If the Maps3D library load doesn't include it (older preview
      // versions, restricted API key), the constructor is undefined.
      const def = window.customElements?.get?.(POPOVER_TAG);
      if (!def) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn('[AnchoredPropertyCard] gmp-popover not registered after retries; falling back to centered overlay.');
          setSupported(false);
        }
        return;
      }

      const p = document.createElement(POPOVER_TAG) as PopoverElement;
      p.altitudeMode = 'RELATIVE_TO_GROUND';
      p.positionAnchor = { lat, lng, altitude: altitudeM };
      p.open = true;
      // Don't auto-close when the user clicks the map; Plot owns the
      // dismiss path via the card's own close button.
      try { p.lightDismissDisabled = true; } catch { /* property may not be settable */ }

      mapEl.appendChild(p);
      createdPopover = p;
      setPopover(p);
      setSupported(true);
      attached = true;
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (attached && createdPopover) {
        try { createdPopover.remove(); } catch { /* already gone */ }
      }
      setPopover(null);
    };
    // mapElRef is stable; lat/lng/altitude changes handled by separate
    // effect to avoid rebuilding the popover on every selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update anchor when lat/lng changes (different property selected).
  useEffect(() => {
    if (!popover) return;
    popover.positionAnchor = { lat, lng, altitude: altitudeM };
  }, [popover, lat, lng, altitudeM]);

  // Fallback: PopoverElement not available; render as centered overlay.
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

  if (!popover) return null;
  return createPortal(children, popover);
}
