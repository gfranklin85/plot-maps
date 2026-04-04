'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { ReactNode } from 'react';

const AUTH_PAGES = ['/login', '/signup', '/auth', '/subscribe', '/landing'];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  // Hide shell on auth pages OR if user is not logged in (landing page at /)
  if (isAuthPage || (!loading && !user)) {
    return <>{children}</>;
  }

  // While loading auth, show minimal shell to avoid flash
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
      <main className="ml-64 pt-16 min-h-screen">
        {children}
      </main>
    </>
  );
}
