'use client';

// PlotMapsHero — the logo-first landing presentation.
//
// Strips the landing route down to a single intentional artifact: the
// PlotMaps wordmark, centered, on a parchment field that does it justice.
//
// Entrance choreography: each letter and the reticle pieces fade + slide
// into view in sequence (staggered via CSS animation-delay). After
// entrance completes, the reticle pulses subtly to signal the brand is
// alive.
//
// This is the first build pass — pure logo treatment, no surrounding
// chrome. The figure grid, headline cartouche, and entry-key affordance
// from the original FieldManualPlate will re-integrate around this once
// the logo presentation is locked. See:
//   - memory/project_master_logomark_locked.md (locked logo spec)
//   - memory/project_landing_page_field_manual.md (overall landing direction)
//   - src/components/brand/PlotMapsLogo.tsx (the wordmark component)
//   - src/components/landing/FieldManualPlate.tsx (re-integration target)

import PlotMapsLogo from '@/components/brand/PlotMapsLogo';

export default function PlotMapsHero() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: '#F4EAD5', // cream parchment from Plat Book palette
        minHeight: '100vh',
      }}
    >
      {/* Atmospheric depth — subtle radial vignette + paper-grain.
          Quiet enough that it doesn't compete with the wordmark. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(244, 234, 213, 0) 0%, rgba(155, 146, 130, 0.10) 70%, rgba(74, 66, 54, 0.16) 100%), repeating-linear-gradient(45deg, rgba(155, 146, 130, 0.018) 0px, rgba(155, 146, 130, 0.018) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Warm-light hint from upper-left — canonical Plot light direction. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 25% 20%, rgba(255, 234, 200, 0.18) 0%, rgba(255, 234, 200, 0) 60%)',
        }}
      />

      {/* Wordmark stage — centered, sized to command the frame. */}
      <div className="relative z-10 flex items-center justify-center w-full min-h-screen px-6 sm:px-10">
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
