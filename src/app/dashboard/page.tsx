// /dashboard — RETIRED 2026-06-19.
//
// The tool grid moved onto the front page (/) — one page for everyone, since
// everything is gated at the action (try-before-buy). This route now just
// redirects home so old links/bookmarks don't 404.
// See memory/project_one_page_tools_on_landing.

import { redirect } from 'next/navigation';

export default function DashboardRedirect() {
  redirect('/');
}
