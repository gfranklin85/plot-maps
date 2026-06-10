'use client';

// PerfHUD — a lightweight, real measurement overlay for the map.
//
// Greg flagged the machine "working its ass off." Before optimizing or
// piling on features, we MEASURE. This runs its own rAF loop and reports
// the browser's actual frame cadence (which captures the total cost of
// everything: Google's photoreal tiles, our overlay loops, OT's Gemini
// session, etc.) plus a few coarse signals about what's running.
//
// Toggle with the `P` key. Off by default so it never taxes normal use.
// It is itself nearly free: one rAF, a rolling average, a 4Hz DOM write.
//
// Signals it reads (best-effort, all guarded):
//   • FPS + frame time (ms)         — the headline cost
//   • worst frame in the window     — stutter detector
//   • JS heap (Chrome only)         — memory creep
//   • gemini live active            — OT's session is the big variable
//     cost (mic PCM + 1fps screen-grab+JPEG + WS audio). We read a flag
//     other code sets on window.__plotPerf.geminiActive.

import { useEffect, useState } from 'react';

interface Stats {
  fps: number;
  frameMs: number;
  worstMs: number;
  heapMB: number | null;
  gemini: boolean;
}

export default function PerfHUD() {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<Stats>({ fps: 0, frameMs: 0, worstMs: 0, heapMB: null, gemini: false });

  // Toggle with P (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'p' && e.key !== 'P') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable) return;
      setVisible(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;          // accumulated frame time in the sample window
    let count = 0;        // frames in the window
    let worst = 0;        // worst single frame in the window
    let winStart = last;

    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      acc += dt;
      count++;
      if (dt > worst) worst = dt;

      // Update the readout 4x/sec so the DOM write itself is cheap.
      if (now - winStart >= 250) {
        const avg = acc / Math.max(1, count);
        const perf = (performance as unknown as { memory?: { usedJSHeapSize: number } });
        const heapMB = perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null;
        const gemini = !!(window as unknown as { __plotPerf?: { geminiActive?: boolean } })
          .__plotPerf?.geminiActive;
        setStats({
          fps: Math.round(1000 / Math.max(0.0001, avg)),
          frameMs: Math.round(avg * 10) / 10,
          worstMs: Math.round(worst * 10) / 10,
          heapMB,
          gemini,
        });
        acc = 0; count = 0; worst = 0; winStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  // Color the FPS by health: green ≥55, amber ≥35, red below.
  const fpsColor = stats.fps >= 55 ? '#3ddc84' : stats.fps >= 35 ? '#f5b301' : '#ff5555';

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.82)',
        color: '#cfd2d6',
        font: '12px/1.45 ui-monospace, monospace',
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.12)',
        pointerEvents: 'none',
        minWidth: 170,
        whiteSpace: 'pre',
      }}
    >
      <div style={{ color: fpsColor, fontWeight: 700, fontSize: 15 }}>
        {stats.fps} FPS
      </div>
      <div>{`frame:  ${stats.frameMs.toFixed(1)} ms`}</div>
      <div>{`worst:  ${stats.worstMs.toFixed(1)} ms`}</div>
      {stats.heapMB != null && <div>{`heap:   ${stats.heapMB} MB`}</div>}
      <div style={{ color: stats.gemini ? '#00F2FF' : '#888' }}>
        {`OT live: ${stats.gemini ? 'ON (mic+screen)' : 'off'}`}
      </div>
      <div style={{ color: '#666', marginTop: 4, fontSize: 10 }}>P to hide</div>
    </div>
  );
}
