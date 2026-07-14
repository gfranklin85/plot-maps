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

const PAN_RANGE = 78;    // px offset from neutral = full-speed pan
const PAN_DEAD = 5;      // px dead-zone so a still finger doesn't creep
const PAN_CURVE = 1.5;   // >1 = slide farther, accelerate MORE (Greg 2026-07-14)
const LOOK_GAIN = 1 / 12;   // px of look-swipe per frame → look axis
const LOOK_DECAY = 0.6;     // look rate decays when the finger stops
const CLIMB_GAIN = 1 / 90;  // px of 2-finger vertical drag → climb axis (held)
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

// PAN as a VECTOR, not two clamped axes (Greg's CD/cross insight, 2026-07-14):
// the finger doesn't sit on X or Y — it sits at an ANGLE + DISTANCE from
// neutral (the full 360° plane). So we shape the MAGNITUDE (dead-zone → curve
// → cap) and keep the exact direction. Fixes diagonal over-speed (two clamped
// axes maxed a corner drag at 1.41×) and makes "slide more = faster in THAT
// direction" true. Returns {x,y} = the pan vector components, each −1..1.
function panVector(dx: number, dy: number): { x: number; y: number } {
  const dist = Math.hypot(dx, dy);
  if (dist <= PAN_DEAD) return { x: 0, y: 0 };
  const n = Math.min(1, (dist - PAN_DEAD) / (PAN_RANGE - PAN_DEAD));
  const speed = Math.pow(n, PAN_CURVE);   // accelerate more the farther you slide
  const ux = dx / dist, uy = dy / dist;   // unit direction (preserves the angle)
  return { x: ux * speed, y: uy * speed };
}

interface Pt { id: number; x0: number; y0: number; x: number; y: number; }

export function useGestureFlight(enabled: boolean) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  // active touches in the order they landed. [0] = pan, [1..] = look/climb.
  const pts = useRef<Pt[]>([]);
  const look = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  // live pan trail (neutral origin → current), for the on-screen indicator.
  const panTrail = useRef<{ active: boolean; x0: number; y0: number; x: number; y: number }>(
    { active: false, x0: 0, y0: 0, x: 0, y: 0 });
  const attach = useCallback((node: HTMLElement | null) => setEl(node), []);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      const f: PadFrame = { ...NEUTRAL };
      const list = pts.current;

      // AXIS MAP — matches the LIVE flight loop (MapView3D ~line 1181):
      //   lx = strafe · ly = forward/reverse (throttle) · rx = yaw
      //   ry = pitch (look up/down) · rt = ascend · lt = descend
      // (The old comment there was stale; verified against the real code.)

      // ── PAN (first finger) = a throttle VECTOR from its neutral press point.
      if (list[0]) {
        const p = list[0];
        const v = panVector(p.x - p.x0, p.y - p.y0); // −1..1 each, direction kept
        f.lx = v.x;                           // strafe (+ = right)
        // forward = drag UP (screen −y). Throttle is `ly` with `air.throttle
        // += -ly`, so drag UP must give ly NEGATIVE → forward. v.y is + when
        // dragging down, so ly = v.y (down → +ly → reverse; up → −ly → fwd).
        f.ly = v.y;
        panTrail.current = { active: true, x0: p.x0, y0: p.y0, x: p.x, y: p.y };
      } else if (panTrail.current.active) {
        panTrail.current.active = false;
      }

      // ── extra fingers ──
      const extra = list.slice(1);
      if (extra.length === 1) {
        // LOOK — swipe-style: yaw = rx, pitch = ry. Apply, then decay.
        f.rx = clamp(look.current.yaw);
        f.ry = clamp(look.current.pitch);
        look.current.yaw *= LOOK_DECAY;
        look.current.pitch *= LOOK_DECAY;
        if (Math.abs(look.current.yaw) < 0.002) look.current.yaw = 0;
        if (Math.abs(look.current.pitch) < 0.002) look.current.pitch = 0;
      } else if (extra.length >= 2) {
        // CLIMB — 2 fingers dragged vertically. Ascend = rt, descend = lt.
        const avgDy = (extra[0].y - extra[0].y0 + (extra[1].y - extra[1].y0)) / 2;
        const climb = clamp(-avgDy * CLIMB_GAIN); // drag up = climb
        f.rt = climb > 0 ? climb : 0;
        f.lt = climb < 0 ? -climb : 0;
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

    // Don't preventDefault the START — a stationary touch stays a TAP so
    // Google's gmp-click fires and selects a parcel. We only take over (and
    // preventDefault) once the finger actually MOVES (a gesture).
    const onStart = (e: TouchEvent) => { sync(e); };
    const onMove = (e: TouchEvent) => {
      // accumulate LOOK delta on the 2nd finger BEFORE updating stored pos
      const list = pts.current;
      if (list.length === 2) {
        const lookPt = list[1];
        const t = Array.from(e.touches).find((x) => x.identifier === lookPt.id);
        if (t) {
          // "grab the ground and slide it" — BOTH axes negate the finger delta,
          // so drag-right spins the world right and drag-up pitches up, matching
          // the vertical feel (Greg 2026-07-14: horizontal was inverted).
          look.current.yaw += -(t.clientX - lookPt.x) * LOOK_GAIN;
          look.current.pitch += -(t.clientY - lookPt.y) * LOOK_GAIN;
        }
      }
      // update all stored positions
      for (const t of Array.from(e.touches)) {
        const p = pts.current.find((q) => q.id === t.identifier);
        if (p) { p.x = t.clientX; p.y = t.clientY; }
      }
      e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => { sync(e); if (e.touches.length === 0) { pts.current = []; look.current = { yaw: 0, pitch: 0 }; } };

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

  // the live pan trail ref (neutral origin → current finger), read per-frame
  // by the on-screen indicator. Stable across renders.
  return { attach, panTrail };
}
