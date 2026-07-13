'use client';

import { Suspense } from 'react';
import { ThemeProvider } from 'next-themes';
import { ConsentProvider } from '@/lib/consent-context';
import { AuthProvider } from '@/lib/auth-context';
import { ProfileProvider } from '@/lib/profile-context';
import { SidebarProvider } from '@/lib/sidebar-context';
import { PhoneProvider } from '@/lib/phone-context';
import { CesiumViewerProvider } from '@/lib/cesium/CesiumViewerProvider';
import PostHogProvider from '@/components/providers/PostHogProvider';
import AnalyticsProvider from '@/components/providers/AnalyticsProvider';
import MetaPixelProvider from '@/components/providers/MetaPixelProvider';
import GoogleAdsProvider from '@/components/providers/GoogleAdsProvider';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <AuthProvider>
          <Suspense fallback={null}>
            <PostHogProvider>
              <AnalyticsProvider>
                <MetaPixelProvider>
                  <GoogleAdsProvider>
                    <ProfileProvider>
                  <SidebarProvider>
                    <PhoneProvider>
                      <CesiumViewerProvider>
                        {children}
                        {/* CookieBanner pulled 2026-07-13: its Accept/Reject
                            handlers were dead (clicking did nothing) and it
                            buried page content. Stays OUT until it's rebuilt
                            working — likely consent-on-action, not a floating
                            banner. Don't re-add the broken version. */}
                        {/* GamepadCursor (a stick-driven on-screen reticle) was
                            REMOVED 2026-07-02 — it drew the blue dot and fought
                            the new D-pad button-cycle nav (useGamepadNav, mounted
                            in AppShell). One system now: D-pad cycles buttons,
                            no moving reticle off-map. memory/project_lb_control_model */}
                      </CesiumViewerProvider>
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
