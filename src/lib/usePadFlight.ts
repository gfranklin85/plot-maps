'use client';

// ── usePadFlight ──────────────────────────────────────────────────────
//
// Bridges the on-screen TwoStickPad to Plot's flight loop. The pad reports
// normalized axes (lx/ly/rx/ry/rt/lt); we push them into the synthetic
// gamepad (touchPadBridge) so the EXISTING flight loop flies them exactly
// like a desktop controller — no special-casing. A RAF keeps the pad frame
// live (the loop polls the pad each frame). memory/project_mobile_map_google_native

import { useCallback, useEffect, useRef } from 'react';
import { NEUTRAL, pushTouchFrame, type PadFrame } from '@/lib/touchPadBridge';
import type { PadOutput } from '@/components/map/TwoStickPad';

export function usePadFlight(enabled: boolean) {
  const out = useRef<PadOutput>({ lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0 });

  const setOutput = useCallback((o: PadOutput) => {
    out.current = o;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const loop = () => {
      const o = out.current;
      const f: PadFrame = { ...NEUTRAL, lx: o.lx, ly: o.ly, rx: o.rx, ry: o.ry, lt: o.lt, rt: o.rt };
      pushTouchFrame(f);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); pushTouchFrame({ ...NEUTRAL }); };
  }, [enabled]);

  return { setOutput };
}
