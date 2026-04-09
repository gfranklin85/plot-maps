'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/auth-context';
import { ProfileProvider } from '@/lib/profile-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import { PhoneProvider } from '@/lib/phone-context';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <ProfileProvider>
          <SidebarProvider>
            <PhoneProvider>
              {children}
            </PhoneProvider>
          </SidebarProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
