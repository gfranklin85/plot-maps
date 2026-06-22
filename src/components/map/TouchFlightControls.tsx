'use client';

// ── TouchFlightControls ───────────────────────────────────────────────
//
// On-screen flight controls for flying the Plot 3D map *directly on the
// phone's web view* — no second screen, no native PlotFly app, no network.
//
// How it drives the map with ZERO flight-code changes:
//   installFlyPad() (from flyPadBridge) overrides navigator.getGamepads()
//   in THIS browser window with a synthetic "standard" pad. Plot's existing
//   flight loop (useGamepad → pickGamepad) reads that pad every frame. So a
//   touch widget that simply calls applyPadFrame() each animation frame
//   flies the map exactly as a real Xbox stick — or a remote phone over the
//   link — would. The map can't tell the difference.
//
// The control surface, built for two thumbs + the phone's tilt sensor:
//   • THROTTLE  — sticky vertical lever (left edge). Holds where you leave
//                 it, so one thumb sets cruise and is then free.   → LY
//   • TURN      — spring-center slider (bottom).                   → RX
//   • STRAFE    — spring-center slider (bottom).                   → LX
//   • ALT       — spring-center slider (bottom). right=up/left=dn. → RT/LT
//   • TILT LOOK — physically tilt the phone (DeviceOrientation) to
//                 pitch the view up/down, with a gentle bank-to-turn
//                 assist on roll. Frees you from needing a third thumb. → RY (+RX)
//
// Multi-touch: each slider/lever tracks its own pointerId via pointer
// capture, so both thumbs work at once. Springs snap to center on release;
// the throttle stays put. A frame is emitted every RAF while ENGAGED (any
// touch down, throttle off-center, a slider live, or tilt armed) — that
// keeps a held throttle alive past flyPadBridge's 250ms dead-man switch,
// while staying silent when truly idle so it never fights a remote phone.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  installFlyPad,
  applyPadFrame,
  neutralizeFlyPad,
  type PadFrame,
} from '@/lib/flyPadBridge';

// ── tuning ────────────────────────────────────────────────────────────
const GYRO_RANGE_DEG = 32;   // tilt this far from center → full deflection
const GYRO_DEADZONE_DEG = 4; // ignore tiny wobble so the view doesn't drift
const GYRO_BANK_ASSIST = 0.55; // how much phone-roll adds to the turn

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// DeviceOrientation beta/gamma are defined against the device's natural
// (portrait) frame. When the phone is held in landscape the axes rotate, so
// map raw beta/gamma onto screen-relative pitch/roll using the current
// screen orientation angle. We only ever use these as deltas from a
// recenter reference, so an approximate mapping is plenty.
function tiltAxes(beta: number, gamma: number, angle: number): { pitch: number; roll: number } {
  switch (((angle % 360) + 360) % 360) {
    case 90:  return { pitch: -gamma, roll: beta };
    case 180: return { pitch: -beta, roll: -gamma };
    case 270: return { pitch: gamma, roll: -beta };
    default:  return { pitch: beta, roll: gamma }; // 0 / portrait
  }
}

