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
import PlotMapsHero from '@/components/landing/PlotMapsHero';
import DestinationCarousel from '@/components/landing/destinations/DestinationCarousel';

export const metadata: Metadata = {
  title: "Plotmaps — A Modern Practitioner's Manual",
  description:
    'Plot is a surveying field manual rendered in real time. Open the page, turn the key, fly your hometown.',
};

export default function LandingPage() {
  return (
    <main>
      <PlotMapsHero />
      <DestinationCarousel />
    </main>
  );
}
