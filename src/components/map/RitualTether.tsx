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
   *  After impact, an information beam REDIRECTS vertically — rises
   *  from the impact point to where the popup will land. Returns the
   *  total ritual duration in ms (launch + travel + pressure pause +
   *  rise + stabilize) so the caller can schedule the popup reveal
   *  to land exactly when the beam finishes deploying.
   *
   *  Greg's design-intelligence breakthrough 2026-05-28: the beam
   *  doesn't open the popup — the beam DEPLOYS the popup. Same
   *  energy, redirected upward into information form.
   *
   *  attachToEl: once the rebound beam reaches full extension, switch
   *  from static targetX/targetY to live-tracking this element's
   *  bounding rect. Beam stays glued to the popup as the camera
   *  moves through the world. Greg locked 2026-05-28 evening. */
  fire(
    targetX: number,
    targetY: number,
    onImpact?: () => void,
    attachToEl?: HTMLElement | null,
  ): number;
  /** Retract. On card dismiss, the vertical beam collapses back into
   *  the property and fades. Caller invokes this when the popup is
   *  closed so the umbilical doesn't linger after the card is gone. */
  retract(): void;
  /** Switch the beam from static post-impact coords to live-tracking
   *  an element's bounding rect. Called from page.tsx once the popup
   *  element has mounted (one render tick after selectedLead is set).
   *  Idempotent — calling again replaces the previous follow target. */
  attachTo(el: HTMLElement | null): void;
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
    // Vertical rebound beam — the "information beam" that rises from
    // the property after impact. Stays visible as an umbilical
    // connecting popup to property until retract() is called.
    const reboundBeamRef = useRef<SVGLineElement | null>(null);
    // Node sphere at the rebound's top — the visual anchor where the
    // popup will materialize. Subtle glow; the popup masks it on
    // arrival. v1 placeholder; v2 becomes a real Blender asset.
    const reboundNodeRef = useRef<SVGCircleElement | null>(null);

    useImperativeHandle(ref, () => ({
      fire(
        targetX: number,
        targetY: number,
        onImpact?: () => void,
        attachToEl?: HTMLElement | null,
      ): number {
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
        // Total ritual duration: launch + travel + pressure pause +
        // rise + stabilize. Caller schedules popup reveal at this
        // exact moment so the popup arrives JUST as the beam finishes
        // stabilizing at the top — the popup is the beam's payload.
        const totalMs = RITUAL_TIMING.LAUNCH_DURATION_MS
          + travelMs
          + RITUAL_TIMING.REBOUND_PRESSURE_PAUSE_MS
          + RITUAL_TIMING.REBOUND_RISE_DURATION_MS
          + RITUAL_TIMING.REBOUND_STABILIZE_MS;

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
            // Incoming tether fades out after impact.
            line.animate(
              [{ opacity: 1 }, { opacity: 0 }],
              {
                duration: RITUAL_TIMING.TETHER_FADE_MS,
                easing: 'ease-in',
                fill: 'forwards',
              },
            );

            // ── Vertical REBOUND beam — Greg locked 2026-05-28 ──
            // The energy redirects upward from the impact point.
            // This is what deploys the popup, not "the popup opens."
            const rebound = reboundBeamRef.current;
            const node = reboundNodeRef.current;
            if (rebound && node) {
              const topY = targetY - RITUAL_TIMING.REBOUND_RISE_DISTANCE_PX;
              // Reset rebound to zero-length at the impact point,
              // hidden, ready to extend.
              rebound.setAttribute('x1', String(targetX));
              rebound.setAttribute('y1', String(targetY));
              rebound.setAttribute('x2', String(targetX));
              rebound.setAttribute('y2', String(targetY));
              rebound.style.opacity = '0';
              node.setAttribute('cx', String(targetX));
              node.setAttribute('cy', String(targetY));
              node.setAttribute('r', '2');
              node.style.opacity = '0';
              // Pressure-pause beat, then extend the beam upward.
              const pauseTimer = window.setTimeout(() => {
                rebound.style.opacity = '1';
                node.style.opacity = '1';
                const riseStart = performance.now();
                const riseEnd = riseStart + RITUAL_TIMING.REBOUND_RISE_DURATION_MS;
                let riseRaf = 0;
                const rise = () => {
                  const n = performance.now();
                  const u = clamp((n - riseStart) / (riseEnd - riseStart), 0, 1);
                  // ease-out-cubic — snaps up then settles.
                  const eased = 1 - Math.pow(1 - u, 3);
                  const y = targetY + (topY - targetY) * eased;
                  rebound.setAttribute('y2', String(y));
                  node.setAttribute('cy', String(y));
                  // Node swells slightly as it reaches the top —
                  // sells the "deployment" beat.
                  node.setAttribute('r', String(2 + 4 * eased));
                  if (u < 1) {
                    riseRaf = requestAnimationFrame(rise);
                  } else {
                    // Rise complete — switch to live-follow mode if
                    // an attach element was provided. Beam top now
                    // tracks the popup's bottom-center each frame.
                    if (attachToEl) {
                      let followRaf = 0;
                      let prevTopY = y;
                      let prevBottomY = targetY;
                      const follow = () => {
                        const r = attachToEl.getBoundingClientRect();
                        if (r.width === 0 && r.height === 0) {
                          // Popup not laid out yet; hold last frame.
                          followRaf = requestAnimationFrame(follow);
                          return;
                        }
                        const popupCenterX = r.left + r.width / 2;
                        // Beam terminates 6px INSIDE the popup's
                        // bottom edge so it visually enters the card.
                        const popupBottomY = r.bottom - 6;
                        // Beam bottom anchor: directly under popup
                        // center, projected toward the ground where
                        // the impact ring popped. Match popup x so
                        // the umbilical stays plumb.
                        const groundY = popupBottomY + RITUAL_TIMING.REBOUND_RISE_DISTANCE_PX;
                        // Smooth in case Google's projection jitters
                        // a pixel per frame — exponential moving avg.
                        const smoothTop = prevTopY * 0.55 + popupBottomY * 0.45;
                        const smoothBottom = prevBottomY * 0.55 + groundY * 0.45;
                        prevTopY = smoothTop;
                        prevBottomY = smoothBottom;
                        rebound.setAttribute('x1', String(popupCenterX));
                        rebound.setAttribute('y1', String(smoothBottom));
                        rebound.setAttribute('x2', String(popupCenterX));
                        rebound.setAttribute('y2', String(smoothTop));
                        node.setAttribute('cx', String(popupCenterX));
                        node.setAttribute('cy', String(smoothTop));
                        followRaf = requestAnimationFrame(follow);
                      };
                      followRaf = requestAnimationFrame(follow);
                      const prevFollow = (svg as unknown as { __followCancel?: () => void }).__followCancel;
                      if (prevFollow) prevFollow();
                      (svg as unknown as { __followCancel?: () => void }).__followCancel = () => {
                        cancelAnimationFrame(followRaf);
                      };
                    }
                  }
                };
                riseRaf = requestAnimationFrame(rise);
                // Stash on the svg so retract() / new fire() can cancel.
                const prevRise = (svg as unknown as { __riseCancel?: () => void }).__riseCancel;
                if (prevRise) prevRise();
                (svg as unknown as { __riseCancel?: () => void }).__riseCancel = () => {
                  cancelAnimationFrame(riseRaf);
                };
              }, RITUAL_TIMING.REBOUND_PRESSURE_PAUSE_MS);
              // Stash so cleanup cancels the deferred rise.
              const prevPause = (svg as unknown as { __pauseTimer?: number }).__pauseTimer;
              if (prevPause) window.clearTimeout(prevPause);
              (svg as unknown as { __pauseTimer?: number }).__pauseTimer = pauseTimer;
            }
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
      attachTo(el: HTMLElement | null) {
        const svg = svgRef.current;
        const rebound = reboundBeamRef.current;
        const node = reboundNodeRef.current;
        if (!svg || !rebound || !node) return;
        // Cancel any existing follow before starting a new one.
        const prevFollow = (svg as unknown as { __followCancel?: () => void }).__followCancel;
        if (prevFollow) prevFollow();
        if (!el) {
          (svg as unknown as { __followCancel?: () => void }).__followCancel = undefined;
          return;
        }
        let followRaf = 0;
        let prevTopY = Number(rebound.getAttribute('y2') ?? '0');
        let prevBottomY = Number(rebound.getAttribute('y1') ?? '0');
        let initialized = prevTopY > 0;
        const follow = () => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) {
            followRaf = requestAnimationFrame(follow);
            return;
          }
          const popupCenterX = r.left + r.width / 2;
          const popupBottomY = r.bottom - 6;
          const groundY = popupBottomY + RITUAL_TIMING.REBOUND_RISE_DISTANCE_PX;
          if (!initialized) {
            prevTopY = popupBottomY;
            prevBottomY = groundY;
            initialized = true;
          }
          const smoothTop = prevTopY * 0.55 + popupBottomY * 0.45;
          const smoothBottom = prevBottomY * 0.55 + groundY * 0.45;
          prevTopY = smoothTop;
          prevBottomY = smoothBottom;
          rebound.setAttribute('x1', String(popupCenterX));
          rebound.setAttribute('y1', String(smoothBottom));
          rebound.setAttribute('x2', String(popupCenterX));
          rebound.setAttribute('y2', String(smoothTop));
          // Ensure visible (in case attachTo is called before rise
          // fully ran — e.g. cached selection).
          rebound.style.opacity = '1';
          node.style.opacity = '1';
          node.setAttribute('r', '6');
          node.setAttribute('cx', String(popupCenterX));
          node.setAttribute('cy', String(smoothTop));
          followRaf = requestAnimationFrame(follow);
        };
        followRaf = requestAnimationFrame(follow);
        (svg as unknown as { __followCancel?: () => void }).__followCancel = () => {
          cancelAnimationFrame(followRaf);
        };
      },
      retract() {
        // Called on popup dismiss. Collapse the vertical beam back
        // into the property and fade it out. Node retracts with it.
        const svg = svgRef.current;
        const rebound = reboundBeamRef.current;
        const node = reboundNodeRef.current;
        if (!svg || !rebound || !node) return;
        // Cancel any in-flight animations so we don't fight them.
        const riseCancel = (svg as unknown as { __riseCancel?: () => void }).__riseCancel;
        if (riseCancel) riseCancel();
        const followCancel = (svg as unknown as { __followCancel?: () => void }).__followCancel;
        if (followCancel) followCancel();
        const pauseTimer = (svg as unknown as { __pauseTimer?: number }).__pauseTimer;
        if (pauseTimer) window.clearTimeout(pauseTimer);
        // Read current position to animate from.
        const y1 = Number(rebound.getAttribute('y1') ?? '0');
        const y2 = Number(rebound.getAttribute('y2') ?? '0');
        const startY = y2;
        const endY = y1; // collapse back to anchor point
        const startTime = performance.now();
        const dur = RITUAL_TIMING.REBOUND_BEAM_RETRACT_MS;
        let retractRaf = 0;
        const step = () => {
          const t = clamp((performance.now() - startTime) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - t, 2);
          const y = startY + (endY - startY) * eased;
          rebound.setAttribute('y2', String(y));
          node.setAttribute('cy', String(y));
          // Fade as it retracts.
          rebound.style.opacity = String(1 - eased);
          node.style.opacity = String(1 - eased);
          if (t < 1) {
            retractRaf = requestAnimationFrame(step);
          } else {
            rebound.style.opacity = '0';
            node.style.opacity = '0';
          }
        };
        retractRaf = requestAnimationFrame(step);
        (svg as unknown as { __retractRaf?: number }).__retractRaf = retractRaf;
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
        {/* Vertical rebound beam — rises from impact point after the
            tether arrives. Sits beneath the popup as the umbilical.
            Greg locked 2026-05-28: design-intelligence breakthrough. */}
        <line
          ref={reboundBeamRef}
          x1={0}
          y1={0}
          x2={0}
          y2={0}
          stroke="#00FF94"
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0}
          style={{
            filter: 'drop-shadow(0 0 6px rgba(0,255,148,0.55))',
          }}
        />
        {/* Information node — sits at the top of the rebound beam.
            Subtle glow; the popup masks it on arrival. v1 placeholder;
            v2 becomes a real Blender/SAM-3D asset per design-intelligence
            thesis (the spatial anchor; popup is the information surface). */}
        <circle
          ref={reboundNodeRef}
          cx={0}
          cy={0}
          r={2}
          fill="#00FF94"
          opacity={0}
          style={{
            filter: 'drop-shadow(0 0 10px rgba(0,255,148,0.7))',
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
