"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import CardBeamTail from "./CardBeamTail";

// AnchoredPropertyCard v2 — Plot's PropertyCard anchored at a parcel's
// lat/lng in screen space.
//
// Locked 2026-05-30: replaces the prior gmp-popover-based anchor.
// Google's docs (release note 3.62.12c) confirmed gmp-popover's
// chrome (background pill, max-height, scrollbar) is NOT user-
// suppressible — only background-color, border-radius, box-shadow,
// padding are themable; container/overflow/max-height are internal.
// After 8+ attempts to fight the shadow DOM, we abandoned the popover
// approach for the OFFICIAL Google-recommended pattern:
//
//   1. Create an invisible <gmp-marker-3d-interactive> at the lat/lng.
//      Marker3DInteractiveElement extends HTMLElement, so it inherits
//      getBoundingClientRect() — that gives us the screen-space pixel
//      position of the lat/lng on every camera change.
//
//   2. Run a requestAnimationFrame loop that reads the marker's
//      bounding rect and writes the center coord to state when it
//      changes meaningfully (>1px).
//
//   3. Render the React children as position:fixed via a body portal,
//      transformed to the marker's projected screen position. The
//      children get full pixel-perfect chrome control because Google
//      is no longer wrapping them.
//
//   4. The marker itself renders nothing (we set no slotted children
//      and let it self-default to an invisible point).
//
// This matches Map3D's documented patterns: Marker3DInteractiveElement
// is Google's primitive for "I want a clickable point in 3D space" —
// it handles projection, depth, occlusion automatically. We just read
// its rect.

interface AnchoredPropertyCardProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Altitude above ground in meters. The marker uses this as its
   *  z-anchor; the popup card floats above it on screen. */
  altitudeM?: number;
  /** Forwarded ref to the marker element so other components
   *  (e.g. RitualTether's vertical beam) can read its projected
   *  screen position each frame and stay attached. */
  popoverForwardRef?: React.MutableRefObject<HTMLElement | null>;
  children: ReactNode;
}

interface Marker3DInteractiveElement extends HTMLElement {
  position: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
}

const MARKER_TAG = 'gmp-marker-3d-interactive';

export default function AnchoredPropertyCard({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  popoverForwardRef,
  children,
}: AnchoredPropertyCardProps) {
  const [marker, setMarker] = useState<Marker3DInteractiveElement | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  // Screen position of the marker (the popup card's bottom-center
  // anchor). null while waiting for first projection.
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);

  // ── Mount marker ─────────────────────────────────────────────
  useEffect(() => {
    let retryId: number | null = null;
    const MAX_ATTEMPTS = 50; // 5s budget at 100ms intervals
    let attempt = 0;
    let createdMarker: Marker3DInteractiveElement | null = null;

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
      const def = window.customElements?.get?.(MARKER_TAG);
      if (!def) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn('[AnchoredPropertyCard] gmp-marker-3d-interactive not registered after retries; falling back to centered overlay.');
          setSupported(false);
        }
        return;
      }

      const m = document.createElement(MARKER_TAG) as Marker3DInteractiveElement;
      try { m.altitudeMode = 'RELATIVE_TO_GROUND'; } catch { /* ignore */ }
      try { m.position = { lat, lng, altitude: altitudeM }; } catch { /* ignore */ }
      // Mark for any CSS hooks + DOM debug
      try { m.setAttribute('plot-property-anchor', ''); } catch { /* ignore */ }

      mapEl.appendChild(m);
      createdMarker = m;
      setMarker(m);
      if (popoverForwardRef) popoverForwardRef.current = m;
      setSupported(true);
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (createdMarker) {
        try { createdMarker.remove(); } catch { /* already gone */ }
      }
      if (popoverForwardRef) popoverForwardRef.current = null;
      setMarker(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker position when lat/lng changes (different property selected).
  useEffect(() => {
    if (!marker) return;
    try {
      marker.position = { lat, lng, altitude: altitudeM };
    } catch { /* ignore */ }
  }, [marker, lat, lng, altitudeM]);

  // ── RAF loop: project marker rect → screenPos each frame ─────
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!marker) return;
    let cancelled = false;
    let rafId = 0;

    const tick = () => {
      if (cancelled) return;
      const rect = marker.getBoundingClientRect();
      // Marker may have 0×0 bounds when off-screen / behind the camera.
      // In that case skip the update and keep the prior position so the
      // popup gracefully fades out rather than jumping to (0,0).
      if (rect.width > 0 || rect.height > 0 || rect.left !== 0 || rect.top !== 0) {
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const last = lastPosRef.current;
        // Throttle React state updates — only commit when the position
        // shifted enough to be visually meaningful. Saves render churn
        // during smooth camera animations.
        if (!last || Math.abs(last.x - x) > 0.5 || Math.abs(last.y - y) > 0.5) {
          lastPosRef.current = { x, y };
          setScreenPos({ x, y });
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [marker]);

  // ── Fallback: marker element not registered ──────────────────
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

  // Wait until we have a screen position before painting anything.
  // Otherwise the popup would briefly flash at (0,0) before the first
  // RAF frame runs.
  if (!screenPos || typeof document === 'undefined') return null;

  // ── Portal the popup card to <body> at the projected screen pos ──
  // position:fixed so it's anchored to the viewport, not any parent's
  // transformed/scrolled context. Translate -50% horizontal centers
  // it on the property; -100% vertical floats it above the point.
  return createPortal(
    <div
      data-plot-popup="1"
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 40,
        pointerEvents: 'auto',
        // Smooth interpolation between RAF state updates would feel
        // weird at high update rates (visible easing during normal
        // camera moves). Leave it instant; RAF is already smooth.
      }}
    >
      {children}
      <CardBeamTail />
    </div>,
    document.body,
  );
}
