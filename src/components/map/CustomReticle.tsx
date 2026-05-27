"use client";

import { useEffect, useRef, useState } from "react";
import { RITUAL_TIMING } from "@/lib/ritualTiming";

// Theodolite reticle — Plot's custom cursor inside the map container.
//
// Greg locked 2026-05-27 (confirmation-ritual design):
//   - thin linework, calibration ticks, optional center dot
//   - restrained, surveying instrument vocabulary
//   - NOT gamer crosshair, NOT laser sight
//   - subtle hover state when over a targetable parcel/address
//
// Architecture:
//   - Listens to window mousemove for cursor x/y
//   - Renders fixed-positioned SVG translated to cursor pixel
//   - No React re-render per frame; CSS transform via direct DOM
//   - Hover state toggled externally via `hoverActive` prop (the
//     parent runs the ground-projection query and tells us)
//   - OS cursor hidden via `cursor: none` rule on the map container
//     (NOT scoped here — that lives in the map container's class)
//
// This is the prototype reticle. Final brand asset lives in Affinity
// and replaces the inline SVG below. The HOOK and POSITIONING stay.

interface CustomReticleProps {
  /** External signal: cursor is over a targetable parcel/address.
   *  Drives the acquisition-state visual. */
  hoverActive?: boolean;
  /** Disable rendering entirely. Useful for non-flight modes where
   *  the standard OS cursor should remain visible. */
  enabled?: boolean;
}

export default function CustomReticle({ hoverActive = false, enabled = true }: CustomReticleProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // Track real OS cursor at window level. Both the real mouse AND
  // Steam Input's gamepad-driven cursor produce mousemove events,
  // so this single listener captures both input paths.
  const cursorXRef = useRef<number>(-1);
  const cursorYRef = useRef<number>(-1);
  // Visibility flag — hide until the user has moved at least once.
  // Avoids a frame-zero reticle ghost at (0,0).
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: MouseEvent) => {
      cursorXRef.current = e.clientX;
      cursorYRef.current = e.clientY;
      if (svgRef.current) {
        // translate3d hints the GPU compositor; smoother than left/top.
        svgRef.current.style.transform = `translate3d(${e.clientX - 24}px, ${e.clientY - 24}px, 0)`;
      }
      if (!seen) setSeen(true);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [enabled, seen]);

  if (!enabled) return null;

  // Reticle palette — parchment-cream neutral, coral on acquisition.
  // Tuned for legibility on photoreal map tiles (mid-luminance ground,
  // varied backgrounds). Stroke widths are 1px / 1.5px — thin linework.
  const strokeNeutral = '#F5EBD8';
  const strokeAcquired = '#E07856';
  const stroke = hoverActive ? strokeAcquired : strokeNeutral;
  const shadow = 'drop-shadow(0 0 1px rgba(0,0,0,0.6))';

  return (
    <svg
      ref={svgRef}
      width={48}
      height={48}
      viewBox="0 0 48 48"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 9000,
        opacity: seen ? 1 : 0,
        filter: shadow,
        transition: `opacity 120ms ease-out, color ${RITUAL_TIMING.HOVER_STATE_TRANSITION_MS}ms ease-out`,
        willChange: 'transform',
      }}
      aria-hidden="true"
    >
      {/* Outer calibration ring — primary precision indicator. */}
      <circle
        cx={24}
        cy={24}
        r={14}
        fill="none"
        stroke={stroke}
        strokeWidth={1}
        style={{
          transition: `stroke ${RITUAL_TIMING.HOVER_STATE_TRANSITION_MS}ms ease-out`,
        }}
      />
      {/* Inner calibration ring — adds optic depth. */}
      <circle
        cx={24}
        cy={24}
        r={9}
        fill="none"
        stroke={stroke}
        strokeWidth={0.5}
        opacity={0.5}
        style={{
          transition: `stroke ${RITUAL_TIMING.HOVER_STATE_TRANSITION_MS}ms ease-out`,
        }}
      />
      {/* Crosshair — north / south / east / west calibration ticks,
          with a small gap at the center for the optional center dot. */}
      <line x1={24} y1={4} x2={24} y2={16} stroke={stroke} strokeWidth={1} />
      <line x1={24} y1={32} x2={24} y2={44} stroke={stroke} strokeWidth={1} />
      <line x1={4} y1={24} x2={16} y2={24} stroke={stroke} strokeWidth={1} />
      <line x1={32} y1={24} x2={44} y2={24} stroke={stroke} strokeWidth={1} />
      {/* Calibration tick marks at 45° intervals — subtle diagonals,
          confer the surveying-instrument feel without crowding. */}
      <line x1={14.5} y1={14.5} x2={17.5} y2={17.5} stroke={stroke} strokeWidth={0.5} opacity={0.6} />
      <line x1={30.5} y1={14.5} x2={33.5} y2={17.5} stroke={stroke} strokeWidth={0.5} opacity={0.6} />
      <line x1={14.5} y1={33.5} x2={17.5} y2={30.5} stroke={stroke} strokeWidth={0.5} opacity={0.6} />
      <line x1={30.5} y1={33.5} x2={33.5} y2={30.5} stroke={stroke} strokeWidth={0.5} opacity={0.6} />
      {/* Center dot — subtle. The aim point itself. */}
      <circle
        cx={24}
        cy={24}
        r={1.25}
        fill={stroke}
        style={{
          transition: `fill ${RITUAL_TIMING.HOVER_STATE_TRANSITION_MS}ms ease-out`,
        }}
      />
      {/* Acquisition halo — only visible when hoverActive. Soft glow. */}
      {hoverActive && (
        <circle
          cx={24}
          cy={24}
          r={17}
          fill="none"
          stroke={strokeAcquired}
          strokeWidth={0.5}
          opacity={0.5}
        />
      )}
    </svg>
  );
}
