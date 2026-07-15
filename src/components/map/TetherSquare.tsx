'use client';

// ── TetherSquare — a bungee-tether flight control ─────────────────────
//
// A small square anchored at a home spot. Press it and PULL it away like a
// rubber band — the knob follows your finger (clamped to a max stretch), a
// tether line connects home → knob, and the offset (px) is reported so the
// flight hook can turn it into speed. Snaps home on release. PAN uses both
// axes; CLIMB locks to vertical. Pointer-captured so it owns only its own
// touch — Google + the hamburger keep everything else. Greg 2026-07-14.

import { useCallback, useRef } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

const MAX_STRETCH = 60; // px the knob can pull from home

interface Props {
  axis: 'both' | 'vertical';
  label: string;
  icon: string;
  className?: string;                 // positions the square (side)
  onChange: (active: boolean, dx: number, dy: number) => void;
}

export default function TetherSquare({ axis, label, icon, className, onChange }: Props) {
  const home = useRef<HTMLDivElement | null>(null);
  const knob = useRef<HTMLDivElement | null>(null);
  const line = useRef<SVGLineElement | null>(null);
  const origin = useRef<{ cx: number; cy: number } | null>(null);
  const active = useRef(false);

  const render = useCallback((dx: number, dy: number) => {
    const k = knob.current;
    if (k) k.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    const l = line.current;
    if (l) {
      // line drawn in the square's local box; home is center (28,28)
      l.setAttribute('x2', String(28 + dx));
      l.setAttribute('y2', String(28 + dy));
    }
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    const el = home.current; if (!el) return;
    const r = el.getBoundingClientRect();
    origin.current = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    active.current = true;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.add('is-pulling');
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!active.current || !origin.current) return;
    let dx = e.clientX - origin.current.cx;
    let dy = e.clientY - origin.current.cy;
    if (axis === 'vertical') dx = 0;
    // clamp the visual pull to MAX_STRETCH (radial)
    const d = Math.hypot(dx, dy);
    if (d > MAX_STRETCH) { dx = (dx / d) * MAX_STRETCH; dy = (dy / d) * MAX_STRETCH; }
    render(dx, dy);
    onChange(true, dx, dy);
    e.preventDefault(); e.stopPropagation();
  }, [axis, onChange, render]);

  const onUp = useCallback((e: React.PointerEvent) => {
    if (!active.current) return;
    active.current = false;
    origin.current = null;
    render(0, 0);                       // snap home
    onChange(false, 0, 0);
    home.current?.classList.remove('is-pulling');
    e.preventDefault(); e.stopPropagation();
  }, [onChange, render]);

  return (
    <div
      ref={home}
      className={`tsq ${className ?? ''}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <span className="tsq__label">{label}</span>
      <div className="tsq__pad">
        <svg className="tsq__tether" viewBox="0 0 56 56" aria-hidden>
          <line ref={line} x1="28" y1="28" x2="28" y2="28" />
        </svg>
        <div ref={knob} className="tsq__knob">
          <MaterialIcon icon={icon} className="text-[20px]" />
        </div>
      </div>
    </div>
  );
}
