'use client';

// ── /fly — the RECEIVER (big-screen) page ─────────────────────────────
//
// This is what a TV / laptop / desktop browser opens. It renders the Plot
// 3D flight map full-screen and lets a PHONE (PlotFly) fly it over the
// network — the phone is the controller, this screen is the flight.
//
// How it works:
//   1. Page shows a pair CODE + QR (like a Chromecast "ready" screen).
//   2. The phone scans/enters the code → connects via FlyLinkReceiver
//      (WebRTC P2P first, Supabase Realtime fallback).
//   3. Phone PadFrames → applyPadFrame() → the synthetic "standard"
//      gamepad → Plot's EXISTING flight loop (useGamepad) flies the map.
//      No flight code changes; the map can't tell it's a phone.
//
// Deliberately STRIPPED: no prospecting/popups/tabs — just fly. The full
// product (rooms, import, etc.) lives in the PlotFly app; this is purely
// the screen the phone drives.

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { QRCodeSVG } from 'qrcode.react';
import { MAP_CENTER } from '@/lib/constants';
import {
  installFlyPad,
  applyPadFrame,
  neutralizeFlyPad,
} from '@/lib/flyPadBridge';
import {
  FlyLinkReceiver,
  makePairCode,
  type LinkState,
} from '@/lib/flyLink';

// MapView3D self-wraps APIProvider + runs its own gamepad flight loop.
const MapView3D = dynamic(() => import('@/components/map/MapView3D'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-black" />,
});

function readOrMakeCode(): string {
  if (typeof window === 'undefined') return 'PLOT';
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('c');
  if (fromUrl && /^[A-Z2-9]{4}$/.test(fromUrl.toUpperCase())) {
    return fromUrl.toUpperCase();
  }
  // Stable-ish per page load. (No Date.now in render — use perf+random once.)
  const seed =
    Math.floor((typeof performance !== 'undefined' ? performance.now() : 0) * 1000) +
    Math.floor(Math.random() * 1e6);
  const code = makePairCode(seed);
  url.searchParams.set('c', code);
  window.history.replaceState({}, '', url.toString());
  return code;
}

export default function FlyPage() {
  const [code] = useState<string>(() => readOrMakeCode());
  const [state, setState] = useState<LinkState>('idle');
  const linkRef = useRef<FlyLinkReceiver | null>(null);

  // LOCAL mode (PlotFly native app, 2026-07-16): the phone loads THIS page in
  // its OWN in-app WebView and injects its gamepad bridge (gamepadBridge.ts →
  // window.__plotPad + navigator.getGamepads override) DIRECTLY. No pairing, no
  // relay, no network hop — the map's flight loop reads the injected pad on the
  // same device. This is the flight-first native client: Google's photoreal
  // renderer + our tuned flight loop, driven by native touch/gyro/controller.
  const isLocal =
    typeof window !== 'undefined' &&
    new URL(window.location.href).searchParams.get('local') === '1';

  // Relay mode only: install the synthetic pad before the flight loop polls.
  // (Local mode: PlotFly injects its OWN pad, so we must NOT install a second.)
  useEffect(() => {
    if (isLocal) return;
    installFlyPad();
  }, [isLocal]);

  // Relay mode only: open the link and wire phone frames → the synthetic pad.
  useEffect(() => {
    if (isLocal) return;
    const link = new FlyLinkReceiver(code, {
      onFrame: (f) => applyPadFrame(f),
      onState: (s) => {
        setState(s);
        if (s === 'closed' || s === 'waiting') neutralizeFlyPad();
      },
    });
    linkRef.current = link;
    link.start().catch(() => {});
    return () => link.close();
  }, [code, isLocal]);

  const connected = state === 'p2p' || state === 'relay';

  // The QR encodes a deep link the PlotFly app handles, with a web
  // fallback so a plain phone camera still lands somewhere useful.
  const qrPayload = useMemo(() => {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://plot.solutions';
    return `plotfly://pair?c=${code}&relay=${encodeURIComponent(origin)}`;
  }, [code]);

  return (
    <div style={styles.root}>
      {/* The flight map — full screen, driven by the phone's pad. */}
      <div style={styles.map}>
        <MapView3D
          leads={[]}
          view3D
          flight={null}
          center={MAP_CENTER}
          gamepadEnabled
        />
      </div>

      {/* Pairing overlay — shown until a phone connects. Never in local mode
          (the phone IS the client; there's nothing to pair). */}
      {!connected && !isLocal && (
        <div style={styles.overlay}>
          <div style={styles.card}>
            <div style={styles.brand}>Plot · Fly</div>
            <div style={styles.headline}>Point your phone here to fly</div>

            <div style={styles.qrWrap}>
              <QRCodeSVG value={qrPayload} size={208} bgColor="#0b1020" fgColor="#9fd0ff" level="M" />
            </div>

            <div style={styles.codeLabel}>or enter code on PlotFly</div>
            <div style={styles.code}>{code}</div>

            <div style={styles.status}>
              {state === 'waiting' && 'Waiting for your phone…'}
              {state === 'signaling' && 'Phone found — linking…'}
              {state === 'idle' && 'Starting…'}
              {state === 'closed' && 'Link closed'}
            </div>
          </div>
        </div>
      )}

      {/* Tiny connected indicator (so you know P2P vs relay). */}
      {connected && !isLocal && (
        <div style={styles.connBadge}>
          {state === 'p2p' ? '● Linked (direct)' : '● Linked (relay)'} · {code}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' },
  map: { position: 'absolute', inset: 0 },
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'radial-gradient(120% 120% at 50% 40%, rgba(7,11,20,0.62), rgba(7,11,20,0.92))',
  },
  card: {
    width: 340,
    padding: '34px 30px 30px',
    borderRadius: 24,
    background:
      'linear-gradient(160deg, rgba(40,49,70,0.92), rgba(12,18,34,0.96))',
    border: '1px solid rgba(125,168,255,0.22)',
    boxShadow:
      '0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(180,210,255,0.18)',
    textAlign: 'center',
    color: '#fff',
  },
  brand: {
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: 'rgba(159,208,255,0.75)',
    fontWeight: 700,
  },
  headline: { fontSize: 20, fontWeight: 800, marginTop: 10, marginBottom: 20 },
  qrWrap: {
    display: 'inline-block',
    padding: 14,
    borderRadius: 16,
    background: '#0b1020',
    border: '1px solid rgba(125,168,255,0.25)',
  },
  codeLabel: {
    marginTop: 20,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(180,200,255,0.55)',
  },
  code: {
    fontSize: 40,
    fontWeight: 800,
    letterSpacing: 10,
    marginTop: 4,
    color: '#9fd0ff',
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
  status: { marginTop: 18, fontSize: 13, color: 'rgba(200,215,255,0.7)' },
  connBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    padding: '6px 12px',
    borderRadius: 20,
    background: 'rgba(7,11,20,0.7)',
    border: '1px solid rgba(125,168,255,0.25)',
    color: '#9fd0ff',
    fontSize: 12,
    letterSpacing: 0.5,
    fontFamily: 'ui-monospace, Menlo, monospace',
  },
};
