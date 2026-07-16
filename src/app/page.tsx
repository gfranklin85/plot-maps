'use client';

// Root route (/) — the home for EVERYONE.
//
// 2026-07-15: the front page IS the cinematic Earth-of-wonders hero now.
// The old FrontPage (the ~9-section "feature museum" — two identities in one
// shirt, no hierarchy) is RETIRED from the route. One story, led by the
// flyable Earth: PlotMaps huge in space, the wonder marquee, "where do you
// want to go," Explore/Move/Real Estate, Join Position cornered as the agent
// door. Explore the Earth is the hook; real estate is what you do once inside.
// See memory/the_thesis + the front-page lock in the plan.
//
// FrontPage.tsx stays on disk as history; it is no longer routed here.

import CinematicHero from '@/components/landing/CinematicHero';

export default function RootPage() {
  return <CinematicHero />;
}
