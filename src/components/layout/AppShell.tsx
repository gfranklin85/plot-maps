'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import type { ReactNode } from 'react';

const AUTH_PAGES = ['/login', '/signup', '/auth', '/subscribe', '/landing'];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isAuthPage) {
    return <>{children}</>;
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
