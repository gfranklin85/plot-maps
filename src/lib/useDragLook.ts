'use client';

// ── useDragLook (pan + climb → flight loop; LOOK is Google's) ──────────
//
// The DEFAULT mobile flight style (Greg, 2026-07-12, corrected):
//   • LOOK is GOOGLE'S NATIVE control — a finger on the map moves the camera
//     around the normal way. We do NOT intercept it, do NOT preventDefault,
//     add nothing (no inversion, no custom math). Google owns look + pinch.
//   • PAN (small blue ball) + CLIMB (small blue ball) drive forward/strafe +
//     climb through the flight loop. They capture their OWN touch; the rest of
//     the map is Google's look.
//
// So this hook is just the FRAME WRITER: it merges the pan stick + climb into
// the synthetic gamepad every frame (RAF) so the FLY_3D loop moves you, while
// Google handles the look untouched. memory/project_tilt_to_fly

import { useCallback, useEffect, useRef } from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';
import type { StickAxes } from '@/lib/useTiltFly';

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export interface DragLook {
  enabled: boolean;
  /** the PAN ball publishes strafe/forward here. */
  setStickAxes: (a: StickAxes) => void;
  /** the CLIMB ball publishes here (−1..1; + = climb, − = dip). */
  setClimb: (c: number) => void;
}

export function useDragLook(enabled: boolean): DragLook {
  const stick = useRef<StickAxes>({ lx: 0, ly: 0, rx: 0, ry: 0 });
  const climb = useRef(0);

  const setStickAxes = useCallback((a: StickAxes) => { stick.current = a; }, []);
  const setClimb = useCallback((c: number) => { climb.current = clamp(c); }, []);

  // RAF writer while enabled: pan + climb → pad frame. LOOK axes stay 0 (Google
  // owns look), so we never fight Google's camera. Forward = ly (from the ball).
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      const f: PadFrame = { ...NEUTRAL };
      const s = stick.current;
      f.lx = s.lx; f.ly = s.ly;
      const c = climb.current;
      f.rt = c > 0 ? c : 0;
      f.lt = c < 0 ? -c : 0;
      pushTouchFrame(f);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); pushTouchFrame({ ...NEUTRAL }); };
  }, [enabled]);

  return { enabled, setStickAxes, setClimb };
}
