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
import MetaPixelProvider from '@/components/providers/MetaPixelProvider';
import GoogleAdsProvider from '@/components/providers/GoogleAdsProvider';
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
                <MetaPixelProvider>
                  <GoogleAdsProvider>
                    <ProfileProvider>
                  <SidebarProvider>
                    <PhoneProvider>
                      {children}
                      <CookieBanner />
                    </PhoneProvider>
                  </SidebarProvider>
                    </ProfileProvider>
                  </GoogleAdsProvider>
                </MetaPixelProvider>
              </AnalyticsProvider>
            </PostHogProvider>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </ConsentProvider>
  );
}