// iOS 13+ gates the sensor behind an explicit permission request.
type DOPermClass = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export default function TouchFlightControls({
  forceShow = false,
}: {
  /** Render even on non-touch devices (handy for desktop testing via ?touch=1). */
  forceShow?: boolean;
}) {
  // Only mount the UI on touch-capable devices (or when forced). On a
  // desktop receiver with a real gamepad we render nothing, so we can never
  // stomp that path.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (forceShow) { setVisible(true); return; }
    const coarse =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    setVisible(!!coarse);
  }, [forceShow]);

  // Live control values, kept in refs so the RAF emit-loop reads them
  // without re-subscribing. Mirrored into state only for thumb rendering.
  const throttleRef = useRef(0); // -1..1  up = forward
  const turnRef = useRef(0);     // -1..1  right = turn right
  const strafeRef = useRef(0);   // -1..1  right = slide right
  const altRef = useRef(0);      // -1..1  right = ascend
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  // Gyro state.
  const gyroOn = useRef(false);
  const [gyroVisible, setGyroVisible] = useState(false); // mirror for button label
  const gyroRef = useRef({ pitch: 0, roll: 0 });   // normalized -1..1, screen-relative
  const gyroZero = useRef<{ beta: number; gamma: number } | null>(null);
  const lastRaw = useRef<{ beta: number; gamma: number; angle: number } | null>(null);
  const invertPitch = useRef(false);
  const [invertVisible, setInvertVisible] = useState(false);

  // Whether any pointer is currently down on a control.
  const activePointers = useRef(0);

  // Install the synthetic pad up front so the flight loop has it ready.
  useEffect(() => {
    if (!visible) return;
    installFlyPad();
  }, [visible]);

  // ── DeviceOrientation handler ───────────────────────────────────────
  const onOrient = useCallback((evt: DeviceOrientationEvent) => {
    if (evt.beta == null || evt.gamma == null) return;
    const angle =
      (typeof screen !== 'undefined' && screen.orientation?.angle != null
        ? screen.orientation.angle
        : (typeof window !== 'undefined' && typeof window.orientation === 'number'
            ? window.orientation
            : 0)) || 0;
    const { pitch, roll } = tiltAxes(evt.beta, evt.gamma, angle);
    lastRaw.current = { beta: pitch, gamma: roll, angle };
    if (!gyroZero.current) gyroZero.current = { beta: pitch, gamma: roll };

    const dz = (v: number) =>
      Math.abs(v) < GYRO_DEADZONE_DEG
        ? 0
        : (Math.sign(v) * (Math.abs(v) - GYRO_DEADZONE_DEG)) / (GYRO_RANGE_DEG - GYRO_DEADZONE_DEG);

    const dPitch = dz(pitch - gyroZero.current.beta);
    const dRoll = dz(roll - gyroZero.current.gamma);
    gyroRef.current = {
      pitch: clamp(dPitch, -1, 1) * (invertPitch.current ? -1 : 1),
      roll: clamp(dRoll, -1, 1),
    };
  }, []);

  const recenter = useCallback(() => {
    gyroZero.current = lastRaw.current
      ? { beta: lastRaw.current.beta, gamma: lastRaw.current.gamma }
      : null;
    gyroRef.current = { pitch: 0, roll: 0 };
    try { navigator.vibrate?.(15); } catch { /* ignore */ }
  }, []);

  const enableGyro = useCallback(async () => {
    if (gyroOn.current) {
      // Toggle off.
      gyroOn.current = false;
      setGyroVisible(false);
      window.removeEventListener('deviceorientation', onOrient);
      gyroRef.current = { pitch: 0, roll: 0 };
      return;
    }
    // iOS 13+ needs an explicit permission grant from a user gesture.
    const Cls = DeviceOrientationEvent as DOPermClass;
    if (typeof Cls?.requestPermission === 'function') {
      try {
        const res = await Cls.requestPermission();
        if (res !== 'granted') return;
      } catch {
        return;
      }
    }
    gyroZero.current = null; // re-zero to however the phone is held now
    window.addEventListener('deviceorientation', onOrient);
    gyroOn.current = true;
    setGyroVisible(true);
    try { navigator.vibrate?.(15); } catch { /* ignore */ }
  }, [onOrient]);

  useEffect(() => {
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [onOrient]);

  // ── RAF emit loop ───────────────────────────────────────────────────
  const horizonRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let wasEngaged = false;

    const loop = () => {
      const t = throttleRef.current;
      const turn = turnRef.current;
      const strafe = strafeRef.current;
      const alt = altRef.current;
      const g = gyroOn.current ? gyroRef.current : { pitch: 0, roll: 0 };

      // Compose the synthetic-pad frame from the control surface.
      const rx = clamp(turn + g.roll * GYRO_BANK_ASSIST, -1, 1);
      const frame: PadFrame = {
        ly: -t,          // up = forward (MapView3D: throttle += -ly)
        lx: strafe,
        rx,
        ry: g.pitch,     // tilt look up/down
        rt: Math.max(alt, 0),
        lt: Math.max(-alt, 0),
        a: false, b: false, x: false, y: false,
      };

      // Imperatively nudge the tilt-horizon indicator (no React churn).
      if (horizonRef.current) {
        horizonRef.current.style.transform =
          `translate(-50%, -50%) translateY(${(-g.pitch * 14).toFixed(1)}px) rotate(${(g.roll * 18).toFixed(1)}deg)`;
      }

      const engaged =
        activePointers.current > 0 ||
        t !== 0 || turn !== 0 || strafe !== 0 || alt !== 0 ||
        (gyroOn.current && (g.pitch !== 0 || g.roll !== 0));

      if (engaged) {
        applyPadFrame(frame);
        wasEngaged = true;
      } else if (wasEngaged) {
        // First idle frame after activity: hand the pad cleanly to neutral
        // (also lets a remote phone take back over, if one is ever linked).
        neutralizeFlyPad();
        wasEngaged = false;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  // ── Pointer helpers shared by every slider/lever ────────────────────
  const beginPointer = () => {
    activePointers.current += 1;
    try { navigator.vibrate?.(8); } catch { /* ignore */ }
  };
  const endPointer = () => {
    activePointers.current = Math.max(0, activePointers.current - 1);
  };

  return (
    <div style={s.layer}>
      {/* Left edge: sticky THROTTLE lever. */}
      <VerticalLever
        label="THR"
        valueRef={throttleRef}
        sticky
        onChange={rerender}
        onDown={beginPointer}
        onUp={endPointer}
        tint="#7CFFB2"
      />

      {/* Right edge: TILT panel — arm the gyro + recenter + invert. */}
      <div style={s.gyroPanel}>
        <div style={s.horizonWrap}>
          <div ref={horizonRef} style={s.horizon} />
          <div style={s.horizonRule} />
        </div>
        <button
          style={{ ...s.gyroBtn, ...(gyroVisible ? s.gyroBtnOn : null) }}
          onClick={enableGyro}
        >
          {gyroVisible ? 'TILT ON' : 'TILT'}
        </button>
        {gyroVisible && (
          <>
            <button style={s.gyroSub} onClick={recenter}>CENTER</button>
            <button
              style={{ ...s.gyroSub, ...(invertVisible ? s.gyroSubOn : null) }}
              onClick={() => { invertPitch.current = !invertPitch.current; setInvertVisible((v) => !v); }}
            >
              INV
            </button>
          </>
        )}
      </div>

      {/* Bottom: spring-center sliders. */}
      <div style={s.sliderRow}>
        <HorizontalSlider label="STRAFE" valueRef={strafeRef} onChange={rerender} onDown={beginPointer} onUp={endPointer} tint="#8FB6FF" />
        <HorizontalSlider label="TURN"   valueRef={turnRef}   onChange={rerender} onDown={beginPointer} onUp={endPointer} tint="#9FD0FF" />
        <HorizontalSlider label="ALT"    valueRef={altRef}    onChange={rerender} onDown={beginPointer} onUp={endPointer} tint="#FFCF8F" />
      </div>
    </div>
  );
}

// ── Vertical lever (throttle) ─────────────────────────────────────────
function VerticalLever({
  label, valueRef, sticky, onChange, onDown, onUp, tint,
}: {
  label: string;
  valueRef: React.MutableRefObject<number>;
  sticky?: boolean;
  onChange: () => void;
  onDown: () => void;
  onUp: () => void;
  tint: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerId = useRef<number | null>(null);

  const setFromY = (clientY: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = (clientY - r.top) / r.height; // 0 at top, 1 at bottom
    valueRef.current = clamp(1 - ratio * 2, -1, 1); // top = +1
    onChange();
  };

  const down = (e: React.PointerEvent) => {
    pointerId.current = e.pointerId;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onDown();
    setFromY(e.clientY);
  };
  const move = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    setFromY(e.clientY);
  };
  const up = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    if (!sticky) { valueRef.current = 0; onChange(); }
    onUp();
  };

  const v = valueRef.current;
  const thumbBottom = `${((v + 1) / 2) * 100}%`;
  return (
    <div style={s.leverWrap}>
      <div
        ref={trackRef}
        style={s.leverTrack}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div style={s.leverCenterTick} />
        <div
          style={{
            ...s.leverFill,
            height: `${Math.abs(v) * 50}%`,
            bottom: v >= 0 ? '50%' : `${50 - Math.abs(v) * 50}%`,
            background: `linear-gradient(${v >= 0 ? '0deg' : '180deg'}, ${tint}00, ${tint}aa)`,
          }}
        />
        <div style={{ ...s.leverThumb, bottom: thumbBottom, borderColor: tint }} />
      </div>
      <div style={s.leverLabel}>{label}</div>
      <div style={s.leverVal}>{v > 0.02 ? '▲' : v < -0.02 ? '▼' : '•'}</div>
    </div>
  );
}

// ── Horizontal spring-center slider ───────────────────────────────────
function HorizontalSlider({
  label, valueRef, onChange, onDown, onUp, tint,
}: {
  label: string;
  valueRef: React.MutableRefObject<number>;
  onChange: () => void;
  onDown: () => void;
  onUp: () => void;
  tint: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerId = useRef<number | null>(null);

  const setFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = (clientX - r.left) / r.width; // 0..1
    valueRef.current = clamp(ratio * 2 - 1, -1, 1);
    onChange();
  };

  const down = (e: React.PointerEvent) => {
    pointerId.current = e.pointerId;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    onDown();
    setFromX(e.clientX);
  };
  const move = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    setFromX(e.clientX);
  };
  const up = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    valueRef.current = 0; // spring back to center
    onChange();
    onUp();
  };

  const v = valueRef.current;
  const thumbLeft = `${((v + 1) / 2) * 100}%`;
  return (
    <div style={s.sliderWrap}>
      <div style={s.sliderLabel}>{label}</div>
      <div
        ref={trackRef}
        style={s.sliderTrack}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div style={s.sliderCenterTick} />
        <div
          style={{
            ...s.sliderFill,
            width: `${Math.abs(v) * 50}%`,
            left: v >= 0 ? '50%' : `${50 - Math.abs(v) * 50}%`,
            background: `linear-gradient(90deg, ${tint}00, ${tint}aa)`,
          }}
        />
        <div style={{ ...s.sliderThumb, left: thumbLeft, borderColor: tint }} />
      </div>
    </div>
  );
}

