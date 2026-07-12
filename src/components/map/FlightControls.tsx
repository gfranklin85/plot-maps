'use client';

// ── FlightControls ────────────────────────────────────────────────────
//
// The mobile flight-control panel (Greg's mockups, 2026-07-11). Translucent
// glass, PlotMaps palette. Two styles:
//
//   • 'sticks': PAN joystick (left, strafe/forward) · LOOK joystick (right,
//     yaw/pitch). CLIMB comes from TILT-FLY (tilt the phone forward/back)
//     while a thumb is on a stick — no center slider, no ring (both removed;
//     they sat in the sightline / conflicted). memory/project_tilt_to_fly.
//   • 'zones' (the original zone pad, kept — it works well).
//
// Tilt calibration (a 3-2-1 "set your level" countdown, LOCKED after): first
// stick touch of the session kicks it once; a DOUBLE-TAP on a knob re-runs it
// for your current pose. Neutral never moves on its own.
//
// Both write the synthetic gamepad via pushTouchFrame() so Plot's existing
// flight loop drives FLY_3D unchanged. memory/project_phone_as_controller.

import { useCallback, useEffect, useRef } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';
import type { TiltFly } from '@/lib/useTiltFly';
import TouchZonePad from './TouchZonePad';

const KNOB_RANGE = 42;      // px knob deflection = full stick
const DOUBLE_TAP_MS = 320;  // knob double-tap window → re-calibrate tilt

export type ControlStyle = 'sticks' | 'zones';

interface Props {
  style: ControlStyle;
  tilt?: TiltFly;
}

