'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CallBar from '@/components/call/CallBar';
import type { ReactNode } from 'react';

const AUTH_PAGES = ['/login', '/signup', '/auth', '/subscribe', '/landing', '/setup-number'];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { collapsed } = useSidebar();
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isAuthPage || (!loading && !user)) {
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
      <main className={`pt-16 min-h-screen transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        {children}
      </main>
      <CallBar />
    </>
  );
}
