'use client';

// ── useTiltFly ────────────────────────────────────────────────────────
//
// Fly by TILTING the phone. Absolute phone POSITION is unmeasurable
// (accelerometer drifts in ~1s); DeviceOrientation (gyro+accel fused,
// absolute) tilt is rock-solid.
//
// Model (Greg, settled 2026-07-12):
//   • CLIMB = tilt forward/back (beta).  YAW = tilt left/right (gamma).
//   • Neutral ("level") is CALIBRATED BY TOUCH — a 3·2·1·Set countdown locks
//     your current pose. Trigger: double-tap a stick (FlightControls calls
//     calibrate()).
//   • After calibration tilt is ALWAYS LIVE — NO finger needed. It only stops
//     on re-calibration or leaving flight. A held angle keeps climbing/turning
//     until you re-level (intended); the dead-zone absorbs resting jitter.
//
// This hook owns the SENSOR + calibration and writes climb+yaw to the synthetic
// gamepad EVERY FRAME (its own RAF) so it flies hands-free. It MERGES with the
// PAN stick: FlightControls publishes the stick's lx/ly/rx into a shared ref
// (setStickAxes); this hook folds them into each frame it pushes, so one
// writer owns pushTouchFrame and neither clobbers the other.
// memory/project_tilt_to_fly, project_phone_as_controller

import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';

const DEAD_DEG = 3.5;   // ±3.5° of neutral = no motion (rest jitter)
const FULL_DEG = 26;    // ~26° tilt from neutral = full deflection
const EMA = 0.2;        // low-pass smoothing
const CLIMB_INVERT = false; // nose-up climbs; flip if backwards
const YAW_INVERT = false;   // tilt-right turns right; flip if backwards
const COUNTDOWN_FROM = 3;

type DOE = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
function shape(deg: number): number {
  const a = Math.abs(deg);
  if (a <= DEAD_DEG) return 0;
  const n = clamp((a - DEAD_DEG) / (FULL_DEG - DEAD_DEG)) * Math.sign(deg);
  return n * Math.abs(n); // ease near center, firm at the edges
}

export interface StickAxes { lx: number; ly: number; rx: number; ry: number; }

export interface TiltFly {
  supported: boolean;
  /** null = not calibrating; 3..1 = countdown; 0 = "Set" flash. */
  countdown: number | null;
  calibrated: boolean;
  /** true when this hook is the active flight style (drives the RAF writer). */
  enabled: boolean;
  /** FlightControls publishes the PAN stick each frame so tilt can merge it. */
  setStickAxes: (a: StickAxes) => void;
  /** kick the 3·2·1 calibration (double-tap a stick). */
  calibrate: () => Promise<void>;
  /** live shaped output (−1..1 each), read per-frame by the edge indicator.
   *  climb = tilt fwd/back, yaw = tilt left/right. 0 when not calibrated. */
  live: React.MutableRefObject<{ climb: number; yaw: number }>;
}

