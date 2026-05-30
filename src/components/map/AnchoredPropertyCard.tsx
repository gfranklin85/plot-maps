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
      // Marker attribute on the popover HOST (not a descendant) so the
      // globals.css selectors can target it without crossing the shadow
      // DOM boundary. Plot's hologram popup ships its own gold-edged
      // chrome; Google's default container/tail/scrollbars must be
      // invisible. Mirrors the GroundGlow pattern.
      try { p.setAttribute('plot-property-card', ''); } catch { /* ignore */ }
      // Belt-and-suspenders: inline-style the host so neither Google's
      // stylesheet nor any shadow-DOM defaults can re-paint the chrome.
      // Sets background to transparent + lifts every overflow/max-size
      // cap so the popover never paints scrollbars around our card.
      try {
        p.style.setProperty('--gmp-popover-background', 'transparent');
        p.style.background = 'transparent';
        p.style.border = '0';
        p.style.boxShadow = 'none';
        p.style.padding = '0';
        p.style.maxHeight = 'none';
        p.style.maxWidth = 'none';
        p.style.overflow = 'visible';
      } catch { /* ignore — style not settable on every host */ }
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
  // ── ZERO-SIZE PORTAL PATTERN (locked 2026-05-30 evening) ──────
  // gmp-popover's shadow DOM wraps slotted children in an internal
  // container that paints background, padding, max-height, and a
  // scrollbar. We tried for days to suppress that chrome via
  // ::part() (not exposed), inline host styles (don't pierce shadow
  // DOM), display:contents (doesn't kill the shadow tree's internal
  // layout), and every plausible --gmp-popover-* custom property
  // (none of them are bound by Google's stylesheet). The shell kept
  // painting because the internal container kept finding a sized
  // child to wrap.
  //
  // The fix: give it nothing to wrap. The portal target itself is a
  // 0×0 element. The actual visible popup card lives in a child
  // that's position:absolute outside the parent's box flow — it
  // escapes the popover's internal layout entirely, so the container
  // has no reason to expand or paint chrome.
  //
  // This is exactly the pattern GroundGlow uses (src/components/map/
  // GroundGlow.tsx) where it's been working since 2026-05-28.
  return createPortal(
    <div
      data-plot-popup="1"
      style={{
        position: 'relative',
        width: 0,
        height: 0,
        overflow: 'visible',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          // The card centers itself horizontally on the anchor point
          // and floats above it. Translating -50% X + -100% Y puts
          // the card so its bottom-center sits on the lat/lng anchor.
          transform: 'translate(-50%, -100%)',
          pointerEvents: 'auto',
        }}
      >
        {children}
        <CardBeamTail />
      </div>
    </div>,
    popover,
  );
}
