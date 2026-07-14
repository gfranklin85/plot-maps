'use client';

// ── PanTrail — the throttle-vector indicator ──────────────────────────
//
// The left-thumb pan is a floating throttle: where you press is NEUTRAL, and
// the offset to where you've slid is the glide vector. This draws that so you
// can SEE it (Greg 2026-07-14): a soft neutral ring at the origin, a line to
// the finger, and a knob at the finger. Fades out when you lift. Reads the
// live panTrail ref from useGestureFlight each frame — no React re-render.

import { useEffect, useRef } from 'react';

interface Trail { active: boolean; x0: number; y0: number; x: number; y: number; }

export default function PanTrail({ trail }: { trail: { current: Trail } }) {
  const svg = useRef<SVGSVGElement | null>(null);
  const ring = useRef<SVGCircleElement | null>(null);
  const line = useRef<SVGLineElement | null>(null);
  const knob = useRef<SVGCircleElement | null>(null);
  const opacity = useRef(0);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const t = trail.current;
      // ease the group opacity toward 1 when active, 0 when released
      const target = t.active ? 1 : 0;
      opacity.current += (target - opacity.current) * 0.25;
      const g = svg.current;
      if (g) g.style.opacity = opacity.current.toFixed(3);
      if (opacity.current > 0.01 && (t.active || opacity.current > 0.01)) {
        if (ring.current) { ring.current.setAttribute('cx', String(t.x0)); ring.current.setAttribute('cy', String(t.y0)); }
        if (line.current) {
          line.current.setAttribute('x1', String(t.x0)); line.current.setAttribute('y1', String(t.y0));
          line.current.setAttribute('x2', String(t.x)); line.current.setAttribute('y2', String(t.y));
        }
        if (knob.current) { knob.current.setAttribute('cx', String(t.x)); knob.current.setAttribute('cy', String(t.y)); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [trail]);

  return (
    <svg ref={svg} className="pantrail" aria-hidden style={{ opacity: 0 }}>
      {/* neutral origin — where the thumb pressed */}
      <circle ref={ring} r="26" className="pantrail__ring" />
      {/* vector line origin → finger */}
      <line ref={line} className="pantrail__line" />
      {/* the finger knob */}
      <circle ref={knob} r="15" className="pantrail__knob" />
      <style>{`
        .pantrail { position: fixed; inset: 0; z-index: 45; pointer-events: none; width: 100%; height: 100%; }
        .pantrail__ring { fill: rgba(19,73,212,0.06); stroke: rgba(19,73,212,0.5); stroke-width: 1.5; stroke-dasharray: 3 4; }
        .pantrail__line { stroke: rgba(19,73,212,0.6); stroke-width: 3; stroke-linecap: round; }
        .pantrail__knob { fill: rgba(19,73,212,0.9); stroke: #fff; stroke-width: 2.5; }
      `}</style>
    </svg>
  );
}
