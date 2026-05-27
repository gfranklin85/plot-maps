"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { RITUAL_TIMING } from "@/lib/ritualTiming";

// Ritual tether — Plot's confirmation-ritual connection effect.
//
// Greg locked 2026-05-27 (confirmation-ritual design):
//   - v1 screen-space: origin at viewport bottom-center, target at
//     reticle's cursor pixel
//   - launches on engage, travels for ~LAUNCH+TRAVEL ms, arrives on
//     the impact frame synchronized with sound + illumination
//   - vocabulary: information transfer beam / calibration lock / cable
//   - NOT laser weapon, NOT arcade zap, NOT magic spell
//
// Imperative API: parent calls .fire(targetX, targetY, onImpact) when
// the engage event occurs. Tether animates origin→target with travel
// time scaled by distance (within MIN/MAX bounds), invokes onImpact
// callback on the impact frame, fades out, removes itself.
//
// Web Animations API (not CSS transitions) for frame-accurate timing
// that we can pair with AudioContext-scheduled sound.

export interface RitualTetherHandle {
  /** Engage. Launches a tether from origin to (targetX, targetY).
   *  Returns the total ritual duration in ms (launch + travel) so
   *  the caller can schedule the reveal phase. */
  fire(targetX: number, targetY: number, onImpact?: () => void): number;
}

interface RitualTetherProps {
  /** Override the launch origin. Default: viewport bottom-center. */
  originXRef?: React.RefObject<number>;
  originYRef?: React.RefObject<number>;
}

