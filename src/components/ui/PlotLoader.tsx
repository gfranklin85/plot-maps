'use client';

// ── PlotLoader — Plot's own loading animation ─────────────────────────
//
// Not a generic spinner. A brand-blue PIN that drops, lands (its plot
// ellipse ripples), and rises to drop again — the "posting a move" gesture
// as a loop. The head cycles the grammar (want→yours→active) via the same
// living mark. Authentic to Plot: this is the product's core motion.
// memory: project_pin_grammar, feedback_brand_fidelity.

export default function PlotLoader({ size = 72, label }: { size?: number; label?: string }) {
  return (
    <div className="plot-loader" role="status" aria-label={label ?? 'Loading'}>
      {/* taller viewBox + headroom so the pin's apex never clips */}
      <svg width={size} height={size * 1.15} viewBox="0 0 64 74" fill="none" aria-hidden>
        {/* the plot — soft contact shadow that breathes with the drop */}
        <ellipse className="pl-plot" cx="32" cy="62" rx="13" ry="4.5" fill="var(--plot-brand, #1349d4)" opacity="0.16" />
        {/* the ripple — concentric, centered on the landing point, rising up + out */}
        <ellipse className="pl-ripple" cx="32" cy="62" rx="13" ry="4.5" fill="none" stroke="var(--plot-brand, #1349d4)" strokeWidth="1.5" opacity="0" />

        {/* the pin — drops and rises (has headroom above y=0 now) */}
        <g className="pl-pin">
          <path d="M32 52 L26 38 L38 38 Z" fill="var(--plot-brand, #1349d4)" />
          <circle cx="32" cy="28" r="12" fill="var(--plot-brand, #1349d4)" />
          <circle className="pl-frame pl-want" cx="32" cy="28" r="5" fill="#fff" />
          <circle className="pl-frame pl-yours" cx="32" cy="28" r="5.5" fill="#fff" />
          <g className="pl-frame pl-active" fill="#fff">
            <rect x="27" y="27" width="10" height="7" rx="0.8" />
            <path d="M26 27.5 L32 22 L38 27.5 Z" />
          </g>
        </g>
      </svg>
      {label && <span className="plot-loader__label">{label}</span>}

      <style>{`
        .plot-loader { display: inline-flex; flex-direction: column; align-items: center; gap: 14px; }
        .plot-loader__label { font-size: 13px; font-weight: 600; color: var(--plot-brand-deep, #122d8d); letter-spacing: 0.01em; }

        /* the pin drops + rises (2s loop) */
        .pl-pin { transform-box: fill-box; transform-origin: center; animation: plDrop 2s ease-in-out infinite; }
        @keyframes plDrop {
          0%   { transform: translateY(-10px); }
          45%  { transform: translateY(0); }
          55%  { transform: translateY(0); }
          100% { transform: translateY(-10px); }
        }
        /* the ripple fires on landing — scales from its OWN center so it
           expands evenly outward (not drifting from a corner). */
        .pl-ripple { transform-box: fill-box; transform-origin: center; animation: plRipple 2s ease-out infinite; }
        @keyframes plRipple {
          0%, 42% { opacity: 0; transform: scale(0.5); }
          50%     { opacity: 0.55; transform: scale(0.7); }
          72%     { opacity: 0; transform: scale(1.35); }
          100%    { opacity: 0; transform: scale(1.35); }
        }
        .pl-plot { transform-box: fill-box; transform-origin: center; animation: plShadow 2s ease-in-out infinite; }
        @keyframes plShadow { 0%,100% { transform: scale(0.82); opacity: 0.1; } 50% { transform: scale(1); opacity: 0.18; } }

        /* the head meaning cycles across ~three drops (6s) */
        .pl-frame { opacity: 0; }
        .pl-want   { animation: plWant   6s ease-in-out infinite; }
        .pl-yours  { animation: plYours  6s ease-in-out infinite; }
        .pl-active { animation: plActive 6s ease-in-out infinite; }
        @keyframes plWant   { 0%,28% { opacity: 1; } 34%,94% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes plYours  { 0%,28% { opacity: 0; } 34%,60% { opacity: 1; } 66%,100% { opacity: 0; } }
        @keyframes plActive { 0%,60% { opacity: 0; } 66%,94% { opacity: 1; } 100% { opacity: 0; } }

        @media (prefers-reduced-motion: reduce) {
          .pl-pin, .pl-ripple, .pl-plot, .pl-frame { animation: none !important; }
          .pl-active { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
