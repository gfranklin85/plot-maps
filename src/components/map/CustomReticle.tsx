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
  /** FIXED gamepad reticle. When provided, the reticle pins at this 0..1
   *  viewport fraction and IGNORES the mouse (the gamepad owns it; LB+right-
   *  stick moves it via useReticlePosition upstream). When omitted, falls
   *  back to legacy mouse-following. [[controller-cursor-model]] */
  fixedXFraction?: number;
  fixedYFraction?: number;
  /** Visually emphasize the reticle while the user is actively moving it
   *  (LB held). A brighter ring so placement is obvious. */
  placing?: boolean;
}

export default function CustomReticle({
  hoverActive = false,
  enabled = true,
  fixedXFraction,
  fixedYFraction,
  placing = false,
}: CustomReticleProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fixed = typeof fixedXFraction === 'number' && typeof fixedYFraction === 'number';
  // Visibility flag — hide until positioned. Fixed mode is visible at once.
  const [seen, setSeen] = useState(false);

  // ── FIXED mode: pin to the stored viewport fraction, ignore the mouse.
  useEffect(() => {
    if (!enabled || !fixed) return;
    const place = () => {
      if (!svgRef.current) return;
      const x = (fixedXFraction as number) * window.innerWidth;
      const y = (fixedYFraction as number) * window.innerHeight;
      svgRef.current.style.transform = `translate3d(${x - 24}px, ${y - 24}px, 0)`;
    };
    place();
    setSeen(true);
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [enabled, fixed, fixedXFraction, fixedYFraction]);

  // ── Legacy MOUSE mode (desktop fallback when no fixed position given).
  useEffect(() => {
    if (!enabled || fixed) return;
    const onMove = (e: MouseEvent) => {
      if (svgRef.current) {
        svgRef.current.style.transform = `translate3d(${e.clientX - 24}px, ${e.clientY - 24}px, 0)`;
      }
      if (!seen) setSeen(true);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [enabled, fixed, seen]);

  if (!enabled) return null;

  // Reticle palette — fluorescent green neutral, white on acquisition.
  // Tuned for instant readability on photoreal map tiles (varied
  // earth-tone backgrounds, rooftops, asphalt, grass — none are
  // green-fluorescent so the reticle never camouflages). Stronger
  // outer shadow for guaranteed contrast on any tile luminance.
  // Greg locked 2026-05-27.
  const strokeNeutral = '#00FF94';
  const strokeAcquired = '#FFFFFF';
  // While placing (LB held) the reticle glows white + a stronger halo so
  // the user clearly sees what they're aiming/positioning.
  const stroke = (hoverActive || placing) ? strokeAcquired : strokeNeutral;
  const shadow = placing
    ? 'drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 0 7px rgba(255,255,255,0.6))'
    : 'drop-shadow(0 0 2px rgba(0,0,0,0.85)) drop-shadow(0 0 4px rgba(0,255,148,0.35))';

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
      {/* Acquisition / placing halo — white ring around the reticle when
          over targetable surface OR while being placed (LB held). */}
      {(hoverActive || placing) && (
        <circle
          cx={24}
          cy={24}
          r={17}
          fill="none"
          stroke={strokeAcquired}
          strokeWidth={placing ? 1.25 : 0.75}
          opacity={placing ? 0.95 : 0.7}
        />
      )}
    </svg>
  );
}
