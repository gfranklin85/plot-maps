'use client';

import { useEffect, useRef, useState } from 'react';

// ── usePlotPadStatus ──────────────────────────────────────────────────
//
// Three-state flight-readiness signal for the landing chip + map.
//
// The browser is sandboxed — it CANNOT see whether PlotPad.exe is on disk
// or running. But Plot Pad's whole job is to feed the browser real gamepad
// input, so we detect it by its EFFECT:
//   • 'none'      — no controller connected.
//   • 'connected' — a controller is connected, but we've seen no live input
//                   yet (likely Plot Pad not installed/running, OR they just
//                   haven't touched it). Nudge the install.
//   • 'active'    — live gamepad button/axis activity is flowing → the user
//                   is flight-ready. This is the "installed correctly"
//                   indicator, proven by behavior, not a fake file check.
//
// HANDSHAKE-READY: if a future Plot Pad build pings a localhost endpoint or
// dispatches a `plot:pad-hello` window event, we flip to a verified 'active'
// immediately. We listen for that event now so the helper upgrade is
// drop-in. memory/project_plot_pad_os_click_helper

export type PlotPadStatus = 'none' | 'connected' | 'active';

// How long after the last gamepad input we still consider the pad "active".
const ACTIVE_WINDOW_MS = 4000;
// Axis movement above this (0..1) counts as real input (ignores stick drift).
const AXIS_THRESHOLD = 0.25;

export function usePlotPadStatus(): {
  status: PlotPadStatus;
  connected: boolean;
  verified: boolean;
} {
  const [status, setStatus] = useState<PlotPadStatus>('none');
  const [verified, setVerified] = useState(false);
  const lastInputAtRef = useRef<number>(0);
  const prevButtonsRef = useRef<Map<number, boolean[]>>(new Map());

  useEffect(() => {
    let raf = 0;
    let mounted = true;

    const anyConnected = () => {
      const pads = navigator.getGamepads?.() ?? [];
      return Array.from(pads).some((p) => p && p.connected);
    };

    // Future helper handshake: a `plot:pad-hello` event flips us to a
    // verified-active state without inferring from input.
    const onHello = () => {
      if (!mounted) return;
      setVerified(true);
      lastInputAtRef.current = performance.now();
      setStatus('active');
    };
    window.addEventListener('plot:pad-hello', onHello);

    const tick = () => {
      if (!mounted) return;
      const pads = navigator.getGamepads?.() ?? [];
      const connected = Array.from(pads).some((p) => p && p.connected);

      // Detect live input: any button newly pressed, or any axis past
      // threshold, on any connected pad.
      let sawInput = false;
      for (const p of pads) {
        if (!p || !p.connected) continue;
        // axes
        for (const a of p.axes) {
          if (Math.abs(a) > AXIS_THRESHOLD) { sawInput = true; break; }
        }
        // buttons (edge: pressed now)
        const prev = prevButtonsRef.current.get(p.index) ?? [];
        const cur = p.buttons.map((b) => b.pressed);
        for (let i = 0; i < cur.length; i++) {
          if (cur[i] && !prev[i]) { sawInput = true; }
        }
        prevButtonsRef.current.set(p.index, cur);
      }
      if (sawInput) lastInputAtRef.current = performance.now();

      const recentlyActive =
        performance.now() - lastInputAtRef.current < ACTIVE_WINDOW_MS;

      const next: PlotPadStatus = !connected
        ? 'none'
        : recentlyActive
          ? 'active'
          : 'connected';
      setStatus((s) => (s === next ? s : next));

      raf = requestAnimationFrame(tick);
    };

    // Seed + react to connect/disconnect immediately.
    const refresh = () => setStatus(anyConnected() ? (s) => (s === 'active' ? s : 'connected') : 'none');
    window.addEventListener('gamepadconnected', refresh);
    window.addEventListener('gamepaddisconnected', refresh);
    refresh();
    raf = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('plot:pad-hello', onHello);
      window.removeEventListener('gamepadconnected', refresh);
      window.removeEventListener('gamepaddisconnected', refresh);
    };
  }, []);

  return { status, connected: status !== 'none', verified };
}
