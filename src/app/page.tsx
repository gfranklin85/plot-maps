'use client';

// Root route (/).
//
// The dashboard used to live HERE, which meant a signed-in user at
// plot.solutions saw the dashboard but the URL never said /dashboard
// (confusing, un-bookmarkable). Fixed 2026-06-15:
//   - Dashboard moved to /dashboard (URL now reflects the surface).
//   - Root / is auth-aware: logged-OUT visitors get the public landing
//     (the front door); logged-IN users are sent to /dashboard.
//
// See memory/project_desk_surface_backout_ui.md (routing fix).

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import FrontPage from '@/components/landing/FrontPage';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  // While auth resolves, or for a signed-in user mid-redirect, show a
  // minimal hold (avoids flashing the landing to a logged-in user).
  if (loading || user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Logged-out: the public front door (new light front page).
  return <FrontPage />;
}
