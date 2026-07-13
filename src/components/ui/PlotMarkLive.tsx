'use client';

// ── PlotMarkLive — the morphing brand mark ────────────────────────────
//
// Our own "Mobbin move": the pin's HEAD holds the product grammar and
// cycles through it on a slow, calm loop —
//   want (empty)  →  yours (dot)  →  active (house)  →  back
// The silhouette never moves; only the meaning inside the head changes,
// cross-fading. This IS the product drawn tiny: an intention that becomes
// a home. Nobody can copy it — it's our pin system.
//
// Lives in the eyebrow slot (no pill — memory: feedback_brand_fidelity).
// Inherits color via currentColor. Respects reduced-motion (holds the
// house frame — the payoff — instead of animating). memory: project_pin_grammar.

const STATES = ['want', 'yours', 'active'] as const;

export default function PlotMarkLive({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      className={`plotmark-live ${className ?? ''}`}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        {/* the plot — constant */}
        <ellipse cx="12" cy="20" rx="6.6" ry="2.4" fillOpacity="0.28" />
        {/* the point — constant, apex down */}
        <polygon points="9.8,11.4 14.2,11.4 12,16.6" />
        {/* the head shell — constant */}
        <circle cx="12" cy="7" r="4.1" />

        {/* ── the meaning inside the head — cross-fading frames ── */}
        {/* WANT: empty (a hollow ring reads as "nothing here yet") */}
        <circle className="pm-frame pm-want" cx="12" cy="7" r="1.7" fill="#fff" />
        {/* YOURS: a solid dot */}
        <circle className="pm-frame pm-yours" cx="12" cy="7" r="1.85" fill="#fff" />
        {/* ACTIVE: a little house (body + gable), white knockout */}
        <g className="pm-frame pm-active" fill="#fff">
          <rect x="10.15" y="6.7" width="3.7" height="2.5" rx="0.3" />
          <polygon points="9.7,6.8 12,4.9 14.3,6.8" />
        </g>
      </svg>

      <style>{`
        .plotmark-live .pm-frame { opacity: 0; transform-box: fill-box; transform-origin: center; }
        /* three states, 9s loop, ~3s each with cross-fade overlap */
        .pm-want   { animation: pmWant   9s ease-in-out infinite; }
        .pm-yours  { animation: pmYours  9s ease-in-out infinite; }
        .pm-active { animation: pmActive 9s ease-in-out infinite; }

        @keyframes pmWant {
          0%, 22% { opacity: 1; } 33%, 89% { opacity: 0; } 100% { opacity: 1; }
        }
        @keyframes pmYours {
          0%, 22% { opacity: 0; } 33%, 55% { opacity: 1; } 66%, 100% { opacity: 0; }
        }
        @keyframes pmActive {
          0%, 55% { opacity: 0; } 66%, 89% { opacity: 1; } 100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pm-want, .pm-yours { animation: none; opacity: 0; }
          .pm-active { animation: none; opacity: 1; } /* hold the payoff frame */
        }
      `}</style>
    </span>
  );
}
