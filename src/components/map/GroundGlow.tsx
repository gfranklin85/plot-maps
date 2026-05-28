"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// GroundGlow — a glowing disc rendered at the ground point of the
// selected property. World-space: anchored at lat/lng altitude 0 via
// gmp-popover, so it tracks the camera correctly (moves when the
// world moves, stays planted on the property).
//
// Greg locked 2026-05-28: pairs with the popup's CardBeamTail to
// create the full visual loop — ground lights up → beam rises → popup
// deploys. Together they read as one continuous event even though
// they're rendered in different coordinate systems (world-space for
// the glow, screen-space-via-popup for the beam).
//
// Uses the same gmp-popover primitive AnchoredPropertyCard uses, but
// with empty HTML chrome (just the glow disc) and altitudeM = 0.

interface GroundGlowProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
}

interface PopoverElement extends HTMLElement {
  positionAnchor: { lat: number; lng: number; altitude?: number };
  altitudeMode: string;
  open: boolean;
  lightDismissDisabled?: boolean;
  disablePanWhileOpen?: boolean;
}

const POPOVER_TAG = 'gmp-popover';

export default function GroundGlow({ mapElRef, lat, lng }: GroundGlowProps) {
  const [popover, setPopover] = useState<PopoverElement | null>(null);

  useEffect(() => {
    let attached = false;
    let retryId: number | null = null;
    const MAX_ATTEMPTS = 50;
    let attempt = 0;
    let createdPopover: PopoverElement | null = null;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      if (!mapEl) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        }
        return;
      }
      const def = window.customElements?.get?.(POPOVER_TAG);
      if (!def) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        }
        return;
      }

      const p = document.createElement(POPOVER_TAG) as PopoverElement;
      p.altitudeMode = 'CLAMP_TO_GROUND';
      p.positionAnchor = { lat, lng, altitude: 0 };
      try { p.disablePanWhileOpen = true; } catch { /* ignore */ }
      try { p.lightDismissDisabled = true; } catch { /* ignore */ }
      try { p.setAttribute('disable-pan-while-open', ''); } catch { /* ignore */ }
      p.open = true;
      // Suppress Google's default popover chrome so only our glow
      // disc renders. The CSS in globals.css that hides .gm-style-iw
      // already handles most of this; belt-and-suspenders here.
      try { p.setAttribute('plot-ground-glow', ''); } catch { /* ignore */ }

      mapEl.appendChild(p);
      createdPopover = p;
      setPopover(p);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update anchor when lat/lng changes (different property selected).
  useEffect(() => {
    if (!popover) return;
    popover.positionAnchor = { lat, lng, altitude: 0 };
  }, [popover, lat, lng]);

  if (!popover) return null;
  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'relative',
        width: '0',
        height: '0',
      }}
    >
      {/* Glow disc — animated pulse. Sits centered on the lat/lng
          point. Width/height in screen pixels; Google handles the
          perspective scaling as the camera zooms in/out. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,148,0.6) 0%, rgba(0,255,148,0.25) 35%, rgba(0,255,148,0) 70%)',
          pointerEvents: 'none',
          animation: 'plot-ground-glow-pulse 2.4s ease-in-out infinite',
        }}
      />
      {/* Bright core dot — the precise anchor point. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,148,1) 0%, rgba(0,255,148,0.6) 60%, rgba(0,255,148,0) 100%)',
          filter: 'drop-shadow(0 0 6px rgba(0,255,148,0.85))',
          pointerEvents: 'none',
        }}
      />
      <style>{`
        @keyframes plot-ground-glow-pulse {
          0%, 100% { opacity: 0.6; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1.0; transform: translate(-50%, -50%) scale(1.15); }
        }
      `}</style>
    </div>,
    popover,
  );
}
