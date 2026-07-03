import posthog from 'posthog-js';

export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (posthog.__loaded) return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  // Point directly at PostHog's cloud host (+ a separate assets host) instead
  // of the /ingest reverse-proxy, which was returning an HTML 404 for
  // /array/<key>/config.js → "Uncaught SyntaxError: Unexpected token '<'"
  // that halted page JS. Direct hosts avoid the proxy path entirely.
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!key) return;

  posthog.init(key, {
    api_host: host,
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false,   // Manual for App Router
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    loaded: (ph) => {
      // Start opted out — consent provider will opt in if allowed
      ph.opt_out_capturing();
    },
  });
}

export { posthog };
