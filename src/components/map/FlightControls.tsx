'use client';

// ── FlightControls ────────────────────────────────────────────────────
//
// The mobile flight-control panel (Greg's mockups, 2026-07-11). Translucent
// glass, PlotMaps palette. Two selectable styles (choice saved to
// localStorage):
//
//   • 'sticks' (the mockup): PAN joystick (left) · CLIMB/DIP vertical slider
//     (center) · LOOK joystick (right). Left knob = pan, right knob = look,
//     center slider = climb/descend.
//   • 'zones' (the original zone pad, kept — it works well): full-width
//     floating-elastic strips, restyled to the same glass palette.
//
// Both write the synthetic gamepad via pushTouchFrame() so Plot's existing
// flight loop drives FLY_3D unchanged. A mode row on top (Flight / Explore /
// fly / Layers / Saved) and a drag-grip to resize the map/control split.
// memory/project_phone_as_controller.

import { useCallback, useEffect, useRef } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';
import TouchZonePad from './TouchZonePad';

const KNOB_RANGE = 42;   // px knob deflection = full stick
const CLIMB_RANGE = 66;  // px slider travel = full climb/descend

export type ControlStyle = 'sticks' | 'zones';

interface Props {
  style: ControlStyle;
}

// ── the stick+slider panel (mockup) ──
// PAN (left) · CLIMB/DIP (center slider) · LOOK (right). No A/B buttons —
// selection is handled by the HUD's Tap/Laser mode, not floating buttons
// that collided with the stick labels (Greg, 2026-07-11).
function StickPanel() {
  const frame = useRef<PadFrame>({ ...NEUTRAL });
  const root = useRef<HTMLDivElement | null>(null);
  const leftBase = useRef<HTMLDivElement | null>(null);
  const rightBase = useRef<HTMLDivElement | null>(null);
  const leftKnob = useRef<HTMLDivElement | null>(null);
  const rightKnob = useRef<HTMLDivElement | null>(null);
  const slider = useRef<HTMLDivElement | null>(null);
  const sliderKnob = useRef<HTMLDivElement | null>(null);
  const grabs = useRef<Map<number, { kind: 'knob' | 'slider'; side?: 'left' | 'right'; cx: number; cy: number }>>(new Map());

  const push = useCallback(() => pushTouchFrame(frame.current), []);

  const recompute = useCallback(() => {
    const f: PadFrame = { ...NEUTRAL };
    const rd = (el: HTMLDivElement | null) =>
      el ? { x: +(el.dataset.kx || 0), y: +(el.dataset.ky || 0) } : { x: 0, y: 0 };
    const l = rd(leftKnob.current), r = rd(rightKnob.current);
    const climb = +(sliderKnob.current?.dataset.c || 0); // +up climb, −down dip
    f.lx = l.x; f.ly = -l.y;
    f.rx = r.x; f.ry = -r.y;
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

  const setClimb = useCallback((c: number) => {
    const k = sliderKnob.current;
    if (!k) return;
    k.dataset.c = String(c);
    k.style.transform = `translateY(${(-c * CLIMB_RANGE).toFixed(1)}px)`;
    recompute();
  }, [recompute]);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const centerOf = (base: HTMLDivElement | null) => {
      if (!base) return null;
      const r = base.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r };
    };
    const hit = (x: number, y: number) => {
      for (const side of ['left', 'right'] as const) {
        const c = centerOf(side === 'left' ? leftBase.current : rightBase.current);
        if (c && Math.hypot(x - c.cx, y - c.cy) <= c.r.width / 2 + 12)
          return { kind: 'knob' as const, side, cx: c.cx, cy: c.cy };
      }
      const s = slider.current?.getBoundingClientRect();
      if (s && x >= s.left - 16 && x <= s.right + 16 && y >= s.top - 8 && y <= s.bottom + 8)
        return { kind: 'slider' as const, cx: s.left + s.width / 2, cy: s.top + s.height / 2 };
      return null;
    };
    const onDown = (e: PointerEvent) => {
      const g = hit(e.clientX, e.clientY); if (!g) return;
      grabs.current.set(e.pointerId, g);
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (g.kind === 'knob') setKnob(g.side!, clamp((e.clientX - g.cx) / KNOB_RANGE), clamp(-(e.clientY - g.cy) / KNOB_RANGE));
      else setClimb(clamp(-(e.clientY - g.cy) / CLIMB_RANGE));
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      const g = grabs.current.get(e.pointerId); if (!g) return;
      if (g.kind === 'knob') setKnob(g.side!, clamp((e.clientX - g.cx) / KNOB_RANGE), clamp(-(e.clientY - g.cy) / KNOB_RANGE));
      else setClimb(clamp(-(e.clientY - g.cy) / CLIMB_RANGE));
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      const g = grabs.current.get(e.pointerId); if (!g) return;
      grabs.current.delete(e.pointerId);
      if (g.kind === 'knob') setKnob(g.side!, 0, 0); else setClimb(0);
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
  }, [setKnob, setClimb]);

  return (
    <div ref={root} className="fc-sticks">
      {/* PAN */}
      <div className="fc-stick">
        <div className="fc-stick__label">PAN</div>
        <div ref={leftBase} className="fc-base">
          <MaterialIcon icon="keyboard_arrow_up" className="fc-arrow fc-arrow--up" />
          <MaterialIcon icon="keyboard_arrow_down" className="fc-arrow fc-arrow--down" />
          <MaterialIcon icon="keyboard_arrow_left" className="fc-arrow fc-arrow--left" />
          <MaterialIcon icon="keyboard_arrow_right" className="fc-arrow fc-arrow--right" />
          <div ref={leftKnob} className="fc-knob" data-kx="0" data-ky="0" />
        </div>
      </div>

      {/* CLIMB / DIP slider */}
      <div className="fc-climb">
        <div className="fc-climb__label">CLIMB</div>
        <div ref={slider} className="fc-slider">
          <MaterialIcon icon="keyboard_arrow_up" className="fc-slider__cap fc-slider__cap--top" />
          <div className="fc-slider__track" />
          <div ref={sliderKnob} className="fc-slider__knob" data-c="0" />
          <MaterialIcon icon="keyboard_arrow_down" className="fc-slider__cap fc-slider__cap--bot" />
        </div>
        <div className="fc-climb__label fc-climb__label--bot">DIP</div>
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

export default function FlightControls({ style }: Props) {
  return style === 'sticks' ? <StickPanel /> : <TouchZonePad />;
}
