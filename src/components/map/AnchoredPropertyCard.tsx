"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import CardBeamTail from "./CardBeamTail";

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
  /** Forwarded ref to the popover element so other components
   *  (e.g. RitualTether's vertical beam) can read its projected
   *  screen position each frame and stay attached. */
  popoverForwardRef?: React.MutableRefObject<HTMLElement | null>;
  children: ReactNode;
}

interface PopoverElement extends HTMLElement {
  positionAnchor: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
  open: boolean;
  lightDismissDisabled?: boolean;
  // Mar 2026 GA release added this — disables the camera auto-pan
  // that fires when the popover opens. Plot owns its own camera
  // model; we never want Google jerking the camera toward the popup.
  disablePanWhileOpen?: boolean;
}

const POPOVER_TAG = 'gmp-popover';

export default function AnchoredPropertyCard({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  popoverForwardRef,
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
      // Disable the camera auto-pan that Google's default fires when
      // the popover opens. Plot owns its own camera (flight model);
      // we never want Google jerking the camera. Set BEFORE open.
      try { p.disablePanWhileOpen = true; } catch { /* property may not be settable */ }
      // Don't auto-close when the user clicks the map; Plot owns the
      // dismiss path via the card's own close button.
      try { p.lightDismissDisabled = true; } catch { /* property may not be settable */ }
      // Also try the alternate attribute form for older preview API
      // versions that haven't switched to property-style yet.
      try { p.setAttribute('disable-pan-while-open', ''); } catch { /* ignore */ }
      p.open = true;

      mapEl.appendChild(p);
      createdPopover = p;
      setPopover(p);
      if (popoverForwardRef) popoverForwardRef.current = p;
      setSupported(true);
      attached = true;
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (attached && createdPopover) {
        try { createdPopover.remove(); } catch { /* already gone */ }
      }
      if (popoverForwardRef) popoverForwardRef.current = null;
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
  // Wrap children + CardBeamTail in a relative container so the beam
  // can absolute-position below the card and ride along with the
  // popover's own screen-space transforms. Greg locked 2026-05-28:
  // beam stays with UI, not the screen.
  return createPortal(
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {children}
      <CardBeamTail />
    </div>,
    popover,
  );
}
