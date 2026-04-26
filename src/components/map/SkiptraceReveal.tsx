'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { formatPhone } from '@/lib/utils';

export type SkiptracePhase = 'idle' | 'searching' | 'revealed' | 'not_found' | 'error';

interface RevealData {
  ownerName: string | null;
  phones: string[];
  address: string | null;
}

interface Props {
  phase: SkiptracePhase;
  data: RevealData | null;
  errorMessage?: string | null;
  priceLabel: string;
  onTrigger: () => void;
  onCall?: (phone: string) => void;
  compact?: boolean;
}

// Adapted from V2_MapTrace prototype — lines-of-light tracing across an
// abstract street grid, then resolving onto an info card. Tuned to the
// app's indigo primary + emerald success colors.
export default function SkiptraceReveal({
  phase,
  data,
  errorMessage,
  priceLabel,
  onTrigger,
  onCall,
  compact = false,
}: Props) {
  // Force searching CSS animation to restart on each new search. Without
  // this, hitting the button after a previous failure won't redraw the trace.
  const [runId, setRunId] = useState(0);
  useEffect(() => {
    if (phase === 'searching') setRunId(r => r + 1);
  }, [phase]);

  const height = compact ? 180 : 220;

  const dashOffset = phase === 'searching' || phase === 'idle' ? 500 : 0;

  // Not-found is a low-information state — don't render the whole abstract
  // street trace just to plant a grey terminus dot. A compact message card
  // reads cleaner and avoids the "what's this random dot?" confusion.
  if (phase === 'not_found') {
    return (
      <div
        className="w-full rounded-xl border border-card-border bg-[#0a0d1c] px-4 py-5 text-center"
        role="region"
        aria-label="Skiptrace lookup"
      >
        <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <MaterialIcon icon="search_off" className="text-[18px] text-slate-400" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">No Records Found</p>
        <p className="mt-1 text-xs text-slate-300">{errorMessage || 'No additional contact info on file.'}</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-card-border bg-[#0a0d1c]"
      style={{ height }}
      role="region"
      aria-label="Skiptrace lookup"
    >
      <svg viewBox="0 0 360 220" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <pattern id="skipgrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a2040" strokeWidth="1" />
          </pattern>
          <linearGradient id="skiptrace-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0" />
            <stop offset="60%" stopColor="#4f46e5" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Grid */}
        <rect
          width="360"
          height="220"
          fill="url(#skipgrid)"
          opacity={phase === 'revealed' ? 0.35 : 0.7}
        />

        {/* Abstract street paths */}
        <g
          fill="none"
          stroke="#243056"
          strokeWidth="1.5"
          opacity={phase === 'revealed' ? 0.4 : 0.7}
        >
          <path d="M 0 60 L 360 60" />
          <path d="M 0 130 L 360 130" />
          <path d="M 80 0 L 80 220" />
          <path d="M 220 0 L 220 220" />
          <path d="M 0 180 Q 80 175 220 175 T 360 168" />
        </g>

        {/* Trace path — drawn while searching, settled on reveal */}
        {phase !== 'idle' && (
          <g key={runId}>
            <path
              d="M 12 200 L 80 200 L 80 130 L 220 130 L 220 60 L 320 60"
              fill="none"
              stroke="url(#skiptrace-stroke)"
              strokeWidth="2.5"
              strokeDasharray="500"
              strokeDashoffset={dashOffset}
              style={{
                transition: phase === 'searching'
                  ? 'stroke-dashoffset 1.6s cubic-bezier(.6,.05,.3,.95)'
                  : phase === 'revealed'
                    ? 'none'
                    : 'stroke-dashoffset 0.4s ease',
              }}
            />
            {phase === 'searching' && (
              <circle r="3.5" fill="#fff">
                <animateMotion
                  dur="1.6s"
                  fill="freeze"
                  path="M 12 200 L 80 200 L 80 130 L 220 130 L 220 60 L 320 60"
                />
              </circle>
            )}
            {phase === 'revealed' && (
              <g>
                <circle cx="320" cy="60" r="5" fill="#4f46e5" />
                <circle cx="320" cy="60" r="10" fill="none" stroke="#4f46e5" opacity="0.5">
                  <animate attributeName="r" values="5;18;5" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
          </g>
        )}
      </svg>

      {/* Idle: centered CTA */}
      {phase === 'idle' && (
        <div className="absolute inset-0 grid place-items-center px-6">
          <button
            onClick={onTrigger}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-gradient-to-b from-indigo-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] transition-transform active:scale-95"
          >
            <MaterialIcon icon="person_search" className="text-[16px]" />
            Get Owner Info — {priceLabel}
          </button>
        </div>
      )}

      {/* Searching: status pill */}
      {phase === 'searching' && (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-300 backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
          Tracing
        </div>
      )}

      {/* Revealed: info card slides up */}
      {phase === 'revealed' && data && (
        <div
          className="absolute bottom-3 left-3 right-3 animate-in fade-in slide-in-from-bottom-2 rounded-lg border border-white/10 bg-[#0b0e1c]/85 p-3 backdrop-blur duration-300"
          style={{ animationDelay: '100ms' }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300">Owner Found</span>
          </div>
          {data.ownerName && (
            <p className="text-sm font-bold text-white">{data.ownerName}</p>
          )}
          <div className="mt-1.5 flex flex-col gap-1">
            {data.phones.slice(0, 3).map((phone, idx) => (
              <button
                key={idx}
                onClick={() => onCall?.(phone)}
                className="group flex items-center justify-between gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-left transition-colors hover:bg-emerald-500/15"
              >
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-300">
                  <MaterialIcon icon="call" className="text-[12px]" />
                  {formatPhone(phone)}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/70 opacity-0 transition-opacity group-hover:opacity-100">
                  Call
                </span>
              </button>
            ))}
          </div>
          {data.address && !compact && (
            <p className="mt-2 truncate font-mono text-[10px] text-on-surface-variant/70">{data.address}</p>
          )}
        </div>
      )}

      {/* Error (lookup failed, balance issue, etc.) */}
      {phase === 'error' && (
        <div className="absolute inset-0 grid place-items-center px-6">
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-red-300">Lookup Failed</p>
            <p className="mt-1 text-xs text-slate-300">{errorMessage || 'Try again in a moment.'}</p>
            <button
              onClick={onTrigger}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/25"
            >
              <MaterialIcon icon="refresh" className="text-[13px]" />
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
