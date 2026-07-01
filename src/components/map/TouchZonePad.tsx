'use client';

// ── TouchZonePad ──────────────────────────────────────────────────────
//
// The ZONE PAD (Greg, 2026-06-28), ported from the PlotFly Expo app's
// PlotController.tsx to the BROWSER (DOM Pointer Events instead of RN's
// GestureResponder). The whole pad is split into vertical zones — no circles
// to hit, every pixel is a zone, so a thumb can't miss. Each zone is a
// FLOATING ELASTIC STICK: wherever you press becomes neutral-center,
// displacement = input, snaps to zero on release.
//
// Per side, outer→inner:
//   LEFT  Pan   X = strafe      Y = forward/back
//   LEFT  Climb X = strafe      Y = climb/dip
//   SEAM  Both  X = strafe/bank Y = forward + climb FUSED
//   RIGHT Climb X = yaw         Y = climb/dip
//   RIGHT Look  X = yaw         Y = pitch
//
// Output → the synthetic gamepad via pushTouchFrame(), so Plot's existing
// flight loop drives FLY_3D unchanged. memory/project_phone_as_controller

import { useCallback, useEffect, useRef, useState } from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';

const TRAVEL = 84;       // px of drag for full deflection (elastic range)
const SHOW_ZONES = true; // faint zone tints while learning the layout

type ZoneId = 'lPan' | 'lClimb' | 'seamL' | 'seamR' | 'rClimb' | 'rLook';
type Kind = { type: 'zone'; zone: ZoneId } | { type: 'btn'; key: 'a' | 'b' };

// Hit-test order: seams + climb rings win over the wide pan/look zones on
// overlap (a thumb near the seam should grab the seam).
const HIT_ORDER: ZoneId[] = ['seamL', 'seamR', 'lClimb', 'rClimb', 'lPan', 'rLook'];
// Visual left→right layout order.
const VISUAL_ORDER: ZoneId[] = ['lPan', 'lClimb', 'seamL', 'seamR', 'rClimb', 'rLook'];
const ZONE_FLEX: Record<ZoneId, number> = { lPan: 5, lClimb: 2, seamL: 0.7, seamR: 0.7, rClimb: 2, rLook: 5 };

function mapZone(zone: ZoneId, nx: number, ny: number): Partial<PadFrame> {
  const up = ny; // +up
  const c: Partial<PadFrame> = {};
  switch (zone) {
    case 'lPan':   c.lx = nx; c.ly = -up; break;                          // strafe + fwd/back (fwd = −ly)
    case 'lClimb': c.lx = nx; if (up >= 0) c.rt = up; else c.lt = -up; break;
    case 'rClimb': c.rx = nx; if (up >= 0) c.rt = up; else c.lt = -up; break;
    case 'rLook':  c.rx = nx; c.ry = -up; break;                          // yaw + pitch
    case 'seamL':
    case 'seamR':                                                          // fuse forward + climb
      c.lx = nx;
      if (up >= 0) { c.ly = -up; c.rt = up; } else { c.ly = -up; c.lt = -up; }
      break;
  }
  return c;
}

