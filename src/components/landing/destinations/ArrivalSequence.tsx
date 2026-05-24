'use client';

// ArrivalSequence — the cinematic chamber that holds a visitor between
// the moment they pick a destination and the moment they arrive on the
// 3D map.
//
// Sequence beats:
//
//   1. Darken    — page recedes to deep navy. Wordmark fades. The
//                  visitor is in transit; the landing is gone.
//   2. Instrument — a compass + altimeter glyph fades in centered;
//                   destination name, latitude, and longitude appear
//                   below in editorial type. They feel like they're
//                   reading from a cockpit instrument panel.
//   3. Logbook   — three surveyor's-logbook questions presented one
//                  at a time, single-field each. Their first name, the
//                  city they call home, and a soft self-identification
//                  ("Working the land" / "Just exploring"). The voice
//                  is the field surveyor's, not a SaaS form. Answers
//                  persist to localStorage; later sessions will sync
//                  them to Supabase and to user accounts when present.
//   4. Approach  — instrument animates as if descending toward the
//                  destination. "Arriving at <name>." appears. After
//                  a brief moment, the overlay fades and the next
//                  route mounts.
//
// During the entire sequence the map is preloading via Next.js route
// prefetch (router.prefetch). The visitor's perceived wait is filled
// with the logbook; the actual technical wait is the next route's
// mount + tile fetch on arrival.
//
// All numeric durations, easing curves, and copy are chosen to be the
// canonical version — not placeholders. Visual refinement happens in
// dedicated polish sessions but the structure here is the structure.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Destination } from '@/lib/destinations';

// ── Persisted shape ─────────────────────────────────────────────────
// Stored in localStorage so a returning visitor's prior answers can
// inform future arrivals and so a future Supabase sync can ingest the
// existing log. Schema is intentionally minimal — when accounts arrive
// the merge is upsert-by-localStorage-uuid.
export interface SurveyorLogEntry {
  firstName: string;
  homeCity: string;
  mode: 'working' | 'exploring';
  destinationSlug: string;
  recordedAt: string; // ISO timestamp
}

const STORAGE_KEY = 'plotmaps.surveyorLog';

function appendToLog(entry: SurveyorLogEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    const log: SurveyorLogEntry[] = existing ? JSON.parse(existing) : [];
    log.push(entry);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // localStorage may be unavailable (private browsing, quota). The
    // logbook still works in-session; we just don't persist.
  }
}

// ── Beats and timings ───────────────────────────────────────────────
// Each beat is a distinct visual state of the overlay. Timings are the
// minimum durations; the logbook beat waits for visitor input rather
// than auto-advancing.
type Beat =
  | 'darken'      // 0–600ms: background fades to navy
  | 'instrument'  // 600–1800ms: instrument + coords appear
  | 'logbook'     // input-paced: three questions, single field each
  | 'approach'    // 0–1400ms: descent + "Arriving at <name>"
  | 'release';    // overlay fades, navigation begins

interface LogbookQuestion {
  key: 'firstName' | 'homeCity' | 'mode';
  prompt: (state: { firstName: string; destinationName: string }) => string;
  placeholder: string;
  kind: 'text' | 'choice';
  choices?: { value: 'working' | 'exploring'; label: string }[];
}

const LOGBOOK_QUESTIONS: LogbookQuestion[] = [
  {
    key: 'firstName',
    prompt: () => "What should the field log call you?",
    placeholder: 'Your name',
    kind: 'text',
  },
  {
    key: 'homeCity',
    prompt: ({ firstName }) =>
      firstName
        ? `Welcome, ${firstName}. Where do you call home?`
        : 'Where do you call home?',
    placeholder: 'A city, a town, somewhere',
    kind: 'text',
  },
  {
    key: 'mode',
    prompt: () => 'Why are you flying today?',
    placeholder: '',
    kind: 'choice',
    choices: [
      { value: 'working', label: 'Working the land' },
      { value: 'exploring', label: 'Just exploring' },
    ],
  },
];

interface Props {
  destination: Destination;
  onCancel?: () => void;
}

