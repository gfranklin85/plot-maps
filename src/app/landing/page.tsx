// Plot's landing page.
//
// Current state (2026-05-24): substrate-first introduction. The page
// presents Plot as a place anyone can step into and fly, with no
// audience-specific framing. Two sections, stacked vertically:
//
//   1. PlotMapsHero — wordmark cathedral. Centered logo on parchment,
//      stagger entrance + reticle breathing. Fills the first viewport.
//   2. DestinationCarousel — horizontally-scrolling row of city cards
//      beneath the hero. Casual visitors pick a destination and fly.
//      Includes a "fly anywhere" search affordance for unlisted places.
//
// The audience-specific surfaces (commercial brokers, investors,
// agents) are deferred — Plot earns the right to those doors after
// the substrate is undeniable. See [[project-conditional-state-thesis]]
// and [[project-plot-audience-thesis]] for the why.
//
// See:
//   - memory/project_conditional_state_thesis.md (core product insight)
//   - memory/project_landing_page_field_manual.md (overall landing direction)
//   - memory/project_master_logomark_locked.md (locked logo spec)
//   - src/components/landing/PlotMapsHero.tsx (wordmark hero)
//   - src/components/landing/destinations/ (carousel + cards)
//   - src/components/landing/EntrySequence.tsx (transition to /map)

import type { Metadata } from 'next';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import DestinationAtlas from '@/components/landing/destinations/DestinationAtlas';
import LandingControllerChip from '@/components/landing/LandingControllerChip';

export const metadata: Metadata = {
  title: "Plotmaps — A Modern Practitioner's Manual",
  description:
    'Plot is a surveying field manual rendered in real time. Open the page, turn the key, fly your hometown.',
};

// One-viewport landing layout. The atlas is the protagonist; the wordmark
// is anchored at the top as a quiet brand mark. No vertical scroll ever.
//
// Locked direction:
//   - memory/feedback_landing_desktop_first_mobile_separate.md
//   - memory/project_landing_page_field_manual.md
//   - memory/project_destination_match_cut_thesis.md
export default function LandingPage() {
  return (
    <main
      className="relative w-full h-screen overflow-hidden"
      style={{
        // Deep navy desk surface — the atlas image carries its own
        // parchment material; the page background is the room around it.
        backgroundColor: '#0E1626',
      }}
    >
      {/* Faint star/dust field at the upper edge, where the warm light
          comes from in the atlas image. Subtle continuation of the
          atmosphere baked into the atlas. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 22% 12%, rgba(255, 232, 198, 0.08) 0%, rgba(255, 232, 198, 0) 65%)',
        }}
      />

      {/* Wordmark — anchored at the top, modest size so the atlas can
          dominate the visual hierarchy. */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 z-20 select-none">
        <div className="plot-logo-header" style={{ width: '220px' }}>
          <PlotMapsLogo color="#F4EAD5" className="w-full h-auto" />
        </div>
      </header>

      {/* Controller chip — top-right corner. */}
      <LandingControllerChip />

      {/* Atlas — the main event. Fills the available viewport between
          the top wordmark and the bottom editorial line. */}
      <div className="relative z-10 w-full h-full pt-20">
        <DestinationAtlas />
      </div>
    </main>
  );
}
