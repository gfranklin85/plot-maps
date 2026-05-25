'use client';

// PlotMapsHero — the upper-portion presentation of the landing.
//
// Lives inside a single-viewport landing layout. The hero takes the
// upper region (wordmark centered with breathing room); the carousel
// sits beneath in the lower region. Together they fit one screen with
// no vertical scroll.
//
// Entrance choreography: each letter and the reticle pieces fade into
// view in sequence (staggered via CSS animation-delay). After entrance
// completes, the reticle pulses subtly.
//
// See:
//   - memory/project_master_logomark_locked.md (locked logo spec)
//   - memory/project_landing_page_field_manual.md (overall landing direction)
//   - src/components/brand/PlotMapsLogo.tsx (the wordmark component)
//   - src/app/landing/page.tsx (one-viewport layout this composes into)

import PlotMapsLogo from '@/components/brand/PlotMapsLogo';

export default function PlotMapsHero() {
  return (
    <div
      className="relative w-full h-full flex items-center justify-center px-6 sm:px-10"
    >
      <div
        className="plot-logo-wrapper w-full"
        style={{
          maxWidth: 'min(64vw, 1100px)',
        }}
      >
        <PlotMapsLogo
          color="#1A1F2E"
          className="plot-logo w-full h-auto"
          title="PlotMaps"
        />
      </div>

      {/* Entrance + idle animations.
          Each letter and reticle piece starts invisible and animates in
          on a staggered delay (left-to-right, then reticle pieces last).
          After entrance, the reticle ring breathes on a 5s cycle. */}
      <style jsx global>{`
        .plot-logo #pm-letter-P,
        .plot-logo #pm-letter-l,
        .plot-logo #pm-letter-t,
        .plot-logo #pm-letter-M,
        .plot-logo #pm-letter-a,
        .plot-logo #pm-letter-p,
        .plot-logo #pm-letter-s,
        .plot-logo #pm-reticle-ring,
        .plot-logo #pm-reticle-crosshair-h,
        .plot-logo #pm-reticle-crosshair-v {
          opacity: 0;
          animation: plot-piece-in 0.6s cubic-bezier(0.2, 0.65, 0.3, 1) forwards;
        }

        .plot-logo #pm-letter-P { animation-delay: 0.15s; }
        .plot-logo #pm-letter-l { animation-delay: 0.24s; }
        .plot-logo #pm-letter-t { animation-delay: 0.33s; }
        .plot-logo #pm-letter-M { animation-delay: 0.42s; }
        .plot-logo #pm-letter-a { animation-delay: 0.51s; }
        .plot-logo #pm-letter-p { animation-delay: 0.60s; }
        .plot-logo #pm-letter-s { animation-delay: 0.69s; }
        .plot-logo #pm-reticle-ring { animation-delay: 0.85s; }
        .plot-logo #pm-reticle-crosshair-h { animation-delay: 1.05s; }
        .plot-logo #pm-reticle-crosshair-v { animation-delay: 1.15s; }

        @keyframes plot-piece-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* After entrance, the reticle ring quietly pulses.
           Delay must exceed the longest entrance delay (1.15s + 0.6s = 1.75s)
           so it doesn't fight the fade-in. */
        .plot-logo #pm-reticle-ring {
          animation: plot-piece-in 0.6s cubic-bezier(0.2, 0.65, 0.3, 1) 0.85s forwards,
            plot-reticle-breathe 5s ease-in-out 2s infinite;
        }

        @keyframes plot-reticle-breathe {
          0%, 100% {
            stroke-opacity: 1;
          }
          50% {
            stroke-opacity: 0.78;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .plot-logo #pm-letter-P,
          .plot-logo #pm-letter-l,
          .plot-logo #pm-letter-t,
          .plot-logo #pm-letter-M,
          .plot-logo #pm-letter-a,
          .plot-logo #pm-letter-p,
          .plot-logo #pm-letter-s,
          .plot-logo #pm-reticle-ring,
          .plot-logo #pm-reticle-crosshair-h,
          .plot-logo #pm-reticle-crosshair-v {
            opacity: 1;
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
