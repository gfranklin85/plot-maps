'use client';

// Root route (/) — the home for EVERYONE (2026-06-19).
//
// The tool grid moved onto the front page, so / is the home for both
// logged-out AND logged-in users. No more redirecting signed-in users to
// /dashboard (that route now redirects back to / → infinite loop + a
// stuck spinner). The front page just renders, always.
// See memory/project_one_page_tools_on_landing.

import FrontPage from '@/components/landing/FrontPage';

export default function RootPage() {
  return <FrontPage />;
}
