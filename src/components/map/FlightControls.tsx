'use client';

// ── FlightControls ────────────────────────────────────────────────────
//
// The mobile flight controls. Translucent glass, PlotMaps palette. The
// FLIGHT STYLE (chosen in the hamburger, remembered per device) decides the
// layout:
//
//   • 'two-stick': PAN (left, strafe/forward) + LOOK (right, yaw/pitch).
//     Classic two-thumb. FlightControls writes the pad frame; tilt is off.
//   • 'one-hand': a SINGLE PAN stick (thumb = strafe/forward). CLIMB + YAW
//     come from TILTING the phone (tilt-fly), hands-free after a touch
//     calibration. FlightControls only PUBLISHES the stick axes to the tilt
//     hook (setStickAxes); the tilt hook's RAF owns the pad frame and merges
//     stick + tilt. memory/project_tilt_to_fly.
//   • 'zones': the original zone pad (kept — flies well).
//
// Tilt calibration (one-hand): DOUBLE-TAP the PAN knob → a 3·2·1·Set countdown
// locks "level" to your current pose. After that tilt is always live until you
// re-calibrate. memory/project_phone_as_controller.

import { useCallback, useEffect, useRef } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';
import type { TiltFly } from '@/lib/useTiltFly';
import TouchZonePad from './TouchZonePad';

const KNOB_RANGE = 42;      // px knob deflection = full stick
const DOUBLE_TAP_MS = 320;  // knob double-tap window → (re)calibrate tilt

export type FlightStyle = 'drag-look' | 'two-stick' | 'one-hand' | 'zones';
export type Hand = 'right' | 'left';

interface Props {
  flightStyle: FlightStyle;
  tilt?: TiltFly;
  hand?: Hand;
}

// ── stick panel: two-stick OR one-hand (tilt) ──
function StickPanel({ oneHand, tilt, hand = 'right' }: { oneHand: boolean; tilt?: TiltFly; hand?: Hand }) {
  const frame = useRef<PadFrame>({ ...NEUTRAL });
  const root = useRef<HTMLDivElement | null>(null);
  const leftBase = useRef<HTMLDivElement | null>(null);
  const rightBase = useRef<HTMLDivElement | null>(null);
  const leftKnob = useRef<HTMLDivElement | null>(null);
  const rightKnob = useRef<HTMLDivElement | null>(null);
  const grabs = useRef<Map<number, { side: 'left' | 'right'; cx: number; cy: number }>>(new Map());
  const oneHandRef = useRef(oneHand);
  oneHandRef.current = oneHand;
  const tiltRef = useRef<TiltFly | undefined>(tilt);
  tiltRef.current = tilt;
  const lastTapAt = useRef(0);

  // Publish the current knob axes. In one-hand mode we hand them to the tilt
  // hook (it owns the frame + merges tilt). In two-stick mode we write the
  // frame ourselves (tilt off).
  const publish = useCallback(() => {
    const rd = (el: HTMLDivElement | null) =>
      el ? { x: +(el.dataset.kx || 0), y: +(el.dataset.ky || 0) } : { x: 0, y: 0 };
    const l = rd(leftKnob.current), r = rd(rightKnob.current);
    const axes = { lx: l.x, ly: -l.y, rx: r.x, ry: -r.y };
    if (oneHandRef.current) {
      tiltRef.current?.setStickAxes(axes);
    } else {
      const f: PadFrame = { ...NEUTRAL, ...axes };
      frame.current = f; pushTouchFrame(f);
    }
  }, []);

  const setKnob = useCallback((side: 'left' | 'right', nx: number, ny: number) => {
    const k = side === 'left' ? leftKnob.current : rightKnob.current;
    if (!k) return;
    k.dataset.kx = String(nx); k.dataset.ky = String(ny);
    k.style.transform = `translate(${(nx * KNOB_RANGE).toFixed(1)}px, ${(-ny * KNOB_RANGE).toFixed(1)}px)`;
    publish();
  }, [publish]);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const centerOf = (base: HTMLDivElement | null) => {
      if (!base) return null;
      const r = base.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r };
    };
    // Hit-test: whichever base the pointer is within → its knob. (In one-hand
    // mode only the left base exists.)
    const hit = (x: number, y: number) => {
      const sides = oneHandRef.current ? (['left'] as const) : (['left', 'right'] as const);
      for (const side of sides) {
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
      // DOUBLE-TAP a knob → (re)calibrate tilt (one-hand mode).
      if (oneHandRef.current && tiltRef.current?.supported) {
        const now = e.timeStamp || performance.now();
        if (now - lastTapAt.current < DOUBLE_TAP_MS) void tiltRef.current.calibrate();
        lastTapAt.current = now;
      }
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

  const hint = oneHand
    ? (tilt?.calibrated ? '· tilt = climb + turn' : '· 2-tap to set tilt')
    : '';

  return (
    <div ref={root} className={`fc-sticks ${oneHand ? `fc-sticks--one fc-sticks--${hand}` : ''}`}>
      {/* PAN (always present) */}
      <div className="fc-stick">
        <div className="fc-stick__label">PAN <span className="fc-stick__sub">{hint}</span></div>
        <div ref={leftBase} className="fc-base">
          <MaterialIcon icon="keyboard_arrow_up" className="fc-arrow fc-arrow--up" />
          <MaterialIcon icon="keyboard_arrow_down" className="fc-arrow fc-arrow--down" />
          <MaterialIcon icon="keyboard_arrow_left" className="fc-arrow fc-arrow--left" />
          <MaterialIcon icon="keyboard_arrow_right" className="fc-arrow fc-arrow--right" />
          <div ref={leftKnob} className="fc-knob" data-kx="0" data-ky="0" />
        </div>
      </div>

      {/* LOOK — only in two-stick mode */}
      {!oneHand && (
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
      )}
    </div>
  );
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export default function FlightControls({ flightStyle, tilt, hand }: Props) {
  if (flightStyle === 'zones') return <TouchZonePad />;
  return <StickPanel oneHand={flightStyle === 'one-hand'} tilt={tilt} hand={hand} />;
}
