'use client';

// MarketRequestPrompt — graceful state surfaced when a visitor searches
// a city/place Plot does not currently support with property data.
//
// Locked 2026-05-29. See:
//   memory/project_landing_search_first_no_gate.md  (the launch rule:
//     unsupported markets are graceful, not failures)
//   memory/project_rollout_as_marketing_surface.md  (county rollout
//     is a marketing tool; demand capture is the funnel)
//
// Two modes:
//   - "miss" — geocoder didn't resolve the query at all. Show the
//     request capture so demand still gets logged.
//   - "uncovered" — geocoder resolved but no property data exists for
//     that area. Show the request capture + let the visitor keep flying.

import { useState } from 'react';

interface Props {
  query: string;
  mode: 'miss' | 'uncovered';
  onDismiss: () => void;
}

export default function MarketRequestPrompt({ query, mode, onDismiss }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/public/market-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus('failed');
        setError(data?.error || 'Submission failed.');
        return;
      }
      setStatus('sent');
    } catch {
      setStatus('failed');
      setError('Network error.');
    }
  };

  return (
    <div className="fixed inset-x-0 top-20 z-50 flex justify-center px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-lg rounded-2xl border border-amber-300/40 bg-zinc-950/95 backdrop-blur p-6 shadow-2xl text-zinc-100"
        style={{
          boxShadow:
            '0 0 60px -10px rgba(255,214,107,0.45), inset 0 0 0 1px rgba(242,192,99,0.35)',
        }}
      >
        {status === 'sent' ? (
          <div className="space-y-3 text-center">
            <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">
              On the list
            </div>
            <div className="text-zinc-100">
              We&apos;ll let you know when Plot Maps lights up{' '}
              <span className="text-amber-200">{query}</span>.
            </div>
            <button
              onClick={onDismiss}
              className="mt-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-5 py-2 text-sm transition-colors"
            >
              Keep flying
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">
                  {mode === 'miss' ? 'No match' : 'Property layer pending'}
                </div>
                <div className="mt-2 text-zinc-50 text-lg font-light">
                  {mode === 'miss'
                    ? <>We couldn&apos;t place <span className="text-amber-200">{query}</span>.</>
                    : <>You&apos;re flying <span className="text-amber-200">{query}</span>. Property intelligence isn&apos;t active here yet.</>}
                </div>
              </div>
              <button
                onClick={onDismiss}
                className="text-zinc-400 hover:text-zinc-100 text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed">
              Drop your email and we&apos;ll let you know the moment Plot
              Maps covers this area. Real demand drives our rollout.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="flex gap-2"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 rounded-lg bg-zinc-900/70 border border-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/30 transition-colors"
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="rounded-lg bg-amber-300 text-zinc-950 px-4 py-2.5 text-sm font-semibold hover:bg-amber-200 disabled:opacity-50 transition-colors"
              >
                {status === 'sending' ? 'Sending…' : 'Notify me'}
              </button>
            </form>
            {error && <p className="text-xs text-rose-300">{error}</p>}

            <div className="pt-2 flex items-center justify-between text-xs">
              <button
                onClick={onDismiss}
                className="text-zinc-400 hover:text-zinc-100"
              >
                Keep flying without notifications
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
