'use client';

// ── AppShell ──────────────────────────────────────────────────────────
//
// 2026-06-19: the OLD cream "Visual Prospecting CRM" shell (Sidebar +
// TopBar + BottomNav, Material cream/dark theme) is REMOVED. It wrapped
// ~30 logged-in routes and was the last of the old design. Every route now
// renders SELF-CONTAINED — new-theme pages (the front page, tool grid)
// bring their own light/blue chrome (AppHeader); the map keeps its
// immersive MapNavOverlay; old pages render raw (they'll be rebuilt one at
// a time, each graduating to the new theme).
//
// The only thing AppShell still does: keep the map's overlay + the CallBar
// for signed-in users. Otherwise it's a pass-through.
// See memory/project_one_page_tools_on_landing + the front-page lock.

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import AppHeader from './AppHeader';
import CallBar from '@/components/call/CallBar';
import { useGamepadNav } from '@/lib/useGamepadNav';
import type { ReactNode } from 'react';

// Controller navigation on every NON-map surface: plug in a pad, cycle the
// highlight through the page's buttons, A to activate. The map is excluded
// (it owns flight controls). memory/project_controller_first_class_input
function GamepadNavMount({
  enabled,
  scopeSelector,
  dpadOnly,
  noAutoFocus,
}: {
  enabled: boolean;
  scopeSelector?: string;
  dpadOnly?: boolean;
  noAutoFocus?: boolean;
}) {
  useGamepadNav({ enabled, scopeSelector, dpadOnly, noAutoFocus });
  return null;
}

// The map gets the immersive nav overlay (its own translucent in-world nav).
const MAP_PAGES = ['/map'];

// Routes that render their OWN AppHeader (self-contained new-theme pages) —
// AppShell must NOT add a second header for these. The front page (/) and
// the forms surface bring their own. As old pages are rebuilt to the new
// theme + their own header, add them here.
const SELF_HEADERED: string[] = [];

// Public marketing pages that should NOT get the app header for logged-out
// visitors (they're their own surfaces). The front page handles its own
// header for everyone.
// NOTE: /post, /my-request, /seed, /join were removed here so a SIGNED-IN user
// gets the unified AppHeader on them (one consistent header everywhere). A
// signed-OUT visitor on those falls through to the raw render below, and the
// page's own gate/chrome handles it. memory/the_platform_inventory (nav = one
// header, shared spine).
const OWN_SURFACE = ['/', '/position', '/contact', '/privacy', '/terms', '/cookies', '/support', '/join-position', '/join', '/bullpen', '/buyers-first', '/buyers', '/invite', '/orbit', '/compare', '/statement'];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  // Map: the new left sidebar (in the page) IS the chrome + carries the
  // brand/home link, so MapNavOverlay is retired here (it sat top-left,
  // which the sidebar now occupies). memory/project_map_page_finished_sidebar
  if (MAP_PAGES.some((p) => pathname.startsWith(p))) {
    return (
      <>
        <main className="min-h-screen">{children}</main>
        {user && <CallBar />}
        {/* Map D-pad UI nav: the sticks/triggers fly the camera, but the D-pad
            is free — cycle the property card + bottom dash, A activates, B
            closes. dpadOnly (never touch flight axes) + noAutoFocus (no stray
            highlight during pure flight) + scoped to just those two containers.
            memory/project_controller_first_class_input */}
        <GamepadNavMount
          enabled
          scopeSelector=".sb-card, .map-dash"
          dpadOnly
          noAutoFocus
        />
      </>
    );
  }

  // Pages that own their full chrome (front page, forms, marketing) render
  // raw — they bring their own header (or intentionally have none). NO
  // CallBar here: the marketing/home surface shouldn't mint a Twilio token
  // (it was spamming /api/twilio/token 500s on the front page).
  const selfHeadered = SELF_HEADERED.some((p) => pathname.startsWith(p));
  const ownSurface =
    OWN_SURFACE.includes(pathname) || pathname === '/' || pathname.startsWith('/essays') ||
    pathname.startsWith('/b/') || pathname.startsWith('/deal/') || // link view + buyer hub bring own chrome
    pathname.startsWith('/listings') || // free listings — self-chromed (browse + post gate)
    pathname.startsWith('/hero') || pathname.startsWith('/globe'); // cinematic hero + globe own their chrome
  if (selfHeadered || ownSurface) {
    return <><GamepadNavMount enabled />{children}</>;
  }

  // Everything else: a SIGNED-IN user on an old inner page (Leads, Imports,
  // Settings, Campaigns, Admin…) gets the new app header so they always have
  // nav (Home · Map · account) — no more stranded, nav-less old pages. The
  // page body still renders its own (old) content until it's rebuilt. A
  // logged-OUT visitor on these gets redirected by middleware anyway.
  if (user) {
    return (
      <>
        <GamepadNavMount enabled />
        <div className="fp">
          <AppHeader variant="app" />
        </div>
        <main className="min-h-screen">{children}</main>
        <CallBar />
      </>
    );
  }

  // Logged-out fallback (shouldn't normally hit — middleware gates these).
  return <><GamepadNavMount enabled />{children}</>;
}
