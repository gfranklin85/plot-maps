'use client';

// ── usePlotPadLink ────────────────────────────────────────────────────
//
// The web half of the localhost link to PlotPad.exe (the native OS-click
// helper). Greg 2026-07-16. Google's gmp-map-3d only opens a parcel on a
// TRUSTED (real OS) click — synthetic clicks are ignored — so the gamepad A
// must trigger a REAL OS click AT the reticle. This hook tells the helper
// WHERE the reticle is (a 0..1 viewport fraction) over a localhost WebSocket;
// on A the helper clicks that exact pixel (cursor- and monitor-independent).
//
//   Web → Pad:  {type:"reticle", x, y}   (on connect + on change, debounced)
//   Pad → Web:  {type:"hello", version}  → dispatch `plot:pad-hello`
//               {type:"clicked"} / {type:"error", msg}  (telemetry)
//
// ws://127.0.0.1 (numeric loopback — a secure context in Chromium, and dodges
// Firefox/corporate DNS edge cases). If the helper isn't running, the socket
// never opens and `linkActive` stays false → the map falls back to cursor-
// follow + JS self-resolve (today's behavior). memory/project_plot_pad_os_click_helper

import { useEffect, useRef, useState } from 'react';

// Shared port ladder — MUST match PlotPad's PORT_LADDER (main.rs), same order.
const PORT_LADDER = [47600, 47601, 47602, 47603];
const RECONNECT_MIN_MS = 800;
const RECONNECT_MAX_MS = 5000;
const RETICLE_DEBOUNCE_MS = 30;

interface Args {
  reticle: { xFraction: number; yFraction: number };
  enabled: boolean;
}

export function usePlotPadLink({ reticle, enabled }: Args): { linkActive: boolean } {
  const [linkActive, setLinkActive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(RECONNECT_MIN_MS);
  const ladderRef = useRef(0);           // which port we're trying
  const sendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live reticle in a ref so the socket send reads the latest without
  // re-opening the connection on every drag.
  const reticleRef = useRef(reticle);
  reticleRef.current = reticle;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    const sendReticle = () => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const { xFraction, yFraction } = reticleRef.current;
      try {
        ws.send(JSON.stringify({ type: 'reticle', x: xFraction, y: yFraction }));
      } catch { /* socket dying — reconnect handles it */ }
    };

    const scheduleReconnect = () => {
      if (disposed || !enabledRef.current) return;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(connect, backoffRef.current);
      backoffRef.current = Math.min(backoffRef.current * 1.6, RECONNECT_MAX_MS);
    };

    const connect = () => {
      if (disposed) return;
      const port = PORT_LADDER[ladderRef.current % PORT_LADDER.length];
      let ws: WebSocket;
      try {
        ws = new WebSocket(`ws://127.0.0.1:${port}`);
      } catch {
        ladderRef.current += 1;
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        backoffRef.current = RECONNECT_MIN_MS;
        sendReticle();                 // seed the helper with the current spot
      };
      ws.onmessage = (e) => {
        let msg: { type?: string; version?: string } | null = null;
        try { msg = JSON.parse(typeof e.data === 'string' ? e.data : ''); } catch { return; }
        if (!msg) return;
        if (msg.type === 'hello') {
          // Truthful "helper connected" — lights every indicator via the
          // existing usePlotPadStatus listener.
          setLinkActive(true);
          try { window.dispatchEvent(new Event('plot:pad-hello')); } catch { /* ignore */ }
        }
        // 'clicked' / 'error' available here for future telemetry/toast.
      };
      ws.onerror = () => { /* onclose follows; handled there */ };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setLinkActive(false);
        // Advance the ladder so a bind-shifted server is found next try.
        ladderRef.current += 1;
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (sendDebounceRef.current) clearTimeout(sendDebounceRef.current);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) { ws.onclose = null; try { ws.close(); } catch { /* ignore */ } }
      setLinkActive(false);
    };
  }, [enabled]);

  // Push reticle updates (debounced) whenever the fraction changes.
  useEffect(() => {
    if (!enabled) return;
    if (sendDebounceRef.current) clearTimeout(sendDebounceRef.current);
    sendDebounceRef.current = setTimeout(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: 'reticle', x: reticle.xFraction, y: reticle.yFraction }));
      } catch { /* ignore */ }
    }, RETICLE_DEBOUNCE_MS);
  }, [enabled, reticle.xFraction, reticle.yFraction]);

  return { linkActive };
}