// ── styles ────────────────────────────────────────────────────────────
const PANEL = 'rgba(9,14,26,0.66)';
const BORDER = '1px solid rgba(125,168,255,0.22)';

const s: Record<string, React.CSSProperties> = {
  layer: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none', // only the controls themselves capture touches
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    zIndex: 40,
  },

  // Throttle lever, pinned to the left, thumb-reachable.
  leverWrap: {
    position: 'absolute',
    left: 16,
    bottom: 132,
    width: 64,
    height: 220,
    pointerEvents: 'auto',
    textAlign: 'center',
  },
  leverTrack: {
    position: 'relative',
    width: 56,
    height: 188,
    margin: '0 auto',
    borderRadius: 28,
    background: PANEL,
    border: BORDER,
    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    touchAction: 'none',
  },
  leverCenterTick: {
    position: 'absolute', left: 8, right: 8, top: '50%', height: 1,
    background: 'rgba(159,208,255,0.35)',
  },
  leverFill: { position: 'absolute', left: 6, right: 6, borderRadius: 20 },
  leverThumb: {
    position: 'absolute', left: '50%', width: 46, height: 46,
    transform: 'translate(-50%, 50%)',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 35%, #2a3654, #131b2e)',
    border: '2px solid #7CFFB2',
    boxShadow: '0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
  leverLabel: {
    marginTop: 6, fontSize: 11, fontWeight: 800, letterSpacing: 2,
    color: 'rgba(200,215,255,0.8)', fontFamily: 'ui-monospace, Menlo, monospace',
  },
  leverVal: { fontSize: 12, color: 'rgba(159,208,255,0.9)', height: 14 },

  // Tilt / gyro panel, pinned right.
  gyroPanel: {
    position: 'absolute',
    right: 16,
    bottom: 132,
    width: 84,
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  horizonWrap: {
    position: 'relative',
    width: 72, height: 72, borderRadius: '50%',
    background: PANEL, border: BORDER, overflow: 'hidden',
    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
  },
  horizon: {
    position: 'absolute', left: '50%', top: '50%', width: 120, height: 120,
    transform: 'translate(-50%, -50%)',
    background:
      'linear-gradient(180deg, rgba(120,170,255,0.18) 0%, rgba(120,170,255,0.18) 50%, rgba(124,255,178,0.16) 50%, rgba(124,255,178,0.16) 100%)',
  },
  horizonRule: {
    position: 'absolute', left: 10, right: 10, top: '50%', height: 2,
    transform: 'translateY(-1px)',
    background: 'rgba(255,255,255,0.7)', borderRadius: 2,
  },
  gyroBtn: {
    width: '100%', padding: '9px 0', borderRadius: 12,
    background: PANEL, border: BORDER, color: 'rgba(200,215,255,0.85)',
    fontSize: 12, fontWeight: 800, letterSpacing: 1.5,
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
  gyroBtnOn: {
    background: 'rgba(124,255,178,0.18)',
    borderColor: 'rgba(124,255,178,0.6)',
    color: '#bfffd9',
  },
  gyroSub: {
    width: '100%', padding: '6px 0', borderRadius: 10,
    background: PANEL, border: BORDER, color: 'rgba(180,200,255,0.75)',
    fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
  gyroSubOn: {
    background: 'rgba(159,208,255,0.18)', borderColor: 'rgba(159,208,255,0.55)', color: '#dbe8ff',
  },

  // Bottom slider row.
  sliderRow: {
    position: 'absolute',
    left: 0, right: 0, bottom: 16,
    display: 'flex',
    gap: 10,
    padding: '0 16px',
    pointerEvents: 'none',
  },
  sliderWrap: { flex: 1, pointerEvents: 'auto' },
  sliderLabel: {
    fontSize: 10, fontWeight: 800, letterSpacing: 2, marginBottom: 5,
    color: 'rgba(200,215,255,0.75)', textAlign: 'center',
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
  sliderTrack: {
    position: 'relative', height: 52, borderRadius: 26,
    background: PANEL, border: BORDER,
    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
    overflow: 'hidden', touchAction: 'none',
  },
  sliderCenterTick: {
    position: 'absolute', top: 8, bottom: 8, left: '50%', width: 1,
    background: 'rgba(159,208,255,0.35)',
  },
  sliderFill: { position: 'absolute', top: 8, bottom: 8, borderRadius: 18 },
  sliderThumb: {
    position: 'absolute', top: '50%', width: 42, height: 42,
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 50% 35%, #2a3654, #131b2e)',
    border: '2px solid #9fd0ff',
    boxShadow: '0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.15)',
  },
};
