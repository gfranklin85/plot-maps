'use client';

// ── FlightZones — the invisible "Cruise" thumb-zones ──────────────────
//
// Greg, 2026-07-15: the second mobile flight mode has NO visible controls. The
// screen has two INVISIBLE bottom hit-zones:
//   • bottom-LEFT  = PAN  → press to cruise forward, slide to steer/strafe
//   • bottom-RIGHT = CLIMB → press up/down to ascend/descend
// Everywhere else, and everywhere OUTSIDE these two corners, is transparent to
// touch (pointer-events:none) so Google's native look owns it.
//
// Each zone records the press ORIGIN and reports the finger offset from it —
// press-and-hold flies continuously (the base floor lives in useZoneFlight).
// Pointer-captured so a zone owns only its own finger. Modeled on the pointer
// handling in TetherSquare, minus all the visible knob/tether/label chrome.

import { useCallback, useRef } from 'react';

interface Props {
  onPan: (active: boolean, dx: number, dy: number) => void;
  onClimb: (active: boolean, dy: number) => void;
}

// px of finger travel before we start eating the gesture — lets a quick TAP
// inside a zone still fall through to Google (gmp-click / parcel select).
const MOVE_THRESHOLD = 6;

export default function FlightZones({ onPan, onClimb }: Props) {
  return (
    <div className="fz" aria-hidden>
      <Zone className="fz-pan" axis="both" onChange={onPan} />
      <Zone
        className="fz-climb"
        axis="vertical"
        onChange={(active, _dx, dy) => onClimb(active, dy)}
      />
    </div>
  );
}

function Zone({
  className,
  axis,
  onChange,
}: {
  className: string;
  axis: 'both' | 'vertical';
  onChange: (active: boolean, dx: number, dy: number) => void;
}) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const active = useRef(false);
  const moved = useRef(false);

  const onDown = useCallback((e: React.PointerEvent) => {
    origin.current = { x: e.clientX, y: e.clientY };
    active.current = true;
    moved.current = false;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    // Press-to-cruise: engage the instant the finger lands (base floor flies
    // with zero offset). Don't preventDefault yet — a stationary tap that
    // lifts quickly still reaches Google (gmp-click).
    onChange(true, 0, 0);
  }, [onChange]);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!active.current || !origin.current) return;
    const dx = axis === 'vertical' ? 0 : e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    if (!moved.current && Math.hypot(dx, dy) > MOVE_THRESHOLD) moved.current = true;
    // Fly the instant the finger is down (press-to-cruise), but only start
    // eating the gesture once it's clearly a drag (past the tap threshold).
    onChange(true, dx, dy);
    if (moved.current) { e.preventDefault(); e.stopPropagation(); }
  }, [axis, onChange]);

  const onUp = useCallback((e: React.PointerEvent) => {
    if (!active.current) return;
    active.current = false;
    origin.current = null;
    onChange(false, 0, 0);
    if (moved.current) { e.preventDefault(); e.stopPropagation(); }
    moved.current = false;
  }, [onChange]);

  return (
    <div
      className={className}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}
