'use client';

// ── useTetherFlight ───────────────────────────────────────────────────
//
// THE mobile flight model (Greg, 2026-07-14): Google's native controls own
// the WHOLE screen (one-finger look/pan/rotate, pinch-zoom) — and we overlay
// just two BUNGEE-TETHER squares:
//
//   • PAN square  — a 2D tether: drag up/down = fly forward/back, left/right
//     = strafe. Writes lx (strafe) + ly (throttle).
//   • CLIMB square — a vertical tether: drag up/down = ascend/descend. Writes
//     rt (ascend) / lt (descend).
//
// Each square is pressed and PULLED away from its home like a rubber band; the
// offset (shaped by distance → speed) drives the axis, and it snaps home on
// release. We NEVER write look axes (rx/ry) — those stay Google's — and the
// flight loop's idle-return means whenever both squares are neutral, nothing
// touches the camera and Google's native gestures move it freely.
//
// The squares capture their OWN pointer only (they're small fixed overlays),
// so the hamburger and the rest of the map (Google) get every other touch.
// Writes the synthetic gamepad each frame. memory/project_tilt_to_fly

import { useCallback, useEffect, useRef } from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';

const TETHER_RANGE = 56;  // px pull = full-speed (small → light touch flies)
const TETHER_DEAD = 4;    // px dead-zone
const TETHER_CURVE = 1.4; // >1 = pull farther, accelerate more

// shape a signed pull distance (px) into a −1..1 axis value
function shape(px: number): number {
  const a = Math.abs(px);
  if (a <= TETHER_DEAD) return 0;
  const n = Math.min(1, (a - TETHER_DEAD) / (TETHER_RANGE - TETHER_DEAD));
  return Math.pow(n, TETHER_CURVE) * Math.sign(px);
}

export interface TetherState {
  // live pull offset for each square (px from home), for the rubber-band knob
  pan: { active: boolean; dx: number; dy: number };
  climb: { active: boolean; dy: number };
}

export function useTetherFlight(enabled: boolean) {
  // live pull state (refs so the RAF + knobs read without re-render)
  const state = useRef<TetherState>({
    pan: { active: false, dx: 0, dy: 0 },
    climb: { active: false, dy: 0 },
  });

  // called by the square components on drag (px offset from the square's home)
  const setPan = useCallback((active: boolean, dx: number, dy: number) => {
    state.current.pan = { active, dx, dy };
  }, []);
  const setClimb = useCallback((active: boolean, dy: number) => {
    state.current.climb = { active, dy };
  }, []);

  // RAF writer: pull offsets → pad axes. lx/ly for pan, rt/lt for climb.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      const f: PadFrame = { ...NEUTRAL };
      const s = state.current;
      if (s.pan.active) {
        f.lx = shape(s.pan.dx);          // + = strafe right
        f.ly = shape(s.pan.dy);          // + = drag down = reverse (loop: throttle += -ly)
      }
      if (s.climb.active) {
        const c = shape(-s.climb.dy);    // drag UP (dy<0) = ascend
        f.rt = c > 0 ? c : 0;
        f.lt = c < 0 ? -c : 0;
      }
      pushTouchFrame(f);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); pushTouchFrame({ ...NEUTRAL }); };
  }, [enabled]);

  return { setPan, setClimb, state };
}
