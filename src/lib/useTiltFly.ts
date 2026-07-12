'use client';

// ── useTiltFly ────────────────────────────────────────────────────────
//
// Fly the 3D map's CLIMB by TILTING the phone forward/back, hands already on
// the sticks. Absolute phone POSITION is unmeasurable (accelerometer drifts in
// ~1s); DeviceOrientation (gyro+accel fused, absolute) tilt is rock-solid.
//
// Model (Greg, 2026-07-11 — refined):
//   • CLIMB ONLY. Tilt forward (nose down) = dip, tilt back (nose up) = climb.
//     Left/right tilt is ignored (the LOOK stick owns yaw).
//   • Neutral ("level") is CALIBRATED ONCE via a 3-2-1 countdown, then LOCKED.
//     It never moves on its own. First stick touch of the session kicks the
//     first calibration; a double-tap on a stick re-calibrates to your current
//     pose. No on-screen button.
//   • ARM by touch: while a thumb is on a stick, tilt drives climb (rides on
//     top of the stick frame — see FlightControls). Fingers off = paused;
//     neutral stays put, so re-gripping resumes from the same level.
//
// This hook owns the SENSOR + calibration + climb value. FlightControls reads
// `climbValue()` inside its frame recompute so climb merges with the stick
// axes (one writer to pushTouchFrame, no clobber). memory/project_tilt_to_fly

import { useCallback, useEffect, useRef, useState } from 'react';

const DEAD_DEG = 3.5;   // ±3.5° of neutral = no climb (rest jitter)
const FULL_DEG = 26;    // ~26° tilt from neutral = full climb/dip
const EMA = 0.2;        // low-pass smoothing
const INVERT = false;   // nose-up climbs; flip if it feels backwards
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

export interface TiltFly {
  supported: boolean;
  /** null = not calibrating; 3..1 = countdown number; 0 = just "Set". */
  countdown: number | null;
  /** true once neutral is locked (first calibration done). */
  calibrated: boolean;
  /** whether the sticks are currently being touched (tilt-climb armed). */
  setArmed: (armed: boolean) => void;
  /** kick the 3-2-1 calibration (first touch, or double-tap re-cal). */
  calibrate: () => Promise<void>;
  /** current shaped climb value, -1..1 (read by FlightControls each frame). */
  climbValue: () => number;
}

export function useTiltFly(): TiltFly {
  const [supported, setSupported] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [calibrated, setCalibrated] = useState(false);

  const neutralBeta = useRef<number | null>(null); // locked "level"
  const smoothBeta = useRef<number>(0);            // low-passed live beta
  const armed = useRef(false);
  const listening = useRef(false);
  const permission = useRef<'unknown' | 'granted' | 'denied'>('unknown');
  const cdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported('DeviceOrientationEvent' in window);
    const D = window.DeviceOrientationEvent as unknown as DOE | undefined;
    if (D && typeof D.requestPermission !== 'function') permission.current = 'granted';
  }, []);

  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    const beta = e.beta ?? 0; // front/back tilt (deg)
    smoothBeta.current = smoothBeta.current + (beta - smoothBeta.current) * EMA;
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
      } catch {
        permission.current = 'denied';
        return false;
      }
    }
    permission.current = 'granted';
    return true;
  }, []);

  // 3-2-1 countdown → lock neutral to the current (settled) pose at "Set".
  const calibrate = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!(await ensurePermission())) return;
    startListening();
    if (cdTimer.current) clearTimeout(cdTimer.current);

    let n = COUNTDOWN_FROM;
    setCountdown(n);
    const tick = () => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
        cdTimer.current = setTimeout(tick, 1000);
      } else {
        // "Set": lock neutral to the current smoothed beta.
        neutralBeta.current = smoothBeta.current;
        setCalibrated(true);
        setCountdown(0);                       // flash "Set"
        cdTimer.current = setTimeout(() => setCountdown(null), 700);
      }
    };
    cdTimer.current = setTimeout(tick, 1000);
  }, [ensurePermission, startListening]);

  const setArmed = useCallback((a: boolean) => { armed.current = a; }, []);

  const climbValue = useCallback(() => {
    if (!armed.current || neutralBeta.current == null) return 0;
    let d = smoothBeta.current - neutralBeta.current; // + = nose up
    if (INVERT) d = -d;
    return shape(d);
  }, []);

  useEffect(() => () => {
    if (typeof window !== 'undefined') window.removeEventListener('deviceorientation', onOrient);
    if (cdTimer.current) clearTimeout(cdTimer.current);
  }, [onOrient]);

  return { supported, countdown, calibrated, setArmed, calibrate, climbValue };
}
