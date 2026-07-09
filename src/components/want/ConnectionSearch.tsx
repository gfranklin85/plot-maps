'use client';

// ── ConnectionSearch — the "searching for connections" animation ──────
//
// The reusable loader (Greg 2026-07-08): connections sparking across a US
// map, airline-flight-search style. Plays anytime we're loading, and IS the
// post-submit "finding your connections" moment. Reuses the static state
// paths — no map SDK, no tokens, pure SVG + CSS.
//
// Two modes:
//   • loader — quiet ambient version for any loading state.
//   • search — the dramatic sequence: pins light up, arcs spark between
//     them, a running status line ("Comparing across 1,240 requests…").
// The parent decides the outcome (found / nothing) and swaps this out.

import { useEffect, useMemo, useState } from 'react';
import { US_STATES, US_VIEWBOX } from '@/lib/geo/usStates';

// A few plausible connection lanes (viewBox coords) to spark between —
// coastal metros where sellers actually cluster. Decorative, not data.
const NODES: [number, number][] = [
  [120, 330], // CA
  [700, 500], // FL
  [905, 250], // Mid-Atlantic / VA
  [470, 300], // TX/central
  [560, 210], // Midwest
  [860, 170], // Northeast
  [200, 120], // PNW
  [640, 360], // Southeast
];
const LANES: [number, number][] = [
  [0, 1], [0, 3], [3, 7], [7, 1], [4, 2], [2, 5], [6, 0], [3, 4], [7, 2], [1, 2],
];

export default function ConnectionSearch({
  mode = 'search',
  label,
  activeCount,
}: {
  mode?: 'search' | 'loader';
  label?: string;
  activeCount?: number;
}) {
  // Rotating status line for the search sequence (airline vibe).
  const lines = useMemo(
    () => [
      activeCount
        ? `Comparing your request across ${activeCount.toLocaleString()} active requests…`
        : 'Comparing your request across the network…',
      'Checking direct connections…',
      'Tracing multi-home move paths…',
      'Matching against open properties…',
    ],
    [activeCount],
  );
  const [li, setLi] = useState(0);
  useEffect(() => {
    if (mode !== 'search') return;
    const t = setInterval(() => setLi((i) => (i + 1) % lines.length), 1600);
    return () => clearInterval(t);
  }, [mode, lines.length]);

  return (
    <div className={`cxs cxs--${mode}`} role="status" aria-live="polite">
      <div className="cxs__mapwrap">
        <svg className="cxs__map" viewBox={US_VIEWBOX} aria-hidden="true">
          {US_STATES.map((s) => (
            <path key={s.abbr} d={s.d} className="cxs__st" />
          ))}
          {/* sparking connection arcs */}
          {LANES.map(([a, b], i) => {
            const [x1, y1] = NODES[a];
            const [x2, y2] = NODES[b];
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.22;
            return (
              <path
                key={i}
                className="cxs__arc"
                d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
                style={{ animationDelay: `${(i * 0.32).toFixed(2)}s` }}
              />
            );
          })}
          {/* pulsing nodes */}
          {NODES.map(([x, y], i) => (
            <circle key={i} className="cxs__node" cx={x} cy={y} r={4}
              style={{ animationDelay: `${(i * 0.22).toFixed(2)}s` }} />
          ))}
        </svg>
      </div>
      {mode === 'search' && (
        <p className="cxs__status">
          <span className="cxs__dot" /><span className="cxs__dot" /><span className="cxs__dot" />
          <span className="cxs__line">{label || lines[li]}</span>
        </p>
      )}
      {mode === 'loader' && label && <p className="cxs__loaderlbl">{label}</p>}
    </div>
  );
}
