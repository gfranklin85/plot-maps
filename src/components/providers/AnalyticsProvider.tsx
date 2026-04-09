'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from '@/lib/consent-context';
import { useAuth } from '@/lib/auth-context';
import { getAnonymousId, readAnonymousId } from '@/lib/anonymous-id';
import { useAnalytics } from '@/hooks/useAnalytics';

export default function AnalyticsProvider({ children }: { children: ReactNode }) {
  const { consent } = useConsent();
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { trackPageView, trackEvent } = useAnalytics();
  const prevPathRef = useRef('');
  const mergedRef = useRef(false);

  // Initialize anonymous ID on mount (only if consent given)
  useEffect(() => {
    if (consent.analytics) {
      getAnonymousId(); // Creates cookie if not present
    }
  }, [consent.analytics]);

  // Track page views on route change
  useEffect(() => {
    if (!consent.analytics) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    if (url !== prevPathRef.current) {
      trackPageView(url);
      prevPathRef.current = url;
    }
  }, [pathname, searchParams, consent.analytics, trackPageView]);

  // Merge anonymous session when user signs in
  useEffect(() => {
    if (!user || mergedRef.current) return;
    const anonymousId = readAnonymousId();
    if (!anonymousId) return;

    mergedRef.current = true;
    fetch('/api/analytics/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymous_id: anonymousId }),
    }).catch(() => { /* silent fail */ });
  }, [user]);

  // Update last_active_at debounced (once per session, ~15min)
  useEffect(() => {
    if (!user || !consent.analytics) return;
    const DEBOUNCE_KEY = 'pm_last_active_update';
    const last = sessionStorage.getItem(DEBOUNCE_KEY);
    const now = Date.now();
    if (last && now - parseInt(last) < 15 * 60 * 1000) return;

    sessionStorage.setItem(DEBOUNCE_KEY, String(now));
    trackEvent('user_active');
  }, [user, consent.analytics, trackEvent]);

  return <>{children}</>;
}
