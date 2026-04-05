'use client';

import { AuthProvider } from '@/lib/auth-context';
import { ProfileProvider } from '@/lib/profile-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <SidebarProvider>
          {children}
        </SidebarProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
