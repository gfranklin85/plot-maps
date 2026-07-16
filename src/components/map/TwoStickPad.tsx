'use client';

// ── TwoStickPad — the mobile-web flight controller ────────────────────
//
// Greg, 2026-07-16: mobile flight = TWO on-screen joysticks + a CLIMB lever
// in the middle. That's it. (Replaces the abandoned invisible-zone "Cruise"
// experiment, which fought Google's camera and felt wacky.) This visible pad
// feeds the SAME synthetic gamepad the desktop controller does, so the flight
// loop flies identically to desktop — no special-casing.
//
//   LEFT stick   → lx = strafe,  ly = forward/back (throttle)
//   RIGHT stick  → rx = yaw,     ry = pitch (look up/down)
//   CENTER lever → rt = climb (up),  lt = descend (down)
//
// Each stick is a floating knob: touch anywhere in its pad = neutral center,
// drag = deflection, snaps home on release. Pointer-captured per touch so the
// two sticks + lever are fully independent (multi-touch). Self-contained
// inline styles (no globals.css). memory/project_mobile_map_google_native

import { useCallback, useRef } from 'react';
import type { CSSProperties } from 'react';

export interface PadOutput {
  lx: number; ly: number; rx: number; ry: number; lt: number; rt: number;
}

interface Props {
  onChange: (out: PadOutput) => void;
}

const STICK_TRAVEL = 46;   // px radius for full stick deflection
const LEVER_TRAVEL = 54;   // px for full climb/descend

export default function TwoStickPad({ onChange }: Props) {
  // Live axis state (refs so touch handlers write without re-render).
  const axes = useRef<PadOutput>({ lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 });

  const emit = useCallback(() => onChange({ ...axes.current }), [onChange]);

  return (
    <div style={styles.root} aria-hidden>
      <div style={{ ...styles.stickWrap, left: 'calc(env(safe-area-inset-left,0px) + 20px)' }}>
        <Stick
          label="MOVE"
          onVec={(nx, ny) => { axes.current.lx = nx; axes.current.ly = -ny; emit(); }}
        />
      </div>

      <div style={styles.leverWrap}>
        <Lever
          onVal={(up) => {
            axes.current.rt = up > 0 ? up : 0;
            axes.current.lt = up < 0 ? -up : 0;
            emit();
          }}
        />
      </div>

      <div style={{ ...styles.stickWrap, right: 'calc(env(safe-area-inset-right,0px) + 20px)' }}>
        <Stick
          label="LOOK"
          onVec={(nx, ny) => { axes.current.rx = nx; axes.current.ry = -ny; emit(); }}
        />
      </div>
    </div>
  );
}

// ── A floating joystick: touch = center, drag = deflection (−1..1), snap home ──
function Stick({ label, onVec }: { label: string; onVec: (nx: number, ny: number) => void }) {
  const base = useRef<HTMLDivElement | null>(null);
  const knob = useRef<HTMLDivElement | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const render = useCallback((dx: number, dy: number) => {
    if (knob.current) knob.current.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    origin.current = { x: e.clientX, y: e.clientY };
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (!origin.current) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_TRAVEL) { dx = (dx / d) * STICK_TRAVEL; dy = (dy / d) * STICK_TRAVEL; }
    render(dx, dy);
    onVec(dx / STICK_TRAVEL, -dy / STICK_TRAVEL);   // +ny = up (screen y is down)
    e.preventDefault(); e.stopPropagation();
  }, [onVec, render]);

  const onUp = useCallback((e: React.PointerEvent) => {
    origin.current = null;
    render(0, 0);
    onVec(0, 0);
    e.preventDefault(); e.stopPropagation();
  }, [onVec, render]);

  return (
    <div
      ref={base}
      style={styles.stickBase}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <span style={styles.stickLabel}>{label}</span>
      <div ref={knob} style={styles.stickKnob} />
    </div>
  );
}