export function useTiltFly(enabled: boolean): TiltFly {
  const [supported, setSupported] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [calibrated, setCalibrated] = useState(false);

  const neutral = useRef<{ beta: number; gamma: number } | null>(null);
  const smooth = useRef<{ beta: number; gamma: number } | null>(null);
  const stick = useRef<StickAxes>({ lx: 0, ly: 0, rx: 0, ry: 0 });
  const live = useRef<{ climb: number; yaw: number }>({ climb: 0, yaw: 0 });
  const listening = useRef(false);
  const permission = useRef<'unknown' | 'granted' | 'denied'>('unknown');
  const cdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported('DeviceOrientationEvent' in window);
    const D = window.DeviceOrientationEvent as unknown as DOE | undefined;
    if (D && typeof D.requestPermission !== 'function') permission.current = 'granted';
  }, []);

  // Remap raw device beta/gamma into the USER's frame based on screen
  // orientation, so "tilt forward/back = climb" and "tilt left/right = yaw"
  // hold whether the phone is portrait or landscape. We store the remapped
  // values as {beta: climbAxis, gamma: yawAxis} so the rest of the hook is
  // orientation-agnostic. Greg 2026-07-12.
  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    const rawB = e.beta ?? 0, rawG = e.gamma ?? 0;
    const angle = (typeof window !== 'undefined'
      && (window.screen?.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0)) || 0;
    let climbAxis = rawB, yawAxis = rawG;
    if (angle === 90) { climbAxis = -rawG; yawAxis = rawB; }        // rotated left
    else if (angle === 270 || angle === -90) { climbAxis = rawG; yawAxis = -rawB; } // rotated right
    else if (angle === 180) { climbAxis = -rawB; yawAxis = -rawG; } // upside down
    const s = smooth.current ?? { beta: climbAxis, gamma: yawAxis };
    s.beta = s.beta + (climbAxis - s.beta) * EMA;
    s.gamma = s.gamma + (yawAxis - s.gamma) * EMA;
    smooth.current = s;
  }, []);

  const startListening = useCallback(() => {
    if (listening.current || typeof window === 'undefined') return;
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    listening.current = true;
  }, [onOrient]);

  const ensurePermission = useCallback(async () => {
    if (permission.current === 'granted') return true;
    if (permission.current === 'denied') return false;
    const D = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as unknown as DOE | undefined;
    if (D && typeof D.requestPermission === 'function') {
      try {
        const res = await D.requestPermission!();
        permission.current = res;
        return res === 'granted';
      } catch { permission.current = 'denied'; return false; }
    }
    permission.current = 'granted';
    return true;
  }, []);

  const setStickAxes = useCallback((a: StickAxes) => { stick.current = a; }, []);

  // 3·2·1 → lock neutral to the current settled pose at "Set".
  const calibrate = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!(await ensurePermission())) return;
    startListening();
    if (cdTimer.current) clearTimeout(cdTimer.current);
    let n = COUNTDOWN_FROM;
    setCountdown(n);
    const tick = () => {
      n -= 1;
      if (n > 0) { setCountdown(n); cdTimer.current = setTimeout(tick, 1000); }
      else {
        neutral.current = smooth.current ? { ...smooth.current } : { beta: 0, gamma: 0 };
        setCalibrated(true);
        setCountdown(0);
        cdTimer.current = setTimeout(() => setCountdown(null), 700);
      }
    };
    cdTimer.current = setTimeout(tick, 1000);
  }, [ensurePermission, startListening]);

  // Always-live RAF writer: while enabled + calibrated, push climb+yaw (from
  // tilt) MERGED with the PAN stick, every frame, hands-free.
  useEffect(() => {
    if (!enabled) return;
    startListening();
    let raf = 0;
    const loop = () => {
      const f: PadFrame = { ...NEUTRAL };
      const st = stick.current;
      f.lx = st.lx; f.ly = st.ly; f.rx = st.rx; f.ry = st.ry;
      if (calibrated && neutral.current && smooth.current) {
        let dBeta = smooth.current.beta - neutral.current.beta;   // + nose up
        let dGamma = smooth.current.gamma - neutral.current.gamma; // + tilt right
        if (CLIMB_INVERT) dBeta = -dBeta;
        if (YAW_INVERT) dGamma = -dGamma;
        const climb = shape(dBeta);
        const yaw = shape(dGamma);
        live.current.climb = climb;
        live.current.yaw = yaw;
        f.rt = climb > 0 ? climb : 0;
        f.lt = climb < 0 ? -climb : 0;
        f.rx = clamp(f.rx + yaw); // tilt-yaw folds onto the (usually 0) rx
      } else {
        live.current.climb = 0; live.current.yaw = 0;
      }
      pushTouchFrame(f);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      pushTouchFrame({ ...NEUTRAL });
    };
  }, [enabled, calibrated, startListening]);

  useEffect(() => () => {
    if (typeof window !== 'undefined') window.removeEventListener('deviceorientation', onOrient);
    if (cdTimer.current) clearTimeout(cdTimer.current);
  }, [onOrient]);

  return { supported, countdown, calibrated, enabled, setStickAxes, calibrate, live };
}
