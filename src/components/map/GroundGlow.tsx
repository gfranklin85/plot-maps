"use client";

import { useEffect, useRef, useState } from "react";
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

interface Map3DCam extends HTMLElement {
  center?: { lat: number; lng: number; altitude?: number };
  heading?: number;
  tilt?: number;
  range?: number;
}

// gmp-popover auto-pans the camera into view on open; the documented
// disable-pan-while-open attribute is NOT honored by the JS web component
// (confirmed 2026-06-04 — this popover was the real zoom-on-select bug).
// Snapshot the camera right before open and restore it for ~8 frames to
// cancel the auto-pan tween. Same defense the card popover uses.
function cancelAutoPan(mapEl: HTMLElement): () => void {
  const cam = mapEl as unknown as Map3DCam;
  const snap = {
    center: cam.center ? { ...cam.center } : null,
    heading: cam.heading,
    tilt: cam.tilt,
    range: cam.range,
  };
  if (!snap.center) return () => {};
  let rafId = 0;
  let released = false;
  const MAX_MS = 2000;
  const start = performance.now();
  const release = () => {
    if (released) return;
    released = true;
    window.removeEventListener('pointerdown', release, true);
    window.removeEventListener('wheel', release, true);
    window.removeEventListener('keydown', release, true);
  };
  window.addEventListener('pointerdown', release, true);
  window.addEventListener('wheel', release, true);
  window.addEventListener('keydown', release, true);
  const tick = () => {
    if (released || performance.now() - start > MAX_MS) { rafId = 0; return; }
    try {
      if (snap.center) cam.center = snap.center;
      if (typeof snap.heading === 'number') cam.heading = snap.heading;
      if (typeof snap.tilt === 'number') cam.tilt = snap.tilt;
      if (typeof snap.range === 'number') cam.range = snap.range;
    } catch { /* noop */ }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => { release(); if (rafId) cancelAnimationFrame(rafId); };
}

export default function GroundGlow({ mapElRef, lat, lng }: GroundGlowProps) {
  const [popover, setPopover] = useState<PopoverElement | null>(null);
  const stopPinRef = useRef<(() => void) | null>(null);

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
      // Suppress Google's default popover chrome so only our glow
      // disc renders. The CSS in globals.css that hides .gm-style-iw
      // already handles most of this; belt-and-suspenders here.
      try { p.setAttribute('plot-ground-glow', ''); } catch { /* ignore */ }

      mapEl.appendChild(p);
      // Capture camera THEN open, and restore over the next frames so the
      // popover's auto-pan can't yank the user's flight. (The real fix —
      // the attribute above is ignored by the web component.)
      const stopPin = cancelAutoPan(mapEl);
      p.open = true;
      stopPinRef.current = stopPin;
      createdPopover = p;
      setPopover(p);
      attached = true;
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (stopPinRef.current) { stopPinRef.current(); stopPinRef.current = null; }
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
