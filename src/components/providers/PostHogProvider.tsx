'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from '@/lib/consent-context';
import { useAuth } from '@/lib/auth-context';
import { posthog, initPostHog } from '@/lib/posthog';
import type { ReactNode } from 'react';

export default function PostHogProvider({ children }: { children: ReactNode }) {
  const { consent } = useConsent();
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef('');

  // Initialize PostHog once
  useEffect(() => {
    initPostHog();
  }, []);

  // Toggle capture based on consent
  useEffect(() => {
    if (!posthog.__loaded) return;
    if (consent.analytics) {
      posthog.opt_in_capturing();
    } else {
      posthog.opt_out_capturing();
    }
  }, [consent.analytics]);

  // Identify user on login (merges anonymous -> identified)
  useEffect(() => {
    if (!posthog.__loaded || !consent.analytics) return;
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
      });
    } else {
      posthog.reset();
    }
  }, [user, consent.analytics]);

  // Track pageviews on route change
  useEffect(() => {
    if (!posthog.__loaded || !consent.analytics) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    if (url !== prevPathRef.current) {
      posthog.capture('$pageview', { $current_url: window.location.origin + url });
      prevPathRef.current = url;
    }
  }, [pathname, searchParams, consent.analytics]);

  return <>{children}</>;
}
