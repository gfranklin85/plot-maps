'use client';

// ── TiltEdgeIndicator ─────────────────────────────────────────────────
//
// A thin "liquid border" around the map that reads the LIVE tilt values and
// shows how much you're climbing/turning — so you can feel neutral vs. drift
// without crowding the map (Greg, 2026-07-12).
//
//   • LEFT + RIGHT edges  = CLIMB/DIP (tilt fwd/back). Lines grow from the
//     center of the edge: up when climbing, down when dipping.
//   • TOP + BOTTOM edges  = TURN (tilt left/right). Lines grow from center
//     toward the direction you're turning.
//
// "Grow from center" + nearly-invisible at neutral (a whisper nub), extending
// + brightening proportionally as you tilt (a tempered pedal). Driven by its
// own RAF off tilt.live — no React re-render per frame. Only mounts in the
// one-hand (tilt) flight style. memory/project_tilt_to_fly

import { useEffect, useRef } from 'react';
import type { TiltFly } from '@/lib/useTiltFly';

export default function TiltEdgeIndicator({ tilt }: { tilt: TiltFly }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    const loop = () => {
      const { climb, yaw } = tilt.live.current; // −1..1 each
      // climb → vertical edges (left/right). +climb = up.
      root.style.setProperty('--tei-climb', climb.toFixed(3));
      root.style.setProperty('--tei-climb-abs', Math.abs(climb).toFixed(3));
      root.style.setProperty('--tei-climb-sign', climb >= 0 ? '1' : '-1');
      // yaw → horizontal edges (top/bottom). +yaw = right.
      root.style.setProperty('--tei-yaw', yaw.toFixed(3));
      root.style.setProperty('--tei-yaw-abs', Math.abs(yaw).toFixed(3));
      root.style.setProperty('--tei-yaw-sign', yaw >= 0 ? '1' : '-1');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tilt]);

  return (
    <div ref={rootRef} className="tei" aria-hidden>
      {/* vertical edges = climb/dip. The fill grows from center; direction of
          growth flips with climb sign (handled in CSS via --tei-climb-sign). */}
      <div className="tei-edge tei-edge--left"><span className="tei-fill tei-fill--v" /></div>
      <div className="tei-edge tei-edge--right"><span className="tei-fill tei-fill--v" /></div>
      {/* horizontal edges = turn */}
      <div className="tei-edge tei-edge--top"><span className="tei-fill tei-fill--h" /></div>
      <div className="tei-edge tei-edge--bottom"><span className="tei-fill tei-fill--h" /></div>
    </div>
  );
}
