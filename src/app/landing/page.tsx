// Plot's landing page.
//
// Direction (2026-05-25 refresh): no live globe, no cesium on the
// landing. The page is the entry point — a single-viewport horizontal
// carousel of destination cards. The user picks a city; ArrivalSequence
// takes over (questions form + OAuth + handoff to /map).
//
// Decisions baked in:
//   - One screen, no scroll. The cards are the page.
//   - Modern, dark, high-end. Survey-tick accents in the corners are
//     the one vintage-cartography callback; the rest is contemporary.
//   - Locked PlotMaps wordmark, top-left. No invented logo.
//   - No fictional copy (no fake "LIDAR ENGAGED", no fictional nav).
//   - The active card carries the primary action; arrow controls let
//     the user flip through. Keyboard + (later) controller D-pad
//     navigate the same indices.
//   - Card images come from public/assets/landing/destinations/<slug>.jpg
//     when present. Cards without imageSrc render a typographic
//     placeholder so the page reads "screenshot pending" instead of
//     broken. Composition stays the same when real screenshots land.
//
// See:
//   - src/lib/destinations.ts (single canonical destination catalog)
//   - src/components/landing/destinations/ArrivalSequence.tsx (handles
//     the post-click questions form + OAuth + /map handoff)
//   - src/components/brand/PlotMapsLogo.tsx (locked wordmark)

import type { Metadata } from 'next';
import LandingCarousel from '@/components/landing/LandingCarousel';

export const metadata: Metadata = {
  title: 'Plotmaps — Fly your market',
  description:
    'Plot is a real-estate prospecting platform that puts you in the air over the markets you work. Pick a city and fly.',
};

export default function LandingPage() {
  return <LandingCarousel />;
}
