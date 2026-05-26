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
import LandingControllerChip from '@/components/landing/LandingControllerChip';
import CesiumGlobeLoader from '@/components/landing/destinations/CesiumGlobeLoader';
import CesiumFlightController from '@/components/map/CesiumFlightController';

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
  // No background color on the main element — the persistent Cesium
  // viewer renders behind everything at fixed z-0 (see
  // CesiumViewerProvider). Setting an opaque background here would
  // hide the world. Page chrome (wordmark, controller chip, pins, the
  // arrival sequence overlay) sits above it at z-10+.
  return (
    <main className="relative w-full h-screen overflow-hidden pointer-events-none">
      {/* Faint star/dust field overlay — sits above the Cesium canvas
          to add Plot's warm-light brand finish on top of Cesium's
          atmospheric scattering. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-40 z-[5]"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 22% 12%, rgba(255, 232, 198, 0.10) 0%, rgba(255, 232, 198, 0) 65%)',
        }}
      />

      {/* Wordmark — anchored at the top. */}
      <header className="absolute top-6 left-1/2 -translate-x-1/2 z-20 select-none pointer-events-auto">
        <div className="plot-logo-header" style={{ width: '220px' }}>
          <PlotMapsLogo color="#F4EAD5" className="w-full h-auto" />
        </div>
      </header>

      {/* Controller chip — top-right corner. */}
      <LandingControllerChip />

      {/* The globe layer — pins + click handler over the persistent
          Cesium viewer. Doesn't render its own canvas; CesiumGlobe just
          adds entities + handlers to the shared viewer. pointer-events-
          none on this wrapper so mouse events pass through to the
          Cesium canvas underneath (where the pin click handler is
          attached). Inner overlays (ArrivalSequence, loading state)
          opt back into pointer events themselves. */}
      <div className="relative z-10 w-full h-full pointer-events-none">
        <CesiumGlobeLoader />
      </div>

      {/* Gamepad-driven flight. Mounts on the persistent Cesium viewer
          so the user can fly themselves from orbit to ground anywhere
          on Earth. Pin clicks still work as a non-controller shortcut. */}
      <CesiumFlightController />
    </main>
  );
}
