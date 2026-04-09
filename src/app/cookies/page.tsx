'use client';

import Link from 'next/link';
import { useConsent } from '@/lib/consent-context';

export default function CookiesPage() {
  const { consent, hasConsented, setConsent, resetConsent } = useConsent();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-20">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/90 p-10 shadow-2xl">
        <h1 className="text-4xl font-bold text-white mb-4">Cookie Policy</h1>
        <p className="text-slate-400 leading-relaxed mb-6">
          Plot Maps uses cookies and similar technologies to improve your experience, keep you logged in, and analyze usage.
        </p>
        <p className="text-slate-400 leading-relaxed mb-4">
          You can manage cookie preferences through your browser or using the controls below.
        </p>

        {/* Cookie Preferences */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 mb-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Your Cookie Preferences</h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Essential Cookies</p>
              <p className="text-xs text-slate-400">Required for login and core functionality. Cannot be disabled.</p>
            </div>
            <div className="rounded-full bg-indigo-500/20 px-3 py-0.5 text-xs font-medium text-indigo-300">
              Always on
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Analytics Cookies</p>
              <p className="text-xs text-slate-400">Help us understand how you use the site to improve the experience.</p>
            </div>
            <button
              onClick={() => setConsent({ analytics: !consent.analytics })}
              className={`relative h-6 w-11 rounded-full transition-colors ${consent.analytics ? 'bg-indigo-500' : 'bg-slate-600'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${consent.analytics ? 'left-[22px]' : 'left-0.5'}`}
              />
            </button>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {hasConsented && (
              <p className="text-xs text-slate-500">
                Preferences saved. {consent.analytics ? 'Analytics cookies are enabled.' : 'Analytics cookies are disabled.'}
              </p>
            )}
            {hasConsented && (
              <button
                onClick={resetConsent}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Reset all preferences
              </button>
            )}
          </div>
        </div>

        <p className="text-slate-400 leading-relaxed mb-6">
          If you have questions, contact us at{' '}
          <a href="mailto:gregfranklin523@gmail.com" className="text-indigo-400 underline">gregfranklin523@gmail.com</a>.
        </p>
        <Link href="/" className="inline-block rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors">
          Back to landing
        </Link>
      </div>
    </div>
  );
}
