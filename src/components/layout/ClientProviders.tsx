'use client';

import { Suspense } from 'react';
import { ThemeProvider } from 'next-themes';
import { ConsentProvider } from '@/lib/consent-context';
import { AuthProvider } from '@/lib/auth-context';
import { ProfileProvider } from '@/lib/profile-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import { PhoneProvider } from '@/lib/phone-context';
import PostHogProvider from '@/components/providers/PostHogProvider';
import AnalyticsProvider from '@/components/providers/AnalyticsProvider';
import CookieBanner from '@/components/ui/CookieBanner';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <AuthProvider>
          <Suspense fallback={null}>
            <PostHogProvider>
              <AnalyticsProvider>
                <ProfileProvider>
                  <SidebarProvider>
                    <PhoneProvider>
                      {children}
                      <CookieBanner />
                    </PhoneProvider>
                  </SidebarProvider>
                </ProfileProvider>
              </AnalyticsProvider>
            </PostHogProvider>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </ConsentProvider>
  );
}
