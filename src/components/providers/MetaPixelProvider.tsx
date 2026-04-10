'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useConsent } from '@/lib/consent-context';
import type { ReactNode } from 'react';

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: (...args: unknown[]) => void;
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';

export default function MetaPixelProvider({ children }: { children: ReactNode }) {
  const { consent } = useConsent();
  const pathname = usePathname();

  // Load Meta Pixel script
  useEffect(() => {
    if (!consent.analytics || !PIXEL_ID) return;
    if (typeof window.fbq === 'function') return; // Already loaded

    /* eslint-disable */
    const f: any = window;
    const b = document;
    const n = function () { (n as any).callMethod ? (n as any).callMethod.apply(n, arguments) : (n as any).queue.push(arguments); };
    if (!f.fbq) { f.fbq = n; }
    (n as any).push = n;
    (n as any).loaded = true;
    (n as any).version = '2.0';
    (n as any).queue = [];
    const script = b.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    const firstScript = b.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);
    /* eslint-enable */

    f.fbq('init', PIXEL_ID);
    f.fbq('track', 'PageView');
  }, [consent.analytics]);

  // Track page views on route change
  useEffect(() => {
    if (!consent.analytics || !PIXEL_ID || !window.fbq) return;
    window.fbq('track', 'PageView');
  }, [pathname, consent.analytics]);

  return <>{children}</>;
}