export default function TouchZonePad({ onButton }: { onButton?: (k: 'a' | 'b', down: boolean) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const zoneEls = useRef<Partial<Record<ZoneId, HTMLDivElement | null>>>({});
  const frame = useRef<PadFrame>({ ...NEUTRAL });
  const claims = useRef<Map<number, Kind>>(new Map());
  const origin = useRef<Map<number, { x: number; y: number }>>(new Map());
  const contrib = useRef<Map<number, Partial<PadFrame>>>(new Map());
  const [btnDown, setBtnDown] = useState<{ a: boolean; b: boolean }>({ a: false, b: false });

  const recompute = useCallback(() => {
    const f: PadFrame = { ...NEUTRAL };
    let lt = 0, rt = 0;
    for (const c of Array.from(contrib.current.values())) {
      if (c.lx) f.lx += c.lx;
      if (c.ly) f.ly += c.ly;
      if (c.rx) f.rx += c.rx;
      if (c.ry) f.ry += c.ry;
      if (c.rt) rt += c.rt;
      if (c.lt) lt += c.lt;
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    f.lx = clamp(f.lx); f.ly = clamp(f.ly); f.rx = clamp(f.rx); f.ry = clamp(f.ry);
    f.rt = Math.max(0, Math.min(1, rt));
    f.lt = Math.max(0, Math.min(1, lt));
    f.a = frame.current.a; f.b = frame.current.b;
    frame.current = f;
    pushTouchFrame(f);
  }, []);

  const zoneAt = useCallback((x: number, y: number): ZoneId | null => {
    for (const z of HIT_ORDER) {
      const el = zoneEls.current[z];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
    }
    return null;
  }, []);

  const setBtn = useCallback((key: 'a' | 'b', isDown: boolean) => {
    frame.current[key] = isDown;
    setBtnDown((d) => ({ ...d, [key]: isDown }));
    pushTouchFrame(frame.current);
    onButton?.(key, isDown);
  }, [onButton]);

  const driveZone = useCallback((zone: ZoneId, id: number, x: number, y: number) => {
    const o = origin.current.get(id);
    if (!o) return;
    const nx = Math.max(-1, Math.min(1, (x - o.x) / TRAVEL));
    const ny = Math.max(-1, Math.min(1, -(y - o.y) / TRAVEL)); // +ny = up
    contrib.current.set(id, mapZone(zone, nx, ny));
    recompute();
  }, [recompute]);

  const release = useCallback((id: number) => {
    const claim = claims.current.get(id);
    if (claim?.type === 'btn') setBtn(claim.key, false);
    claims.current.delete(id);
    contrib.current.delete(id);
    origin.current.delete(id);
    recompute();
  }, [recompute, setBtn]);

  // Pointer handlers on the root; buttons handle their own via stopPropagation.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onDown = (e: PointerEvent) => {
      const z = zoneAt(e.clientX, e.clientY);
      if (!z) return;
      claims.current.set(e.pointerId, { type: 'zone', zone: z });
      origin.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { root.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      const claim = claims.current.get(e.pointerId);
      if (claim?.type === 'zone') { driveZone(claim.zone, e.pointerId, e.clientX, e.clientY); e.preventDefault(); }
    };
    const onUp = (e: PointerEvent) => { if (claims.current.has(e.pointerId)) { release(e.pointerId); e.preventDefault(); } };

    root.addEventListener('pointerdown', onDown, { passive: false });
    root.addEventListener('pointermove', onMove, { passive: false });
    root.addEventListener('pointerup', onUp, { passive: false });
    root.addEventListener('pointercancel', onUp, { passive: false });
    return () => {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
    };
  }, [zoneAt, driveZone, release]);

  const zoneClass = (z: ZoneId) =>
    z === 'seamL' || z === 'seamR' ? 'tzp__zone tzp__zone--seam'
    : z === 'lClimb' || z === 'rClimb' ? 'tzp__zone tzp__zone--climb'
    : 'tzp__zone tzp__zone--primary';

  return (
    <div ref={rootRef} className={`tzp ${SHOW_ZONES ? 'tzp--tinted' : ''}`}>
      <div className="tzp__row">
        {VISUAL_ORDER.map((z) => (
          <div
            key={z}
            ref={(n) => { zoneEls.current[z] = n; }}
            className={zoneClass(z)}
            style={{ flex: ZONE_FLEX[z] }}
          >
            {SHOW_ZONES && z === 'lPan' && <span className="tzp__label">PAN</span>}
            {SHOW_ZONES && z === 'rLook' && <span className="tzp__label">LOOK</span>}
            {SHOW_ZONES && (z === 'lClimb' || z === 'rClimb') && <span className="tzp__label">CLIMB · DIP</span>}
          </div>
        ))}
      </div>

      {/* A / B — top corners, above the flight zones */}
      <button
        type="button"
        className={`tzp__btn tzp__btn--b ${btnDown.b ? 'is-down' : ''}`}
        onPointerDown={(e) => { e.stopPropagation(); setBtn('b', true); }}
        onPointerUp={(e) => { e.stopPropagation(); setBtn('b', false); }}
        onPointerCancel={() => setBtn('b', false)}
      >B</button>
      <button
        type="button"
        className={`tzp__btn tzp__btn--a ${btnDown.a ? 'is-down' : ''}`}
        onPointerDown={(e) => { e.stopPropagation(); setBtn('a', true); }}
        onPointerUp={(e) => { e.stopPropagation(); setBtn('a', false); }}
        onPointerCancel={() => setBtn('a', false)}
      >A</button>
    </div>
  );
}
