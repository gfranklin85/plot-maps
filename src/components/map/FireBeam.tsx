'use client';

// FireBeam — proof-of-concept selection animation for the 3D photoreal
// surface.
//
// User presses A. The beam launches from the reticle (top of the
// visual) and extends downward toward where the target sits on screen
// (below the reticle, because the target is on the ground below the
// camera). Two modes:
//
//   - SWEEP: tap A. Beam extends ~400ms, lands, fades after ~250ms.
//     Use for rapid prospecting — fire on a property and keep flying.
//   - TETHER: hold A. Beam extends, lands, and STAYS. Persists for as
//     long as the popup is open (or until forcibly cleared). Use for
//     focused inquiry — read the data, make the call, take the action,
//     beam holds the visual connection the whole time.
//
// This is the PROOF version. No 3D math, no assets. Pure SVG line in
// a transparent fixed overlay. Once the verb is proven, we replace
// this with the real visual (whatever Greg lands on — energy beam,
// surveyor's instrument, etc).
//
// Coordinate model for v1: the beam's START is the reticle pixel
// (provided by parent). The END is a derived screen pixel that
// represents "where the ground target sits on screen right now."
// For the proof we approximate it by dropping straight down from the
// reticle by an amount proportional to camera pitch (steeper pitch =
// target is closer to the reticle vertically; level pitch = target is
// far below the reticle on screen). Real inverse-projection will
// replace this approximation later, but the timing + feedback feel
// gets validated by this approximation alone.

import { useEffect, useRef, useState } from 'react';

export type FireBeamMode = 'sweep' | 'tether';

export interface FireBeamShot {
  /** Unique key so the parent can fire multiple shots in succession
   *  without React confusing one for the other. */
  id: number;
  /** Reticle screen position when the shot fired. */
  startX: number;
  startY: number;
  /** End screen position (where the ground target lands on screen). */
  endX: number;
  endY: number;
  /** Sweep = transient. Tether = persists. */
  mode: FireBeamMode;
}

interface Props {
  /** Currently-active shots. Parent appends a new entry on A-press;
   *  the FireBeam component drives the animation and self-prunes
   *  sweep shots when their fade-out completes. */
  shots: FireBeamShot[];
  /** Called when a sweep shot's animation has fully completed so the
   *  parent can prune it from `shots`. */
  onShotComplete?: (id: number) => void;
  /** Called when a tether shot is explicitly cleared (e.g. popup
   *  closes). Parent invokes by removing the shot from `shots`. */
}

// Animation timings (proof tuning; revisit when designing the final
// visual).
const TRAVEL_MS = 380;          // beam extends from start → end
const LAND_FLASH_MS = 120;      // brief on-arrival flash
const SWEEP_FADE_MS = 280;      // sweep mode fade after landing
const TOTAL_SWEEP_MS = TRAVEL_MS + LAND_FLASH_MS + SWEEP_FADE_MS;

export default function FireBeam({ shots, onShotComplete }: Props) {
  return (
    <svg
      className="pointer-events-none fixed inset-0 w-full h-full"
      style={{ zIndex: 40 }}
      aria-hidden="true"
    >
      <defs>
        <filter id="fire-beam-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {shots.map((shot) => (
        <FireBeamShotSvg
          key={shot.id}
          shot={shot}
          onComplete={() => onShotComplete?.(shot.id)}
        />
      ))}
    </svg>
  );
}

interface ShotProps {
  shot: FireBeamShot;
  onComplete: () => void;
}

/**
 * One shot. Drives its own animation via requestAnimationFrame.
 * Sweep shots auto-complete; tether shots stay at full visibility
 * until the parent removes them from the shots array.
 */
function FireBeamShotSvg({ shot, onComplete }: ShotProps) {
  // Progress: 0..1 = travel phase, 1+ = post-landing.
  // Initial value is NOT 0 — we seed it at ~0.15 (a small head-start)
  // so the beam is already extending on the very first frame the user
  // sees, instead of being invisible on frame 1 + invisible on frame 2
  // until React's effect-RAF chain finally kicks in. Removes the
  // perceived input-to-display lag.
  const [progress, setProgress] = useState(0.15);
  // Seed startTs at mount time so the elapsed math accounts for the
  // head-start. Mount time = now - (0.15 * TRAVEL_MS).
  const startTsRef = useRef<number | null>(typeof performance !== 'undefined'
    ? performance.now() - 0.15 * TRAVEL_MS
    : null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    function tick(ts: number) {
      if (startTsRef.current == null) startTsRef.current = ts;
      const elapsed = ts - startTsRef.current;

      if (elapsed < TRAVEL_MS) {
        // Travel phase: ease-out so the beam decelerates as it lands.
        const t = elapsed / TRAVEL_MS;
        const eased = 1 - Math.pow(1 - t, 3);
        setProgress(eased);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // Landed.
      setProgress(1);

      if (shot.mode === 'tether') {
        // Tether mode just holds at full visibility. Parent controls
        // when to remove it from `shots`. No more RAF needed.
        return;
      }

      // Sweep mode: continue through the flash + fade phases.
      if (elapsed < TRAVEL_MS + LAND_FLASH_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (elapsed < TOTAL_SWEEP_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      // Done.
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot.id, shot.mode]);

  // Compute the beam endpoint by lerping from start to end based on
  // progress. The line "extends" from start toward end during travel.
  const currentX = shot.startX + (shot.endX - shot.startX) * progress;
  const currentY = shot.startY + (shot.endY - shot.startY) * progress;

  // Visual opacity: full during travel + flash, then fade for sweep.
  const fadeOpacity = (() => {
    if (shot.mode === 'tether') return 1;
    if (startTsRef.current == null) return 0;
    const elapsed = performance.now() - startTsRef.current;
    if (elapsed < TRAVEL_MS + LAND_FLASH_MS) return 1;
    const fadeT = (elapsed - TRAVEL_MS - LAND_FLASH_MS) / SWEEP_FADE_MS;
    return Math.max(0, 1 - fadeT);
  })();

  // Landed flash: a brief circular pulse at the endpoint right when
  // the beam arrives, then fades.
  const landed = progress >= 1;

  return (
    <g style={{ opacity: fadeOpacity }} filter="url(#fire-beam-glow)">
      <line
        x1={shot.startX}
        y1={shot.startY}
        x2={currentX}
        y2={currentY}
        stroke="#F4C97F"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.92}
      />
      {/* A second, brighter inner line for some depth. */}
      <line
        x1={shot.startX}
        y1={shot.startY}
        x2={currentX}
        y2={currentY}
        stroke="#FFF5DC"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* On-landing flash. */}
      {landed && (
        <>
          <circle cx={shot.endX} cy={shot.endY} r={14} fill="#F4C97F" opacity={0.28} />
          <circle cx={shot.endX} cy={shot.endY} r={6} fill="#FFF5DC" opacity={0.85} />
        </>
      )}
    </g>
  );
}
