'use client';

// ── useZoneFlight ─────────────────────────────────────────────────────
//
// THE "Cruise" mobile flight mode (Greg, 2026-07-15) — the SECOND mode, on top
// of Google's native controls. Google still OWNS look (one-finger drag anywhere
// turns/tilts the camera). We overlay two INVISIBLE bottom thumb-zones:
//
//   • PAN zone (bottom-left)  — press to CRUISE forward like a helo; the craft
//     keeps moving while held (unlike Google, which stops when you stop). Slide
//     up = faster, down = slow/reverse, left/right = strafe. Writes ly + lx.
//   • CLIMB zone (bottom-right) — press up = ascend, down = descend, continuous
//     while held. Writes rt / lt.
//
// The key difference from useTetherFlight: a BASE FLOOR on press. A tether
// square only moved while you PULLED it; a cruise zone moves the instant you
// touch it (press = held nonzero input), so a plain press already flies/climbs.
//
// We NEVER write look axes (rx/ry) — those stay Google's, so cruise + native
// look compose (see MapView3D's mobileCruise write branch, which reads Google's
// live heading/tilt as the baseline and only writes position). Writes the
// synthetic gamepad each frame. memory/project_mobile_map_google_native

import { useCallback, useEffect, useRef } from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';

const ZONE_RANGE = 90;   // px slide = full extra speed (beyond the base floor)
const ZONE_DEAD = 3;     // px dead-zone
const ZONE_CURVE = 1.3;  // >1 = slide farther, accelerate more
const CRUISE_BASE = 0.35; // press-with-no-slide throttle ("at least a helo")
const CLIMB_BASE = 0.4;   // press-with-no-slide climb magnitude

// Optional: horizontal slide in the PAN zone also yaws (turns) the heading.
// OFF by default — yaw would WRITE el.heading, an exception to "Google owns
// look." Flip on only if Greg confirms he wants thumb-only turning.
const PAN_YAW = false;

// shape a signed slide distance (px) into a 0..1 magnitude (unsigned scale)
function shapeMag(px: number): number {
  const a = Math.abs(px);
  if (a <= ZONE_DEAD) return 0;
  const n = Math.min(1, (a - ZONE_DEAD) / (ZONE_RANGE - ZONE_DEAD));
  return Math.pow(n, ZONE_CURVE);
}

// shape a signed slide distance (px) into a −1..1 axis value (signed)
function shapeSigned(px: number): number {
  return shapeMag(px) * Math.sign(px);
}

export interface ZoneState {
  pan: { active: boolean; dx: number; dy: number };
  climb: { active: boolean; dy: number };
}

export function useZoneFlight(enabled: boolean) {
  const state = useRef<ZoneState>({
    pan: { active: false, dx: 0, dy: 0 },
    climb: { active: false, dy: 0 },
  });

  // offset from the press origin (px), reported by the zone component
  const setPan = useCallback((active: boolean, dx: number, dy: number) => {
    state.current.pan = { active, dx, dy };
  }, []);
  const setClimb = useCallback((active: boolean, dy: number) => {
    state.current.climb = { active, dy };
  }, []);

  // RAF writer: while a zone is pressed, hold a nonzero axis (base floor +
  // slide). Release → NEUTRAL → the loop's throttle decays and it goes quiet.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      const f: PadFrame = { ...NEUTRAL };
      const s = state.current;

      if (s.pan.active) {
        // Forward cruise: drag UP (dy<0) = faster. Loop does throttle += -ly,
        // and forward = negative ly, so up-drag must make ly MORE negative.
        // Base floor even at zero slide → press-to-cruise. dy<0 adds forward,
        // dy>0 (drag down) subtracts → slow, then reverse.
        const fwd = CRUISE_BASE + shapeSigned(-s.pan.dy);   // −slide: down reduces
        f.ly = -Math.max(-1, Math.min(1, fwd));
        // Horizontal slide → strafe (default) OR yaw (if PAN_YAW). One or the
        // other, never both — pan zone is forward/back + strafe; turning is
        // Google-native unless Greg opts into thumb-yaw.
        if (PAN_YAW) f.rx = shapeSigned(s.pan.dx);
        else f.lx = shapeSigned(s.pan.dx);
      }

      if (s.climb.active) {
        // Drag UP (dy<0) = ascend. Base floor → press-to-climb.
        const up = CLIMB_BASE + shapeSigned(-s.climb.dy);
        const c = Math.max(-1, Math.min(1, up));
        f.rt = c > 0 ? c : 0;   // ascend
        f.lt = c < 0 ? -c : 0;  // descend
      }

      pushTouchFrame(f);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); pushTouchFrame({ ...NEUTRAL }); };
  }, [enabled]);

  return { setPan, setClimb, state };
}
