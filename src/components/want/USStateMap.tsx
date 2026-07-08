'use client';

// ── USStateMap — the free structured "where" input ────────────────────
//
// Click states to add/remove them from the destination set. Pure SVG, zero
// runtime deps, zero cost — this captures the skeleton of "where would you
// go" without spending an AI token. A click is the same signal as typing a
// state name: it hands the parent a { abbr, name } and the intake reacts to
// it in-conversation. (Greg 2026-07-08: do the cheap parts cheap; save AI
// for the depth.)

import { useState } from 'react';
import { US_STATES, US_VIEWBOX } from '@/lib/geo/usStates';

export default function USStateMap({
  selected,
  onToggle,
}: {
  selected: string[]; // USPS abbrs
  onToggle: (s: { abbr: string; name: string }) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const sel = new Set(selected);

  return (
    <svg className="usmap" viewBox={US_VIEWBOX} role="group" aria-label="United States — click states to add them">
      {US_STATES.map((s) => {
        const on = sel.has(s.abbr);
        return (
          <path
            key={s.abbr}
            d={s.d}
            className={`usmap__st ${on ? 'is-on' : ''} ${hover === s.abbr ? 'is-hover' : ''}`}
            onClick={() => onToggle({ abbr: s.abbr, name: s.name })}
            onMouseEnter={() => setHover(s.abbr)}
            onMouseLeave={() => setHover((h) => (h === s.abbr ? null : h))}
            role="button"
            aria-pressed={on}
            aria-label={s.name}
          >
            <title>{s.name}</title>
          </path>
        );
      })}
    </svg>
  );
}
