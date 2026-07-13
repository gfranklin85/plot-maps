'use client';

// ── useDragLook (finger-move = LOOK) ──────────────────────────────────
//
// The DEFAULT mobile flight style (Greg, 2026-07-12): left thumb PANS, a
// finger MOVING on the screen LOOKS (mouselook), a small ball CLIMBs. It
// FLIES — the feel we sell — vs. a static 3D world (that's Google's job).
//
// LOOK is DRAG-TO-ROTATE, RELEASED = HOLD: moving the finger rotates the
// camera by that motion; stop moving and the camera holds its heading; lift
// and it stays. So we feed the flight loop a per-frame look RATE derived from
// the finger's DELTA (not an absolute offset — that would be a spring-back
// stick). The rate decays to 0 when the finger isn't moving, so a still
// finger = no turn. This is NOT dragging the map (that's Google's pan, a
// separate style); we preventDefault single-finger so Google's gesture never
// fights our look.
//
// Two-finger = hands off → Google's native pinch-zoom. Tap (no move) doesn't
// touch look, so gmp-click still selects a parcel. Listens on the gmp-map-3d
// element so multi-touch falls through cleanly. memory/project_phone_as_controller

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';
import type { StickAxes } from '@/lib/useTiltFly';

// Look sensitivity: px of finger motion (per frame) → look-axis magnitude.
// ~14px of movement in a frame ≈ full-rate look; tune to taste.
const LOOK_GAIN = 1 / 14;
// How fast the look rate decays when the finger stops moving (per frame at
// 60fps). 0.55 = snappy hold (stops ~4 frames after the finger stops).
const LOOK_DECAY = 0.55;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export interface DragLook {
  enabled: boolean;
  /** the PAN stick publishes here so drag-look merges it into the frame. */
  setStickAxes: (a: StickAxes) => void;
  /** the climb ball publishes here (−1..1; + = climb, − = dip). */
  setClimb: (c: number) => void;
  /** live look rate for any UI hint (−1..1). */
  look: React.MutableRefObject<{ rx: number; ry: number }>;
  /** attach to the gmp-map-3d element (forwarded ref). */
  attach: (el: HTMLElement | null) => void;
}

export function useDragLook(enabled: boolean): DragLook {
  const stick = useRef<StickAxes>({ lx: 0, ly: 0, rx: 0, ry: 0 });
  const climb = useRef(0);
  const look = useRef<{ rx: number; ry: number }>({ rx: 0, ry: 0 });
  const [el, setEl] = useState<HTMLElement | null>(null);
  // active finger: last-seen position, so each move yields a delta.
  const active = useRef<{ id: number; x: number; y: number } | null>(null);

  const setStickAxes = useCallback((a: StickAxes) => { stick.current = a; }, []);
  const setClimb = useCallback((c: number) => { climb.current = clamp(c); }, []);

  const write = useCallback(() => {
    const f: PadFrame = { ...NEUTRAL };
    const s = stick.current;
    f.lx = s.lx; f.ly = s.ly;
    f.rx = clamp(s.rx + look.current.rx);
    f.ry = clamp(s.ry + look.current.ry);
    const c = climb.current;
    f.rt = c > 0 ? c : 0;
    f.lt = c < 0 ? -c : 0;
    pushTouchFrame(f);
    // Decay the look rate toward 0 each frame — a still finger stops the turn
    // (camera holds its heading), a lifted finger stops it entirely.
    look.current.rx *= LOOK_DECAY;
    look.current.ry *= LOOK_DECAY;
    if (Math.abs(look.current.rx) < 0.002) look.current.rx = 0;
    if (Math.abs(look.current.ry) < 0.002) look.current.ry = 0;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => { write(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); pushTouchFrame({ ...NEUTRAL }); };
  }, [enabled, write]);

  const attach = useCallback((node: HTMLElement | null) => { setEl(node); }, []);

  useEffect(() => {
    if (!enabled || !el) return;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { active.current = null; look.current = { rx: 0, ry: 0 }; return; }
      const t = e.touches[0];
      active.current = { id: t.identifier, x: t.clientX, y: t.clientY };
      // don't set look on start — a tap (no move) must stay a tap (select).
    };
    const onMove = (e: TouchEvent) => {
      // multi-touch → let Google pinch-zoom; stop looking
      if (e.touches.length >= 2) { active.current = null; look.current = { rx: 0, ry: 0 }; return; }
      const a = active.current; if (!a) return;
      const t = Array.from(e.touches).find((x) => x.identifier === a.id);
      if (!t) return;
      const dx = t.clientX - a.x;   // finger DELTA since last move
      const dy = t.clientY - a.y;
      a.x = t.clientX; a.y = t.clientY;
      // move right → yaw right; move up → pitch up. Additive so a fast flick
      // turns more; the RAF decay makes it hold when the finger settles.
      look.current.rx = clamp(look.current.rx + dx * LOOK_GAIN);
      look.current.ry = clamp(look.current.ry - dy * LOOK_GAIN);
      e.preventDefault(); // suppress Google's single-finger gesture; we own look
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) active.current = null; // decay handles the stop
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, el]);

  return { enabled, setStickAxes, setClimb, look, attach };
}
