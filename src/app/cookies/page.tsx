'use client';

import Link from 'next/link';
import { useConsent } from '@/lib/consent-context';

// Cookie Policy page — reskinned 2026-06-24 to the new LIGHT theme (white
// surface, blue #1349d4 accent, ink text). Was the old dark slate/indigo.
// memory/project_front_page_locked.

export default function CookiesPage() {
  const { consent, hasConsented, setConsent, resetConsent } = useConsent();

  const ink = 'var(--plot-ink, #0c1322)';
  const body = '#4a5568';
  const brand = 'var(--plot-brand, #1349d4)';

  return (
    <div className="fp app-surface min-h-screen px-6 py-16 md:py-24">
      <div
        className="mx-auto max-w-3xl rounded-3xl p-8 md:p-10"
        style={{
          background: '#fff',
          border: '1px solid rgba(19,73,212,0.1)',
          boxShadow: '0 30px 70px -34px rgba(20,50,120,0.4)',
        }}
      >
        <h1 className="font-headline text-3xl md:text-4xl font-extrabold mb-4" style={{ color: ink }}>
          Cookie Policy
        </h1>
        <p className="leading-relaxed mb-5" style={{ color: body }}>
          PlotMaps uses cookies and similar technologies to improve your
          experience, keep you logged in, and analyze usage.
        </p>
        <p className="leading-relaxed mb-6" style={{ color: body }}>
          You can manage cookie preferences through your browser or using the
          controls below.
        </p>

        {/* Cookie Preferences */}
        <div
          className="rounded-2xl p-6 mb-6 space-y-5"
          style={{ background: '#f5f8fd', border: '1px solid rgba(19,73,212,0.1)' }}
        >
          <h2 className="text-lg font-bold" style={{ color: ink }}>Your cookie preferences</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: ink }}>Essential cookies</p>
              <p className="text-xs" style={{ color: '#7a8494' }}>Required for login and core functionality. Cannot be disabled.</p>
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
              <p className="text-sm font-semibold" style={{ color: ink }}>Analytics cookies</p>
              <p className="text-xs" style={{ color: '#7a8494' }}>Help us understand how you use the site to improve the experience.</p>
            </div>
            <button
              onClick={() => setConsent({ analytics: !consent.analytics })}
              aria-label="Toggle analytics cookies"
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{ background: consent.analytics ? brand : '#cbd5e1' }}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${consent.analytics ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2 flex-wrap">
            {hasConsented && (
              <p className="text-xs" style={{ color: '#7a8494' }}>
                Preferences saved. {consent.analytics ? 'Analytics cookies are enabled.' : 'Analytics cookies are disabled.'}
              </p>
            )}
            {hasConsented && (
              <button
                onClick={resetConsent}
                className="text-xs underline"
                style={{ color: brand }}
              >
                Reset all preferences
              </button>
            )}
          </div>
        </div>

        <p className="leading-relaxed mb-6" style={{ color: body }}>
          If you have questions, contact us at{' '}
          <a href="mailto:gregfranklin523@gmail.com" className="underline" style={{ color: brand, fontWeight: 600 }}>
            gregfranklin523@gmail.com
          </a>.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors"
          style={{ background: brand, boxShadow: '0 10px 22px -10px rgba(19,73,212,0.6)' }}
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
