// Plot Maps landing.
//
// Direction (locked 2026-05-29 — supersedes the earlier carousel-only
// landing for the public-launch surface): search-first hero with a
// cinematic search bar + horizontally scrolling destination cards
// underneath. NO gate, NO signup, NO claim-before-entry. Participation
// prompts fire after engagement, never at the door.
//
// See:
//   memory/project_landing_search_first_no_gate.md
//   memory/project_plot_maps_position_hierarchy.md
//
// Architecture:
//   src/components/landing/LandingHome.tsx           — this page's shell
//   src/components/public/PositionFooter.tsx        — compliance footer
//   src/app/api/public/geocode/route.ts             — unauthenticated
//                                                     geocode for the
//                                                     search bar
//   src/lib/destinations.ts                         — destination catalog
//   src/app/map/page.tsx                            — receives ?destination,
//                                                     ?q, ?lat, ?lng,
//                                                     ?miss=1 (graceful
//                                                     unsupported-market
//                                                     state)
//
// The earlier carousel-only landing is preserved at
// src/components/landing/LandingCarousel.tsx for the cold-open mode
// that may layer on top later.

import type { Metadata } from 'next';
import LandingHome from '@/components/landing/LandingHome';

export const metadata: Metadata = {
  title: 'Plot Maps — Fly your market',
  description:
    'A spatial real-estate platform. Search any city, address, neighborhood, or place — then fly the world. Operated by Position Realty, a California-licensed brokerage.',
};

export default function LandingPage() {
  return <LandingHome />;
}
