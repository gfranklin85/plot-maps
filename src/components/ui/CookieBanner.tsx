'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useConsent } from '@/lib/consent-context';

export default function CookieBanner() {
  const { hasConsented, setConsent } = useConsent();
  const [showPrefs, setShowPrefs] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(true);

  if (hasConsented) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-sm p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-300 leading-relaxed">
              We use cookies to improve your experience and analyze site usage.{' '}
              <Link href="/cookies" className="text-indigo-400 underline hover:text-indigo-300">
                Learn more
              </Link>
            </p>
          </div>
        </div>

        {showPrefs && (
          <div className="mt-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Essential Cookies</p>
                <p className="text-xs text-slate-400">Required for login and core functionality</p>
              </div>
              <div className="rounded-full bg-indigo-500/20 px-3 py-0.5 text-xs font-medium text-indigo-300">
                Always on
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Analytics Cookies</p>
                <p className="text-xs text-slate-400">Help us understand how you use the site</p>
              </div>
              <button
                onClick={() => setAnalyticsOn(!analyticsOn)}
                className={`relative h-6 w-11 rounded-full transition-colors ${analyticsOn ? 'bg-indigo-500' : 'bg-slate-600'}`}
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
            className="rounded-full bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={() => setConsent({ analytics: false })}
            className="rounded-full border border-slate-600 px-5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Reject Non-Essential
          </button>
          {!showPrefs ? (
            <button
              onClick={() => setShowPrefs(true)}
              className="px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
            >
              Manage Preferences
            </button>
          ) : (
            <button
              onClick={() => setConsent({ analytics: analyticsOn })}
              className="rounded-full border border-indigo-500 px-5 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-500/10 transition-colors"
            >
              Save Preferences
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
