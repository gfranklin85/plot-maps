'use client';

// ── DragLookControls ──────────────────────────────────────────────────
//
// The DEFAULT mobile flight controls (Greg, 2026-07-12): fly with your
// thumbs, LOOK by dragging the screen.
//   • PAN stick (thumb side per handedness) → strafe/forward. Published to
//     useDragLook.setStickAxes.
//   • CLIMB BALL — a small translucent nub; drag up/down = climb/dip, springs
//     back to center. Published to useDragLook.setClimb.
//   • LOOK is the whole screen: MOVING a finger rotates the camera (mouselook,
//     drag-to-rotate + released=hold), handled by useDragLook on the map
//     element. Not dragging the map (that's Google's pan) — we own the look.
//     Pinch = native zoom. This is what makes it FLY, not a static 3D world.
//
// PAN + climb ball merge with the drag-look into one pad frame (useDragLook's
// RAF owns pushTouchFrame). memory/project_phone_as_controller

import { useCallback, useEffect, useRef } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { DragLook } from '@/lib/useDragLook';
import type { Hand } from './FlightControls';

const KNOB_RANGE = 42;   // px pan knob deflection = full
const BALL_RANGE = 40;   // px climb-ball drag = full climb/dip
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export default function DragLookControls({ dragLook, hand = 'right' }: { dragLook: DragLook; hand?: Hand }) {
  const root = useRef<HTMLDivElement | null>(null);
  const panBase = useRef<HTMLDivElement | null>(null);
  const panKnob = useRef<HTMLDivElement | null>(null);
  const ball = useRef<HTMLDivElement | null>(null);
  const grabs = useRef<Map<number, 'pan' | 'ball'>>(new Map());
  const panCenter = useRef<{ cx: number; cy: number } | null>(null);
  const ballCenter = useRef<{ cx: number; cy: number } | null>(null);

  const setPan = useCallback((nx: number, ny: number) => {
    const k = panKnob.current; if (!k) return;
    k.style.transform = `translate(${(nx * KNOB_RANGE).toFixed(1)}px, ${(-ny * KNOB_RANGE).toFixed(1)}px)`;
    dragLook.setStickAxes({ lx: nx, ly: ny, rx: 0, ry: 0 }); // ly already +up
  }, [dragLook]);

  const setBall = useCallback((c: number) => {
    const b = ball.current; if (!b) return;
    b.style.transform = `translateY(${(-c * BALL_RANGE).toFixed(1)}px)`;
    b.classList.toggle('is-active', c !== 0);
    dragLook.setClimb(c);
  }, [dragLook]);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const centerOf = (n: HTMLDivElement | null) => {
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, r };
    };
    const onDown = (e: PointerEvent) => {
      const pc = centerOf(panBase.current);
      const bc = centerOf(ball.current);
      let kind: 'pan' | 'ball' | null = null;
      if (pc && Math.hypot(e.clientX - pc.cx, e.clientY - pc.cy) <= pc.r.width / 2 + 12) {
        kind = 'pan'; panCenter.current = { cx: pc.cx, cy: pc.cy };
      } else if (bc && Math.hypot(e.clientX - bc.cx, e.clientY - bc.cy) <= bc.r.width / 2 + 20) {
        kind = 'ball'; ballCenter.current = { cx: bc.cx, cy: bc.cy };
      }
      if (!kind) return;
      grabs.current.set(e.pointerId, kind);
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (kind === 'pan') setPan(clamp((e.clientX - panCenter.current!.cx) / KNOB_RANGE), clamp(-(e.clientY - panCenter.current!.cy) / KNOB_RANGE));
      else setBall(clamp(-(e.clientY - ballCenter.current!.cy) / BALL_RANGE));
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      const kind = grabs.current.get(e.pointerId); if (!kind) return;
      if (kind === 'pan') setPan(clamp((e.clientX - panCenter.current!.cx) / KNOB_RANGE), clamp(-(e.clientY - panCenter.current!.cy) / KNOB_RANGE));
      else setBall(clamp(-(e.clientY - ballCenter.current!.cy) / BALL_RANGE));
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      const kind = grabs.current.get(e.pointerId); if (!kind) return;
      grabs.current.delete(e.pointerId);
      if (kind === 'pan') setPan(0, 0); else setBall(0);
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
  }, [setPan, setBall]);

  return (
    <div ref={root} className={`dlc dlc--${hand}`}>
      {/* PAN stick */}
      <div className="dlc-pan">
        <div className="fc-stick__label">PAN</div>
        <div ref={panBase} className="fc-base">
          <MaterialIcon icon="keyboard_arrow_up" className="fc-arrow fc-arrow--up" />
          <MaterialIcon icon="keyboard_arrow_down" className="fc-arrow fc-arrow--down" />
          <MaterialIcon icon="keyboard_arrow_left" className="fc-arrow fc-arrow--left" />
          <MaterialIcon icon="keyboard_arrow_right" className="fc-arrow fc-arrow--right" />
          <div ref={panKnob} className="fc-knob" />
        </div>
      </div>

      {/* CLIMB ball — small translucent nub, drag up/down */}
      <div className="dlc-climb">
        <div className="dlc-climb__track">
          <MaterialIcon icon="keyboard_arrow_up" className="dlc-climb__cap dlc-climb__cap--up" />
          <div ref={ball} className="dlc-climb__ball">
            <MaterialIcon icon="height" className="text-[16px]" />
          </div>
          <MaterialIcon icon="keyboard_arrow_down" className="dlc-climb__cap dlc-climb__cap--dn" />
        </div>
        <div className="fc-stick__label">CLIMB</div>
      </div>

      {/* look hint (fades; swipe anywhere to look around) */}
      <div className="dlc-hint">Swipe to look around</div>
    </div>
  );
}
