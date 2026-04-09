'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useConsent } from '@/lib/consent-context';
import { readAnonymousId } from '@/lib/anonymous-id';

interface AnalyticsEvent {
  event_name: string;
  page_url?: string;
  metadata?: Record<string, unknown>;
}

const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BATCH = 20;

export function useAnalytics() {
  const { consent } = useConsent();
  const queueRef = useRef<AnalyticsEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(() => {
    const events = queueRef.current.splice(0, MAX_BATCH);
    if (events.length === 0) return;

    const anonymousId = readAnonymousId();
    if (!anonymousId) return;

    const payload = JSON.stringify({ anonymous_id: anonymousId, events });

    // Use sendBeacon if available (works on page unload), else fetch
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/event', payload);
    } else {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => { /* silent fail for analytics */ });
    }
  }, []);

  // Set up periodic flush and flush on page hide
  useEffect(() => {
    if (!consent.analytics) return;

    timerRef.current = setInterval(flush, FLUSH_INTERVAL);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      flush(); // flush remaining on unmount
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [consent.analytics, flush]);

  const trackEvent = useCallback((eventName: string, metadata?: Record<string, unknown>) => {
    if (!consent.analytics) return;
    queueRef.current.push({
      event_name: eventName,
      page_url: typeof window !== 'undefined' ? window.location.pathname : undefined,
      metadata,
    });

    // Auto-flush if queue gets large
    if (queueRef.current.length >= MAX_BATCH) flush();
  }, [consent.analytics, flush]);

  const trackPageView = useCallback((url: string) => {
    trackEvent('page_view', { url });
  }, [trackEvent]);

  return { trackEvent, trackPageView };
}