export default function ArrivalSequence({ destination, onCancel }: Props) {
  const router = useRouter();
  const [beat, setBeat] = useState<Beat>('darken');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [mode, setMode] = useState<'working' | 'exploring' | ''>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Preload the map route in the background as soon as the overlay
  // mounts. By the time the visitor finishes the logbook, the route
  // bundle is cached and the mount is faster.
  useEffect(() => {
    router.prefetch(`/map?destination=${destination.slug}`);
  }, [router, destination.slug]);

  // Body scroll lock — once arrival starts, the landing beneath us is
  // out of reach until we release.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Esc cancels and returns to the landing. Accessibility move; most
  // visitors will complete the sequence.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onCancel) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Beat machine — advance darken → instrument → logbook automatically;
  // logbook → approach when the third question resolves; approach →
  // release after the descent animation; release navigates.
  useEffect(() => {
    if (beat === 'darken') {
      const t = setTimeout(() => setBeat('instrument'), 600);
      return () => clearTimeout(t);
    }
    if (beat === 'instrument') {
      const t = setTimeout(() => setBeat('logbook'), 1200);
      return () => clearTimeout(t);
    }
    if (beat === 'approach') {
      const t = setTimeout(() => setBeat('release'), 1400);
      return () => clearTimeout(t);
    }
    if (beat === 'release') {
      // Final write to the surveyor's log + navigate.
      appendToLog({
        firstName: firstName.trim(),
        homeCity: homeCity.trim(),
        mode: (mode || 'exploring') as 'working' | 'exploring',
        destinationSlug: destination.slug,
        recordedAt: new Date().toISOString(),
      });
      const t = setTimeout(() => {
        router.push(`/map?destination=${destination.slug}`);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [beat, destination.slug, firstName, homeCity, mode, router]);

  // Focus the input when the logbook beat or its current question arrives.
  useEffect(() => {
    if (beat === 'logbook' && inputRef.current) {
      const q = LOGBOOK_QUESTIONS[questionIndex];
      if (q && q.kind === 'text') {
        const id = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(id);
      }
    }
  }, [beat, questionIndex]);

  const currentQuestion = LOGBOOK_QUESTIONS[questionIndex];

  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentQuestion) return;
      if (currentQuestion.kind !== 'text') return;
      const value =
        currentQuestion.key === 'firstName' ? firstName.trim() : homeCity.trim();
      if (!value) return;
      if (questionIndex + 1 >= LOGBOOK_QUESTIONS.length) {
        setBeat('approach');
      } else {
        setQuestionIndex((i) => i + 1);
      }
    },
    [currentQuestion, firstName, homeCity, questionIndex]
  );

  const handleChoiceSelect = useCallback(
    (value: 'working' | 'exploring') => {
      setMode(value);
      if (questionIndex + 1 >= LOGBOOK_QUESTIONS.length) {
        setBeat('approach');
      } else {
        setQuestionIndex((i) => i + 1);
      }
    },
    [questionIndex]
  );

  // Latitude/longitude formatted for the instrument display.
  const coordsLabel = useMemo(() => {
    const latAbs = Math.abs(destination.lat).toFixed(2);
    const lngAbs = Math.abs(destination.lng).toFixed(2);
    const latHem = destination.lat >= 0 ? 'N' : 'S';
    const lngHem = destination.lng >= 0 ? 'E' : 'W';
    return `${latAbs}° ${latHem}   ${lngAbs}° ${lngHem}`;
  }, [destination.lat, destination.lng]);

  return (
    <div
      className="plot-arrival-overlay fixed inset-0 z-[100]"
      aria-modal="true"
      role="dialog"
      aria-label={`Arriving at ${destination.name}`}
    >
      {/* Field — the deep navy that the world recedes into. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#0E1626',
          opacity: beat === 'darken' ? 0 : 1,
          transition: 'opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Warm-light pinhole from upper-left — same canonical Plot light
          direction as the landing. Soft enough not to compete with the
          instrument; present enough to keep the field feeling alive. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 22% 18%, rgba(255, 232, 198, 0.10) 0%, rgba(255, 232, 198, 0) 65%)',
          opacity: beat === 'darken' ? 0 : 1,
          transition: 'opacity 1200ms ease-out',
        }}
      />

      {/* Stage — centered column. Width tuned so the editorial typography
          breathes without feeling sparse. */}
      <div className="relative h-full w-full flex items-center justify-center px-6">
        <div
          className="w-full max-w-[560px]"
          style={{
            opacity: beat === 'darken' ? 0 : 1,
            transform:
              beat === 'darken' ? 'translateY(12px)' : 'translateY(0)',
            transition:
              'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1) 200ms, transform 800ms cubic-bezier(0.4, 0, 0.2, 1) 200ms',
          }}
        >
          {/* Instrument — compass + altimeter glyph. Hand-drawn vector,
              the same theodolite-family geometry as the wordmark reticle.
              Stays mounted across beats; the descent animation in the
              approach beat is applied here. */}
          <div className="flex justify-center mb-8">
            <Instrument beat={beat} />
          </div>

          {/* Coordinates header — destination name, lat/lng. Visible
              from instrument beat onward; in approach beat it transitions
              to the arrival line. */}
          <header className="text-center select-none mb-10">
            <div className="flex items-center justify-center gap-4 text-surface/60">
              <span className="h-px w-12 bg-current" aria-hidden />
              <span className="text-[10px] font-headline font-semibold tracking-[0.4em] uppercase">
                {beat === 'approach' || beat === 'release'
                  ? 'Arriving'
                  : 'In Approach'}
              </span>
              <span className="h-px w-12 bg-current" aria-hidden />
            </div>
            <h1 className="mt-3 font-headline text-4xl sm:text-5xl font-bold tracking-tight text-surface italic">
              {destination.name}
            </h1>
            <p className="mt-2 font-mono text-[11px] sm:text-xs tracking-[0.18em] text-surface/55">
              {coordsLabel}
            </p>
          </header>

          {/* Logbook — only rendered during the logbook beat. The form
              is one question at a time; the prompt above the field
              speaks in the surveyor's voice. */}
          {beat === 'logbook' && currentQuestion && (
            <div
              className="text-center"
              style={{
                animation:
                  'plot-arrival-question-in 600ms cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
              }}
              key={`q-${questionIndex}`}
            >
              <p className="font-headline text-xl sm:text-2xl italic text-surface/90 mb-6">
                {currentQuestion.prompt({
                  firstName,
                  destinationName: destination.name,
                })}
              </p>

              {currentQuestion.kind === 'text' && (
                <form onSubmit={handleTextSubmit} className="mx-auto max-w-md">
                  <div className="flex items-center gap-3 border-b border-surface/30 focus-within:border-surface/70 transition-colors">
                    <input
                      ref={inputRef}
                      type="text"
                      value={
                        currentQuestion.key === 'firstName'
                          ? firstName
                          : homeCity
                      }
                      onChange={(e) => {
                        if (currentQuestion.key === 'firstName') {
                          setFirstName(e.target.value);
                        } else {
                          setHomeCity(e.target.value);
                        }
                      }}
                      placeholder={currentQuestion.placeholder}
                      autoComplete="off"
                      autoCapitalize="words"
                      className="flex-1 bg-transparent outline-none py-2 text-lg sm:text-xl text-surface placeholder:text-surface/35 font-headline"
                      aria-label={currentQuestion.placeholder}
                    />
                    <button
                      type="submit"
                      className="px-3 py-2 font-headline text-sm tracking-wide text-surface/80 hover:text-surface transition-colors"
                      aria-label="Continue"
                    >
                      →
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] font-headline tracking-[0.28em] uppercase text-surface/35">
                    Press enter to continue
                  </p>
                </form>
              )}

              {currentQuestion.kind === 'choice' && currentQuestion.choices && (
                <div className="flex flex-col sm:flex-row gap-3 justify-center mx-auto max-w-md">
                  {currentQuestion.choices.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      onClick={() => handleChoiceSelect(choice.value)}
                      className="flex-1 px-5 py-4 rounded-lg border border-surface/30 text-surface/85 font-headline italic text-base hover:border-surface/70 hover:text-surface hover:bg-surface/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface/40 transition-all"
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Progress dots — one per question, current one filled. */}
              <div className="flex items-center justify-center gap-2 mt-10">
                {LOGBOOK_QUESTIONS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      i === questionIndex
                        ? 'w-6 bg-surface/85'
                        : i < questionIndex
                        ? 'w-2 bg-surface/50'
                        : 'w-2 bg-surface/20'
                    }`}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          )}

          {/* Approach line — the closing breath before the map opens. */}
          {(beat === 'approach' || beat === 'release') && (
            <div
              className="text-center"
              style={{
                animation:
                  'plot-arrival-question-in 600ms cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
              }}
            >
              <p className="font-headline text-lg italic text-surface/85">
                {firstName
                  ? `Hold tight, ${firstName}.`
                  : 'Hold tight.'}
              </p>
              <p className="font-headline text-sm italic text-surface/55 mt-1">
                The field is opening.
              </p>
            </div>
          )}
        </div>

        {/* Cancel affordance — quiet escape in the upper-right corner.
            Esc also works. Visible from instrument beat onward. */}
        {onCancel && beat !== 'darken' && beat !== 'release' && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-6 right-6 text-[10px] font-headline tracking-[0.28em] uppercase text-surface/40 hover:text-surface/80 transition-colors"
            aria-label="Cancel arrival"
          >
            Return to the manual
          </button>
        )}
      </div>

      {/* Release fade — covers the moment of route handoff so the
          visitor doesn't see the next page's first paint. */}
      {beat === 'release' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: '#0E1626',
            opacity: 0,
            animation: 'plot-arrival-release-fade 350ms ease-in forwards',
          }}
        />
      )}

      <style jsx global>{`
        @keyframes plot-arrival-question-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes plot-arrival-release-fade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes plot-instrument-rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes plot-instrument-breathe {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes plot-instrument-descend {
          0% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
          70% {
            transform: scale(1.2) translateY(20px);
            opacity: 1;
          }
          100% {
            transform: scale(1.5) translateY(60px);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .plot-arrival-overlay * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ── Instrument ──────────────────────────────────────────────────────
// The hand-drawn compass + altimeter glyph that sits centered above
// the destination header. Uses the same theodolite-reticle geometry
// family as the wordmark — a ring, a crosshair, and four cardinal
// ticks at the compass rose. During the approach beat it animates as
// if the camera is descending into the destination.
function Instrument({ beat }: { beat: Beat }) {
  const isApproaching = beat === 'approach' || beat === 'release';
  const isLive = beat === 'logbook'; // breathes while waiting for input

  return (
    <div
      aria-hidden
      style={{
        animation: isApproaching
          ? 'plot-instrument-descend 1400ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : undefined,
      }}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        style={{
          animation: isLive
            ? 'plot-instrument-breathe 4500ms ease-in-out infinite'
            : undefined,
        }}
      >
        {/* Outer ring — the compass body. */}
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke="rgba(244, 234, 213, 0.55)"
          strokeWidth="1.25"
          fill="none"
        />
        {/* Inner ring — the reticle aperture. */}
        <circle
          cx="48"
          cy="48"
          r="22"
          stroke="rgba(244, 234, 213, 0.75)"
          strokeWidth="1"
          fill="none"
        />
        {/* Crosshair. */}
        <line
          x1="48"
          y1="14"
          x2="48"
          y2="32"
          stroke="rgba(244, 234, 213, 0.7)"
          strokeWidth="1"
        />
        <line
          x1="48"
          y1="64"
          x2="48"
          y2="82"
          stroke="rgba(244, 234, 213, 0.7)"
          strokeWidth="1"
        />
        <line
          x1="14"
          y1="48"
          x2="32"
          y2="48"
          stroke="rgba(244, 234, 213, 0.7)"
          strokeWidth="1"
        />
        <line
          x1="64"
          y1="48"
          x2="82"
          y2="48"
          stroke="rgba(244, 234, 213, 0.7)"
          strokeWidth="1"
        />
        {/* Center dot — the focal point. */}
        <circle cx="48" cy="48" r="1.5" fill="rgba(244, 234, 213, 0.9)" />
        {/* Cardinal labels — N at top. The other three stay implicit
            because the typography is editorial, not navigational chrome. */}
        <text
          x="48"
          y="10"
          textAnchor="middle"
          fontSize="6"
          fontFamily="var(--font-geist-sans), Inter, sans-serif"
          fontWeight="600"
          letterSpacing="0.18em"
          fill="rgba(244, 234, 213, 0.7)"
        >
          N
        </text>
      </svg>
    </div>
  );
}
