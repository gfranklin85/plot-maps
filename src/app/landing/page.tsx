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
import LandingControllerChip from '@/components/landing/LandingControllerChip';

export const metadata: Metadata = {
  title: "Plotmaps — A Modern Practitioner's Manual",
  description:
    'Plot is a surveying field manual rendered in real time. Open the page, turn the key, fly your hometown.',
};

// One-viewport landing layout: no vertical scroll, ever. Wordmark hero
// occupies the upper region; destination carousel occupies the lower
// region; the parchment background paints the entire surface as one
// continuous material. The destination carousel scrolls horizontally
// inside its own region — the page itself does not.
//
// Locked direction:
//   - memory/feedback_landing_desktop_first_mobile_separate.md
//   - memory/project_landing_page_field_manual.md ("single no-scroll
//     start-screen styled as Page I of Plot's encyclopedia")
export default function LandingPage() {
  return (
    <main
      className="relative w-full h-screen overflow-hidden"
      style={{
        backgroundColor: '#F4EAD5', // Plat Book cream parchment
      }}
    >
      {/* Atmospheric depth — single material under both hero and
          carousel. Subtle radial vignette + paper grain texture. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(244, 234, 213, 0) 0%, rgba(155, 146, 130, 0.10) 70%, rgba(74, 66, 54, 0.16) 100%), repeating-linear-gradient(45deg, rgba(155, 146, 130, 0.018) 0px, rgba(155, 146, 130, 0.018) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Warm-light pinhole from upper-left — canonical Plot light
          direction at ~30°. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 25% 20%, rgba(255, 234, 200, 0.18) 0%, rgba(255, 234, 200, 0) 60%)',
        }}
      />

      {/* Controller affordance — top-right corner, quiet but discoverable.
          Detects gamepad connection state, prompts pairing if absent. */}
      <LandingControllerChip />

      {/* Two-row split inside the single viewport. Hero on top
          (commands the visual hierarchy), carousel on bottom (the
          action). Tunable proportions via flex-basis if needed later. */}
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex-[55] min-h-0">
          <PlotMapsHero />
        </div>
        <div className="flex-[45] min-h-0">
          <DestinationCarousel />
        </div>
      </div>
    </main>
  );
}
