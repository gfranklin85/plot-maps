'use client';

// SimpleLaser — a laser to the cursor. It's just HTML + CSS.
//
// Mount this once. It listens for clicks anywhere, and on each click
// draws a beam from the bottom-center of the screen to the click point,
// then fades it out. No canvas, no rAF, no gamepad, no refs into the
// rest of the app. The whole thing is a rotated <div> (the beam) plus a
// little burst <div> at the impact point, animated with CSS keyframes.

import { useEffect, useState } from 'react';

interface Beam {
  id: number;
  // launch point (bottom of screen)
  x0: number;
  y0: number;
  // impact point (where you clicked)
  x1: number;
  y1: number;
  length: number;
  angleDeg: number;
}

export default function SimpleLaser() {
  const [beams, setBeams] = useState<Beam[]>([]);

  useEffect(() => {
    let counter = 0;
    function onClick(e: MouseEvent) {
      const x1 = e.clientX;
      const y1 = e.clientY;
      const x0 = window.innerWidth * 0.5; // fire from bottom-center
      const y0 = window.innerHeight;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.hypot(dx, dy);
      // angle of the beam from the launch point, in screen space.
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      counter += 1;
      const beam: Beam = { id: counter, x0, y0, x1, y1, length, angleDeg };
      setBeams((prev) => [...prev, beam]);
      // self-remove after the animation finishes
      window.setTimeout(() => {
        setBeams((prev) => prev.filter((b) => b.id !== beam.id));
      }, 450);
    }
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
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