const RitualTether = forwardRef<RitualTetherHandle, RitualTetherProps>(
  function RitualTether({ originXRef, originYRef }, ref) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const lineRef = useRef<SVGLineElement | null>(null);
    const impactRingRef = useRef<SVGCircleElement | null>(null);

    useImperativeHandle(ref, () => ({
      fire(targetX: number, targetY: number, onImpact?: () => void): number {
        const svg = svgRef.current;
        const line = lineRef.current;
        const ring = impactRingRef.current;
        if (!svg || !line || !ring) return 0;

        // Resolve launch origin. Refs win if provided (lets v2 anchor
        // to the user's craft in world-space); else viewport bottom-
        // center, the v1 spec.
        const originX = originXRef?.current ?? window.innerWidth / 2;
        const originY = originYRef?.current ?? window.innerHeight;

        // Distance-scale the travel time, clamped to MIN/MAX so the
        // rhythm doesn't drift too far. Quadratic feel: distant
        // targets pay slightly more than linear.
        const dx = targetX - originX;
        const dy = targetY - originY;
        const distance = Math.hypot(dx, dy);
        const diagonal = Math.hypot(window.innerWidth, window.innerHeight);
        const distNorm = Math.min(1, distance / diagonal);
        const travelMs = clamp(
          RITUAL_TIMING.TRAVEL_DURATION_MS * (0.55 + 0.7 * distNorm),
          RITUAL_TIMING.TRAVEL_DURATION_MIN_MS,
          RITUAL_TIMING.TRAVEL_DURATION_MAX_MS,
        );
        const totalMs = RITUAL_TIMING.LAUNCH_DURATION_MS + travelMs;

        // Reset line to origin → origin (zero length), make visible.
        line.setAttribute('x1', String(originX));
        line.setAttribute('y1', String(originY));
        line.setAttribute('x2', String(originX));
        line.setAttribute('y2', String(originY));
        line.style.opacity = '0';
        // Hide the impact ring until arrival.
        ring.setAttribute('cx', String(targetX));
        ring.setAttribute('cy', String(targetY));
        ring.style.opacity = '0';

        // Phase A: launch — fade the line in over LAUNCH_DURATION_MS.
        line.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          {
            duration: RITUAL_TIMING.LAUNCH_DURATION_MS,
            easing: 'ease-out',
            fill: 'forwards',
          },
        );

        // Phase B: travel — extend the line's endpoint from origin to
        // target. We animate the x2/y2 attributes via a Web Animations
        // keyframe by writing to a CSSStyleDeclaration is tricky for
        // SVG attributes, so we use SMIL-like attribute animation via
        // requestAnimationFrame for the geometry (cheap, ~one DOM
        // write per frame), while the opacity uses WAAPI above.
        const travelStart = performance.now() + RITUAL_TIMING.LAUNCH_DURATION_MS;
        const travelEnd = travelStart + travelMs;
        let rafId = 0;
        let impactFired = false;
        const tick = () => {
          const now = performance.now();
          const t = clamp((now - travelStart) / (travelEnd - travelStart), 0, 1);
          // ease-out-expo equivalent: cubic-bezier(0.16, 1, 0.3, 1)
          const eased = t < 1 ? 1 - Math.pow(2, -10 * t) : 1;
          const x = originX + dx * eased;
          const y = originY + dy * eased;
          line.setAttribute('x2', String(x));
          line.setAttribute('y2', String(y));
          if (t >= 1 && !impactFired) {
            impactFired = true;
            // Impact frame — synchronized callbacks. The caller's
            // onImpact fires the sound + illumination from here.
            try { onImpact?.(); } catch (err) { console.error('[RitualTether] onImpact error', err); }
            // Impact ring pulse: appear at target, expand + fade.
            ring.style.opacity = '1';
            ring.setAttribute('r', '4');
            ring.animate(
              [
                { r: 4, opacity: 1 },
                { r: 28, opacity: 0 },
              ] as Keyframe[],
              {
                duration: 320,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'forwards',
              },
            );
            // Tether fades out after impact.
            line.animate(
              [{ opacity: 1 }, { opacity: 0 }],
              {
                duration: RITUAL_TIMING.TETHER_FADE_MS,
                easing: 'ease-in',
                fill: 'forwards',
              },
            );
            return;
          }
          rafId = requestAnimationFrame(tick);
        };
        // Wait for the launch phase before starting travel.
        const launchTimer = window.setTimeout(() => {
          rafId = requestAnimationFrame(tick);
        }, RITUAL_TIMING.LAUNCH_DURATION_MS);

        // Stash cleanup hooks on the SVG so a second fire() before this
        // one finishes cancels the in-flight RAF + timer cleanly.
        const prev = (svg as unknown as { __ritualCleanup?: () => void }).__ritualCleanup;
        if (prev) prev();
        (svg as unknown as { __ritualCleanup?: () => void }).__ritualCleanup = () => {
          cancelAnimationFrame(rafId);
          clearTimeout(launchTimer);
        };

        return totalMs;
      },
    }), [originXRef, originYRef]);

    // Cleanup on unmount. Capture the current ref value inside the
    // effect so we don't read a potentially-stale ref at teardown.
    useEffect(() => {
      const svg = svgRef.current as unknown as { __ritualCleanup?: () => void } | null;
      return () => {
        svg?.__ritualCleanup?.();
      };
    }, []);

    return (
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 8950, // below CustomReticle (9000), above the map
        }}
        aria-hidden="true"
      >
        <defs>
          {/* Linear gradient along the tether: warm parchment fading
              toward the target. Gives a slight directional "energy
              flowing toward the target" cue without overdoing it. */}
          <linearGradient id="ritual-tether-grad" gradientUnits="userSpaceOnUse"
            x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F5EBD8" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#F5EBD8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#E07856" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line
          ref={lineRef}
          x1={0}
          y1={0}
          x2={0}
          y2={0}
          stroke="#F5EBD8"
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0}
          style={{
            filter: 'drop-shadow(0 0 6px rgba(245,235,216,0.4))',
          }}
        />
        <circle
          ref={impactRingRef}
          cx={0}
          cy={0}
          r={4}
          fill="none"
          stroke="#E07856"
          strokeWidth={1.5}
          opacity={0}
          style={{
            filter: 'drop-shadow(0 0 8px rgba(224,120,86,0.6))',
          }}
        />
      </svg>
    );
  },
);

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export default RitualTether;
