'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import MapNavOverlay from './MapNavOverlay';
import CallBar from '@/components/call/CallBar';
import type { ReactNode } from 'react';

const AUTH_PAGES = ['/login', '/signup', '/auth', '/subscribe', '/landing', '/setup-number'];

// Immersive pages render WITHOUT the global Sidebar/TopBar/BottomNav.
// The map is Plot's primary product surface; wrapping it in agency-app
// chrome competes with the "world is the canvas" framing. A compact
// MapNavOverlay (translucent logo top-left, expandable nav drawer)
// replaces the global chrome on these routes.
//
// /dashboard is immersive too: it's the map's BACK-OUT / pause screen —
// the world is still behind it. It must NOT wear the cream agency chrome;
// it surfaces over the (frozen) world like a pause menu. So it shares the
// map's immersive treatment + the in-world nav overlay.
const IMMERSIVE_PAGES = ['/map', '/dashboard', '/forms'];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { collapsed } = useSidebar();
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const isImmersivePage = IMMERSIVE_PAGES.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    return <>{children}</>;
  }

  // Immersive pages (the map) render the MapNavOverlay for BOTH
  // authed and public visitors — public users still need to navigate
  // to /landing, /position, etc. The overlay surfaces a different
  // menu for unauthenticated users (no Dashboard / Leads).
  //
  // EXCEPTION: /dashboard is the back-out ROOM — it carries NO app chrome
  // on the photoreal scene. Its navigation lives ON the center screen
  // (see the room menu in app/dashboard/page.tsx). So no overlay here.
  if (isImmersivePage) {
    const isRoom = pathname.startsWith('/dashboard');
    return (
      <>
        {!isRoom && <MapNavOverlay />}
        <main className="min-h-screen">{children}</main>
        {user && <CallBar />}
      </>
    );
  }

  // Non-immersive routes: public visitors get the raw page (no
  // sidebar/topbar/bottomnav). Auth-gated chrome only renders for
  // signed-in users.
  if (!loading && !user) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Sidebar />
      <TopBar />
      <main className={`pt-14 md:pt-16 pb-14 md:pb-0 min-h-screen transition-all duration-300 ml-0 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {children}
      </main>
      <BottomNav />
      <CallBar />
    </>
  );
}