// ── The center CLIMB lever: vertical only. Up = climb (+1), down = dip (−1). ──
function Lever({ onVal }: { onVal: (up: number) => void }) {
  const track = useRef<HTMLDivElement | null>(null);
  const grip = useRef<HTMLDivElement | null>(null);
  const originY = useRef<number | null>(null);

  const render = useCallback((dy: number) => {
    if (grip.current) grip.current.style.transform = `translateY(${dy.toFixed(1)}px)`;
  }, []);

  const onDown = useCallback((e: React.PointerEvent) => {
    originY.current = e.clientY;
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault(); e.stopPropagation();
  }, []);

  const onMove = useCallback((e: React.PointerEvent) => {
    if (originY.current == null) return;
    let dy = e.clientY - originY.current;
    if (dy > LEVER_TRAVEL) dy = LEVER_TRAVEL;
    if (dy < -LEVER_TRAVEL) dy = -LEVER_TRAVEL;
    render(dy);
    onVal(-dy / LEVER_TRAVEL);   // drag up (dy<0) → +up = climb
    e.preventDefault(); e.stopPropagation();
  }, [onVal, render]);

  const onUp = useCallback((e: React.PointerEvent) => {
    originY.current = null;
    render(0);
    onVal(0);
    e.preventDefault(); e.stopPropagation();
  }, [onVal, render]);

  return (
    <div
      ref={track}
      style={styles.leverTrack}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <span style={styles.leverPlus}>▲</span>
      <div ref={grip} style={styles.leverGrip}><span style={styles.leverGripLabel}>CLIMB</span></div>
      <span style={styles.leverMinus}>▼</span>
    </div>
  );
}

const GLASS = 'rgba(255,255,255,0.14)';
const GLASS_BORDER = 'rgba(255,255,255,0.55)';
const BRAND = 'rgba(19,73,212,0.9)';

const styles: Record<string, CSSProperties> = {
  root: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    userSelect: 'none', WebkitUserSelect: 'none',
    touchAction: 'none',
  },
  stickWrap: {
    position: 'absolute',
    bottom: 'calc(env(safe-area-inset-bottom,0px) + 22px)',
  },
  stickBase: {
    pointerEvents: 'auto', touchAction: 'none',
    width: 118, height: 118, borderRadius: '50%',
    background: GLASS, border: `1.5px solid ${GLASS_BORDER}`,
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    boxShadow: '0 8px 24px -10px rgba(20,50,120,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  stickLabel: {
    position: 'absolute', top: 8, fontSize: 9, fontWeight: 800,
    letterSpacing: 1.5, color: 'rgba(255,255,255,0.7)',
  },
  stickKnob: {
    width: 52, height: 52, borderRadius: '50%',
    background: 'rgba(255,255,255,0.9)', border: `2px solid ${BRAND}`,
    boxShadow: '0 4px 12px -4px rgba(20,50,120,0.6)',
    willChange: 'transform',
  },
  leverWrap: {
    position: 'absolute', left: '50%', transform: 'translateX(-50%)',
    bottom: 'calc(env(safe-area-inset-bottom,0px) + 22px)',
  },
  leverTrack: {
    pointerEvents: 'auto', touchAction: 'none',
    width: 56, height: 150, borderRadius: 28,
    background: GLASS, border: `1.5px solid ${GLASS_BORDER}`,
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    boxShadow: '0 8px 24px -10px rgba(20,50,120,0.5)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'space-between', padding: '8px 0', position: 'relative',
  },
  leverPlus: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  leverMinus: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  leverGrip: {
    position: 'absolute', top: '50%', left: '50%',
    marginLeft: -24, marginTop: -18,
    width: 48, height: 36, borderRadius: 12,
    background: 'rgba(255,255,255,0.9)', border: `2px solid ${BRAND}`,
    boxShadow: '0 4px 12px -4px rgba(20,50,120,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    willChange: 'transform',
  },
  leverGripLabel: { fontSize: 8, fontWeight: 800, letterSpacing: 1, color: BRAND },
};
