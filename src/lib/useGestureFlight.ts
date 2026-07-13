'use client';

// ── useGestureFlight ──────────────────────────────────────────────────
//
// NO-BUTTON gesture flight (Greg, 2026-07-12). Control is the TOUCHES, Windows
// Precision-Touchpad style — finger COUNT means something:
//
//   • 1 finger  = PAN. A floating THROTTLE (not a swipe): the press point is
//     neutral; the held OFFSET from it glides you continuously (forward/back
//     = gas/reverse, sideways = strafe), proportional to distance. Release =
//     stop.
//   • 2 fingers = PAN (1st finger) + LOOK (2nd finger). Look is a swipe-style
//     camera move (per-frame delta → yaw/pitch, low-pass smoothed, decays on
//     stop) — tuned to feel as smooth as Google's.
//   • 3 fingers = PAN (1st finger) + CLIMB (the 2nd+3rd fingers together drag
//     up/down = climb/dip).
//
// We OWN all touch on the map (one raw handler) so classification is reliable
// and look is ours end-to-end. Writes the synthetic gamepad every frame; the
// FLY_3D loop does the rest. Axis map (locked): lx=strafe, ly=pitch,
// rx=yaw, ry=climb, rt=gas, lt=reverse. memory/project_tilt_to_fly

import { useCallback, useEffect, useRef, useState } from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';

const PAN_RANGE = 70;    // px offset from neutral = full throttle/strafe
const PAN_DEAD = 5;      // px dead-zone so a still finger doesn't creep
const LOOK_GAIN = 1 / 12;   // px of look-swipe per frame → look axis
const LOOK_DECAY = 0.6;     // look rate decays when the finger stops
const CLIMB_GAIN = 1 / 90;  // px of 2-finger vertical drag → climb axis (held)
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function shapePan(px: number): number {
  const a = Math.abs(px);
  if (a <= PAN_DEAD) return 0;
  return clamp(((a - PAN_DEAD) / (PAN_RANGE - PAN_DEAD)) * Math.sign(px));
}

interface Pt { id: number; x0: number; y0: number; x: number; y: number; }

export function useGestureFlight(enabled: boolean) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  // active touches in the order they landed. [0] = pan, [1..] = look/climb.
  const pts = useRef<Pt[]>([]);
  const look = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const attach = useCallback((node: HTMLElement | null) => setEl(node), []);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      const f: PadFrame = { ...NEUTRAL };
      const list = pts.current;

      // ── PAN (first finger) = throttle from its neutral press point ──
      if (list[0]) {
        const p = list[0];
        const nx = shapePan(p.x - p.x0);      // + = right
        const ny = shapePan(p.y - p.y0);      // + = down (screen)
        f.lx = nx;                            // strafe
        // forward = drag UP (screen −y) → gas; drag DOWN → reverse
        const fwd = -ny;
        f.rt = fwd > 0 ? fwd : 0;
        f.lt = fwd < 0 ? -fwd : 0;
      }

      // ── extra fingers ──
      const extra = list.slice(1);
      if (extra.length === 1) {
        // LOOK — swipe-style: apply this frame's accumulated look, then decay.
        f.rx = clamp(look.current.yaw);   // yaw
        f.ly = clamp(look.current.pitch); // pitch
        look.current.yaw *= LOOK_DECAY;
        look.current.pitch *= LOOK_DECAY;
        if (Math.abs(look.current.yaw) < 0.002) look.current.yaw = 0;
        if (Math.abs(look.current.pitch) < 0.002) look.current.pitch = 0;
      } else if (extra.length >= 2) {
        // CLIMB — 2 fingers dragged vertically from where they landed (held).
        const avgDy = (extra[0].y - extra[0].y0 + (extra[1].y - extra[1].y0)) / 2;
        const climb = clamp(-avgDy * CLIMB_GAIN); // drag up = climb
        f.ry = climb;
        look.current.yaw = 0; look.current.pitch = 0;
      } else {
        look.current.yaw = 0; look.current.pitch = 0;
      }

      pushTouchFrame(f);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); pushTouchFrame({ ...NEUTRAL }); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !el) return;

    const findFromEvent = (e: TouchEvent) => Array.from(e.touches);

    const sync = (e: TouchEvent) => {
      const cur = findFromEvent(e);
      const curIds = new Set(cur.map((t) => t.identifier));
      // drop lifted
      pts.current = pts.current.filter((p) => curIds.has(p.id));
      // add new (append → preserves landing order; [0] stays pan)
      for (const t of cur) {
        let p = pts.current.find((q) => q.id === t.identifier);
        if (!p) {
          p = { id: t.identifier, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY };
          pts.current.push(p);
        }
      }
    };

    const onStart = (e: TouchEvent) => { sync(e); e.preventDefault(); };
    const onMove = (e: TouchEvent) => {
      // accumulate LOOK delta on the 2nd finger BEFORE updating stored pos
      const list = pts.current;
      if (list.length === 2) {
        const lookPt = list[1];
        const t = Array.from(e.touches).find((x) => x.identifier === lookPt.id);
        if (t) {
          look.current.yaw += (t.clientX - lookPt.x) * LOOK_GAIN;
          look.current.pitch += -(t.clientY - lookPt.y) * LOOK_GAIN; // drag up = pitch up
        }
      }
      // update all stored positions
      for (const t of Array.from(e.touches)) {
        const p = pts.current.find((q) => q.id === t.identifier);
        if (p) { p.x = t.clientX; p.y = t.clientY; }
      }
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => { sync(e); if (e.touches.length === 0) { pts.current = []; look.current = { yaw: 0, pitch: 0 }; } e.preventDefault(); };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: false });
    el.addEventListener('touchcancel', onEnd, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, el]);

  return { attach };
}