// ── the stick panel (mockup) ──
// PAN (left) · LOOK (right). Climb = tilt-fly while a stick is held. No A/B
// (selection is tap), no center slider, no ring (Greg, 2026-07-11).
function StickPanel({ tilt }: { tilt?: TiltFly }) {
  const frame = useRef<PadFrame>({ ...NEUTRAL });
  const root = useRef<HTMLDivElement | null>(null);
  const leftBase = useRef<HTMLDivElement | null>(null);
  const rightBase = useRef<HTMLDivElement | null>(null);
  const leftKnob = useRef<HTMLDivElement | null>(null);
  const rightKnob = useRef<HTMLDivElement | null>(null);
  const grabs = useRef<Map<number, { side: 'left' | 'right'; cx: number; cy: number }>>(new Map());
  // stable tilt ref so the pointer effect doesn't re-bind when `tilt` changes
  const tiltRef = useRef<TiltFly | undefined>(tilt);
  tiltRef.current = tilt;
  const firstTouchDone = useRef(false);
  const lastTapAt = useRef(0);

  const push = useCallback(() => pushTouchFrame(frame.current), []);

  // Build the frame from the two knobs + the current tilt-climb value.
  const recompute = useCallback(() => {
    const f: PadFrame = { ...NEUTRAL };
    const rd = (el: HTMLDivElement | null) =>
      el ? { x: +(el.dataset.kx || 0), y: +(el.dataset.ky || 0) } : { x: 0, y: 0 };
    const l = rd(leftKnob.current), r = rd(rightKnob.current);
    f.lx = l.x; f.ly = -l.y;
    f.rx = r.x; f.ry = -r.y;
    const climb = tiltRef.current?.climbValue() ?? 0; // +up climb, −down dip
    f.rt = climb > 0 ? climb : 0;
    f.lt = climb < 0 ? -climb : 0;
    frame.current = f; push();
  }, [push]);

  const setKnob = useCallback((side: 'left' | 'right', nx: number, ny: number) => {
    const k = side === 'left' ? leftKnob.current : rightKnob.current;
    if (!k) return;
    k.dataset.kx = String(nx); k.dataset.ky = String(ny);
    k.style.transform = `translate(${(nx * KNOB_RANGE).toFixed(1)}px, ${(-ny * KNOB_RANGE).toFixed(1)}px)`;
    recompute();
  }, [recompute]);

  // While ANY thumb is on a stick, tilt-climb is ARMED and re-evaluated every
  // frame (climb comes from the sensor, not pointer moves), so the frame stays
  // fresh even when the thumb is still. When all thumbs lift, disarm + settle.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const anyDown = grabs.current.size > 0;
      tiltRef.current?.setArmed(anyDown);
      if (anyDown) recompute();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [recompute]);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const centerOf = (base: HTMLDivElement | null) => {
      if (!base) return null;
      const r = base.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r };
    };
    // Hit-test: whichever base the pointer is within → its knob.
    const hit = (x: number, y: number) => {
      for (const side of ['left', 'right'] as const) {
        const c = centerOf(side === 'left' ? leftBase.current : rightBase.current);
        if (!c) continue;
        if (Math.hypot(x - c.cx, y - c.cy) <= c.r.width / 2 + 12)
          return { side, cx: c.cx, cy: c.cy };
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      const g = hit(e.clientX, e.clientY); if (!g) return;
      grabs.current.set(e.pointerId, g);
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      setKnob(g.side, clamp((e.clientX - g.cx) / KNOB_RANGE), clamp(-(e.clientY - g.cy) / KNOB_RANGE));
      // Tilt calibration: DOUBLE-TAP a knob re-calibrates; the very FIRST
      // touch of the session calibrates once. Neutral never moves otherwise.
      const now = e.timeStamp || performance.now();
      const t = tiltRef.current;
      if (t?.supported) {
        if (now - lastTapAt.current < DOUBLE_TAP_MS) {
          void t.calibrate();
        } else if (!firstTouchDone.current) {
          firstTouchDone.current = true;
          void t.calibrate();
        }
      }
      lastTapAt.current = now;
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      const g = grabs.current.get(e.pointerId); if (!g) return;
      setKnob(g.side, clamp((e.clientX - g.cx) / KNOB_RANGE), clamp(-(e.clientY - g.cy) / KNOB_RANGE));
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      const g = grabs.current.get(e.pointerId); if (!g) return;
      grabs.current.delete(e.pointerId);
      setKnob(g.side, 0, 0);
      // If that was the last thumb, disarm tilt NOW so climb zeroes this frame
      // (don't wait for the RAF tick) — the knob recompute above already
      // re-read climb, so with armed=false it writes rt/lt = 0.
      if (grabs.current.size === 0) {
        tiltRef.current?.setArmed(false);
        setKnob(g.side, 0, 0);
      }
      e.preventDefault();
    };
    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp, { passive: false });
    el.addEventListener('pointercancel', onUp, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [setKnob]);

  const climbHint = tilt?.supported
    ? (tilt.calibrated ? '· tilt climbs' : '· 2-tap to set tilt')
    : '';

  return (
    <div ref={root} className="fc-sticks">
      {/* PAN. Drag the knob to strafe/forward. CLIMB = tilt the phone
          forward/back while a thumb is on a stick (calibrate: first touch or
          double-tap a knob). */}
      <div className="fc-stick">
        <div className="fc-stick__label">PAN <span className="fc-stick__sub">{climbHint}</span></div>
        <div ref={leftBase} className="fc-base">
          <MaterialIcon icon="keyboard_arrow_up" className="fc-arrow fc-arrow--up" />
          <MaterialIcon icon="keyboard_arrow_down" className="fc-arrow fc-arrow--down" />
          <MaterialIcon icon="keyboard_arrow_left" className="fc-arrow fc-arrow--left" />
          <MaterialIcon icon="keyboard_arrow_right" className="fc-arrow fc-arrow--right" />
          <div ref={leftKnob} className="fc-knob" data-kx="0" data-ky="0" />
        </div>
      </div>

      {/* LOOK */}
      <div className="fc-stick">
        <div className="fc-stick__label">LOOK</div>
        <div ref={rightBase} className="fc-base">
          <MaterialIcon icon="keyboard_arrow_up" className="fc-arrow fc-arrow--up" />
          <MaterialIcon icon="keyboard_arrow_down" className="fc-arrow fc-arrow--down" />
          <MaterialIcon icon="keyboard_arrow_left" className="fc-arrow fc-arrow--left" />
          <MaterialIcon icon="keyboard_arrow_right" className="fc-arrow fc-arrow--right" />
          <div ref={rightKnob} className="fc-knob" data-kx="0" data-ky="0" />
        </div>
      </div>
    </div>
  );
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export default function FlightControls({ style, tilt }: Props) {
  return style === 'sticks' ? <StickPanel tilt={tilt} /> : <TouchZonePad />;
}
