'use client';

// ── DragLookControls ──────────────────────────────────────────────────
//
// The DEFAULT mobile flight controls (Greg, 2026-07-12, stripped to the bone):
//   • two small blue balls — PAN (forward/strafe) and CLIMB (up/dip). Nothing
//     else: no outer ring, no labels, no slot/track.
//   • LOOK is GOOGLE'S native map control — a finger anywhere else on the map
//     moves the camera the normal way. We add nothing to it.
//
// So the container is pointer-events:none; only the two balls capture touch,
// everything else falls through to Google. The balls publish to useDragLook,
// whose RAF drives the flight loop. memory/project_tilt_to_fly

import { useCallback, useEffect, useRef } from 'react';
import type { DragLook } from '@/lib/useDragLook';
import type { Hand } from './FlightControls';

const PAN_RANGE = 46;    // px pan-ball travel = full
const CLIMB_RANGE = 46;  // px climb-ball travel = full
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export default function DragLookControls({ dragLook, hand = 'right' }: { dragLook: DragLook; hand?: Hand }) {
  const panBall = useRef<HTMLDivElement | null>(null);
  const climbBall = useRef<HTMLDivElement | null>(null);
  const panHome = useRef<{ cx: number; cy: number } | null>(null);
  const climbHome = useRef<{ cx: number; cy: number } | null>(null);
  const grab = useRef<Map<number, 'pan' | 'climb'>>(new Map());

  const movePan = useCallback((nx: number, ny: number) => {
    const b = panBall.current; if (!b) return;
    b.style.transform = `translate(${(nx * PAN_RANGE).toFixed(1)}px, ${(-ny * PAN_RANGE).toFixed(1)}px)`;
    dragLook.setStickAxes({ lx: nx, ly: ny, rx: 0, ry: 0 });
  }, [dragLook]);

  const moveClimb = useCallback((c: number) => {
    const b = climbBall.current; if (!b) return;
    b.style.transform = `translateY(${(-c * CLIMB_RANGE).toFixed(1)}px)`;
    dragLook.setClimb(c);
  }, [dragLook]);

  const bind = useCallback((el: HTMLDivElement | null, kind: 'pan' | 'climb') => {
    if (!el) return;
    const home = kind === 'pan' ? panHome : climbHome;
    const onDown = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      home.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
      grab.current.set(e.pointerId, kind);
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      apply(e);
      e.preventDefault(); e.stopPropagation();
    };
    const apply = (e: PointerEvent) => {
      const h = home.current; if (!h) return;
      if (kind === 'pan') movePan(clamp((e.clientX - h.cx) / PAN_RANGE), clamp(-(e.clientY - h.cy) / PAN_RANGE));
      else moveClimb(clamp(-(e.clientY - h.cy) / CLIMB_RANGE));
    };
    const onMove = (e: PointerEvent) => { if (grab.current.get(e.pointerId) === kind) { apply(e); e.preventDefault(); } };
    const onUp = (e: PointerEvent) => {
      if (grab.current.get(e.pointerId) !== kind) return;
      grab.current.delete(e.pointerId);
      if (kind === 'pan') movePan(0, 0); else moveClimb(0);
      e.preventDefault();
    };
    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp, { passive: false });
    el.addEventListener('pointercancel', onUp, { passive: false });
  }, [movePan, moveClimb]);

  useEffect(() => {
    bind(panBall.current, 'pan');
    bind(climbBall.current, 'climb');
    // listeners live for the component lifetime; balls are stable refs.
  }, [bind]);

  return (
    <div className={`dlc dlc--${hand}`}>
      <div ref={panBall} className="dlc-ball dlc-ball--pan" />
      <div ref={climbBall} className="dlc-ball dlc-ball--climb" />
    </div>
  );
}
