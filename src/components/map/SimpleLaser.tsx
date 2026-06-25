'use client';

// SimpleLaser — the flight FIRE beam. HTML + CSS, mounted once on the map.
//
// FIXED 2026-06-24: the laser is a FLIGHT ACTION, not a mouse-click thing.
// It NO LONGER listens to window clicks (which sprayed lasers across the
// whole page, hitting UI chrome). It fires only when the flight fire action
// fires — the gamepad/phone trigger via `onShoot` — by dispatching the
// `plot:fire-laser` window event. The beam travels from bottom-center to
// the RETICLE (screen center, the aim point), instantly, zero latency.
//
// Mouse users never trigger the laser; they navigate + select normally
// (Google's native map click resolves parcels). memory/
// project_sprint_roadmap_2026_06.
//
// Dispatch a shot:  window.dispatchEvent(new CustomEvent('plot:fire-laser',
//                     { detail: { x, y } }))   // x,y optional; defaults to reticle

import { useEffect, useState } from 'react';

interface Beam {
  id: number;
  x0: number; y0: number;     // launch point (bottom-center)
  x1: number; y1: number;     // impact point (reticle / passed point)
  length: number;
  angleDeg: number;
}

export default function SimpleLaser() {
  const [beams, setBeams] = useState<Beam[]>([]);

  useEffect(() => {
    let counter = 0;
    function fireAt(x1: number, y1: number) {
      const x0 = window.innerWidth * 0.5; // fire from bottom-center
      const y0 = window.innerHeight;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.hypot(dx, dy);
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      counter += 1;
      const beam: Beam = { id: counter, x0, y0, x1, y1, length, angleDeg };
      setBeams((prev) => [...prev, beam]);
      window.setTimeout(() => {
        setBeams((prev) => prev.filter((b) => b.id !== beam.id));
      }, 450);
    }

    // The flight fire action (gamepad/phone trigger → onShoot) dispatches
    // this event. Default aim = the reticle (screen center).
    function onFire(e: Event) {
      const detail = (e as CustomEvent).detail as { x?: number; y?: number } | undefined;
      const x = typeof detail?.x === 'number' ? detail.x : window.innerWidth / 2;
      const y = typeof detail?.y === 'number' ? detail.y : window.innerHeight / 2;
      fireAt(x, y);
    }
    window.addEventListener('plot:fire-laser', onFire);
    return () => window.removeEventListener('plot:fire-laser', onFire);
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      {beams.map((b) => (
        <div key={b.id}>
          {/* The beam: a thin bar anchored at the launch point, rotated
              to point at the click, growing from 0 → full length. */}
          <div
            style={{
              position: 'absolute',
              left: b.x0,
              top: b.y0,
              width: b.length,
              height: 4,
              background: 'linear-gradient(90deg, rgba(59,130,246,0) 0%, #3b82f6 40%, #ffffff 100%)',
              boxShadow: '0 0 12px 2px #3b82f6',
              transformOrigin: '0 50%',
              transform: `rotate(${b.angleDeg}deg)`,
              borderRadius: 2,
              // animate clip-path + opacity only — leave transform alone
              // so the rotation above sticks.
              animation: 'simple-laser-beam 450ms ease-out forwards',
            }}
          />
          {/* Impact burst at the click point. */}
          <div
            style={{
              position: 'absolute',
              left: b.x1,
              top: b.y1,
              width: 28,
              height: 28,
              marginLeft: -14,
              marginTop: -14,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffffff 0%, #3b82f6 50%, rgba(59,130,246,0) 70%)',
              animation: 'simple-laser-burst 450ms ease-out forwards',
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes simple-laser-beam {
          0%   { opacity: 0; clip-path: inset(0 100% 0 0); }
          15%  { opacity: 1; }
          40%  { clip-path: inset(0 0 0 0); opacity: 1; }
          100% { clip-path: inset(0 0 0 0); opacity: 0; }
        }
        @keyframes simple-laser-burst {
          0%   { transform: scale(0); opacity: 0; }
          45%  { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.6); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
