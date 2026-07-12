'use client';

// ── useTiltFly ────────────────────────────────────────────────────────
//
// Fly the 3D map by TILTING the phone (a yoke), staying seated. Absolute
// phone POSITION is unmeasurable (accelerometer integration drifts in ~1s),
// but DeviceOrientation (gyro+accel fused, absolute) gives rock-solid tilt.
// So: tilt forward/back = climb/dip, tilt left/right = bank/yaw.
//
// Model (Greg, 2026-07-11): FULL ATTITUDE + hold-to-tilt DEAD-MAN switch.
//   • beginHold() captures your CURRENT pose as neutral (recline/flat/propped
//     all fine) and starts steering.
//   • while held, tilt from neutral drives the synthetic gamepad via
//     pushTouchFrame → the existing FLY_3D loop flies, unchanged.
//   • endHold() writes NEUTRAL and drops calibration, so the NEXT hold
//     re-captures a fresh neutral. Set the phone down → it stops. No drift.
//
// Comfort: dead-zone (small tilts ignored), range normalize (~FULL_DEG = full
// deflection), low-pass EMA (kills jitter), rate stays gentle. iOS 13+ needs
// a one-time DeviceOrientationEvent.requestPermission() from a user gesture —
// beginHold() is called from a pointerdown, so it can carry the grant.
// memory/project_tilt_to_fly, project_phone_as_controller

import { useCallback, useEffect, useRef, useState } from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';

// ── tuning ──
const DEAD_DEG = 4;     // tilt within ±4° of neutral = no motion (rest jitter)
const FULL_DEG = 28;    // ~28° tilt from neutral = full deflection
const EMA = 0.22;       // low-pass smoothing (0..1; lower = smoother/laggier)
const CLIMB_INVERT = false; // tilt BACK (nose up) climbs; flip if it feels wrong
const YAW_INVERT = false;   // tilt RIGHT yaws right; flip if it feels wrong

type DOE = DeviceOrientationEvent & {
  // iOS-only permission gate
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
// dead-zone + normalize + gentle center curve (x*|x|)
function shape(deg: number): number {
  const a = Math.abs(deg);
  if (a <= DEAD_DEG) return 0;
  const n = clamp((a - DEAD_DEG) / (FULL_DEG - DEAD_DEG)) * Math.sign(deg);
  return n * Math.abs(n); // ease near center, firm at the edges
}

export interface TiltFly {
  supported: boolean;
  permission: 'unknown' | 'granted' | 'denied';
  active: boolean;
  /** Live shaped output while held (for a HUD indicator): -1..1 each. */
  readonly climb: number;
  readonly bank: number;
  beginHold: () => Promise<void>;
  endHold: () => void;
}

export function useTiltFly(): TiltFly {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [active, setActive] = useState(false);

  const neutral = useRef<{ beta: number; gamma: number } | null>(null);
  const smooth = useRef<{ beta: number; gamma: number } | null>(null);
  const live = useRef<{ climb: number; bank: number }>({ climb: 0, bank: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported('DeviceOrientationEvent' in window);
    // Android grants implicitly; iOS needs the requestPermission() gate.
    const D = (window as unknown as { DeviceOrientationEvent?: DOE }).DeviceOrientationEvent;
    if (D && typeof (D as unknown as DOE).requestPermission !== 'function') {
      setPermission('granted');
    }
  }, []);

  const onOrient = useCallback((e: DeviceOrientationEvent) => {
    if (!neutral.current) return;
    const beta = e.beta ?? 0;   // front/back tilt (deg)
    const gamma = e.gamma ?? 0;  // left/right tilt (deg)
    // low-pass
    const s = smooth.current ?? { beta, gamma };
    s.beta = s.beta + (beta - s.beta) * EMA;
    s.gamma = s.gamma + (gamma - s.gamma) * EMA;
    smooth.current = s;

    let dBeta = s.beta - neutral.current.beta;   // + = nose up (tilt back)
    let dGamma = s.gamma - neutral.current.gamma; // + = tilt right
    if (CLIMB_INVERT) dBeta = -dBeta;
    if (YAW_INVERT) dGamma = -dGamma;

    const climb = shape(dBeta);  // -1..1
    const bank = shape(dGamma);  // -1..1
    live.current = { climb, bank };

    // Map to the synthetic pad (same axes the sticks use): climb → rt/lt,
    // bank/yaw → rx. Everything else neutral while tilting.
    const f: PadFrame = { ...NEUTRAL };
    f.rt = climb > 0 ? climb : 0;
    f.lt = climb < 0 ? -climb : 0;
    f.rx = bank;
    pushTouchFrame(f);
  }, []);

  const beginHold = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const D = (window as unknown as { DeviceOrientationEvent?: DOE }).DeviceOrientationEvent;
    // iOS permission gate (must be called from a user gesture — this is one)
    if (D && typeof (D as unknown as DOE).requestPermission === 'function' && permission !== 'granted') {
      try {
        const res = await (D as unknown as DOE).requestPermission!();
        setPermission(res);
        if (res !== 'granted') return;
      } catch {
        setPermission('denied');
        return;
      }
    }
    // capture neutral on the first frame after we start listening
    neutral.current = null;
    smooth.current = null;
    const capture = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0, gamma = e.gamma ?? 0;
      neutral.current = { beta, gamma };
      smooth.current = { beta, gamma };
      window.removeEventListener('deviceorientation', capture);
    };
    window.addEventListener('deviceorientation', capture, { passive: true });
    window.addEventListener('deviceorientation', onOrient, { passive: true });
    setActive(true);
  }, [onOrient, permission]);

  const endHold = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('deviceorientation', onOrient);
    neutral.current = null;
    smooth.current = null;
    live.current = { climb: 0, bank: 0 };
    pushTouchFrame({ ...NEUTRAL }); // dead-man: freeze immediately
    setActive(false);
  }, [onOrient]);

  // safety: on unmount, release
  useEffect(() => () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', onOrient);
      pushTouchFrame({ ...NEUTRAL });
    }
  }, [onOrient]);

  return {
    supported,
    permission,
    active,
    get climb() { return live.current.climb; },
    get bank() { return live.current.bank; },
    beginHold,
    endHold,
  };
}
