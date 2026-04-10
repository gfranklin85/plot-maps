'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/lib/consent-context';
import type { ReactNode } from 'react';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const GTAG_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || '';

export default function GoogleAdsProvider({ children }: { children: ReactNode }) {
  const { consent } = useConsent();
  const pathname = usePathname();

  // Load gtag script
  useEffect(() => {
    if (!consent.analytics || !GTAG_ID) return;
    if (window.gtag) return; // Already loaded

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GTAG_ID, { send_page_view: false });

    // Load the script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
    document.head.appendChild(script);
  }, [consent.analytics]);

  // Track page views on route change
  useEffect(() => {
    if (!consent.analytics || !GTAG_ID || !window.gtag) return;
    window.gtag('event', 'page_view', { page_path: pathname });
  }, [pathname, consent.analytics]);

  return <>{children}</>;
}
