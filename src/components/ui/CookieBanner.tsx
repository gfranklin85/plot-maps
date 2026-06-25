'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useConsent } from '@/lib/consent-context';

// Cookie banner — reskinned 2026-06-24 to the new LIGHT theme (white
// surface, blue #1349d4 accent, ink text), matching the front page.
// Was the old dark slate/indigo styling. memory/project_front_page_locked.

export default function CookieBanner() {
  const { hasConsented, setConsent } = useConsent();
  const [showPrefs, setShowPrefs] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(true);

  if (hasConsented) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div
        className="mx-auto max-w-2xl rounded-2xl p-5"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'saturate(140%) blur(10px)',
          border: '1px solid rgba(19,73,212,0.12)',
          boxShadow: '0 24px 56px -24px rgba(20,50,120,0.45)',
        }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex-none flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'var(--plot-brand-soft, #e0e7fb)', color: 'var(--plot-brand, #1349d4)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>cookie</span>
          </span>
          <p className="text-sm leading-relaxed" style={{ color: '#4a5568' }}>
            We use cookies to improve your experience and analyze site usage.{' '}
            <Link
              href="/cookies"
              className="underline"
              style={{ color: 'var(--plot-brand, #1349d4)', fontWeight: 600 }}
            >
              Learn more
            </Link>
          </p>
        </div>

        {showPrefs && (
          <div
            className="mt-4 rounded-xl p-4 space-y-3"
            style={{ background: '#f5f8fd', border: '1px solid rgba(19,73,212,0.1)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--plot-ink, #0c1322)' }}>Essential cookies</p>
                <p className="text-xs" style={{ color: '#7a8494' }}>Required for login and core functionality</p>
              </div>
              <div
                className="rounded-full px-3 py-0.5 text-xs font-semibold"
                style={{ background: 'var(--plot-brand-soft, #e0e7fb)', color: 'var(--plot-brand-deep, #122d8d)' }}
              >
                Always on
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--plot-ink, #0c1322)' }}>Analytics cookies</p>
                <p className="text-xs" style={{ color: '#7a8494' }}>Help us understand how you use the site</p>
              </div>
              <button
                onClick={() => setAnalyticsOn(!analyticsOn)}
                aria-label="Toggle analytics cookies"
                className="relative h-6 w-11 rounded-full transition-colors"
                style={{ background: analyticsOn ? 'var(--plot-brand, #1349d4)' : '#cbd5e1' }}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${analyticsOn ? 'left-[22px]' : 'left-0.5'}`}
                />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setConsent({ analytics: true })}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
            style={{ background: 'var(--plot-brand, #1349d4)', boxShadow: '0 8px 18px -8px rgba(19,73,212,0.6)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--plot-brand-deep, #122d8d)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--plot-brand, #1349d4)')}
          >
            Accept all
          </button>
          <button
            onClick={() => setConsent({ analytics: false })}
            className="rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
            style={{ border: '1px solid rgba(12,19,34,0.16)', color: 'var(--plot-ink, #0c1322)', background: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(12,19,34,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            Reject non-essential
          </button>
          {!showPrefs ? (
            <button
              onClick={() => setShowPrefs(true)}
              className="px-3 py-2 text-sm transition-colors"
              style={{ color: '#7a8494' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--plot-ink, #0c1322)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#7a8494')}
            >
              Manage preferences
            </button>
          ) : (
            <button
              onClick={() => setConsent({ analytics: analyticsOn })}
              className="rounded-xl px-5 py-2.5 text-sm font-medium transition-colors"
              style={{ border: '1px solid rgba(19,73,212,0.4)', color: 'var(--plot-brand, #1349d4)', background: '#fff' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(19,73,212,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              Save preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
