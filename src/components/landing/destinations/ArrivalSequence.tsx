'use client';

// ArrivalSequence — the cinematic chamber that holds a visitor between
// the moment they pick a destination and the moment they arrive on the
// 3D map.
//
// Beats:
//
//   darken    — page recedes to deep navy. Wordmark fades.
//   instrument — compass glyph + destination coords appear.
//   manifest  — OAuth gate. Visitor signs in with Google before any
//               further data is captured. OAuth round-trip leaves the
//               page; sessionStorage preserves arrival state so the
//               sequence resumes after the callback.
//   logbook   — two radio questions (user type + how heard) shown
//               post-auth with name pre-filled from the OAuth identity.
//   brief     — self-paced flight controls overview. Visitor releases
//               themselves with a "Ready to fly" affordance.
//   expansion — destination card / hero panel grows to fill viewport,
//               controller rumbles, route changes to /map at the
//               destination's authored camera pose.
//
// During manifest → logbook → brief, the map route prefetches in the
// background. When expansion fires, the map mount should be near-ready,
// so the visitor doesn't see a flash of default state.
//
// All numeric durations are deliberate — not placeholders.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import type { Destination } from '@/lib/destinations';

// ── Persisted shape (localStorage) ──────────────────────────────────
// Visitor's logbook answers per arrival. When Supabase account flow
// matures, these sync server-side; for now they live client-only.
export interface SurveyorLogEntry {
  firstName: string;
  userType: UserType;
  source: HowHeard;
  destinationSlug: string;
  recordedAt: string;
}

type UserType =
  | 'real_estate'
  | 'buyer_seller'
  | 'investor'
  | 'exploring'
  | 'other';

type HowHeard =
  | 'friend'
  | 'social'
  | 'search'
  | 'event'
  | 'stumbled'
  | 'other';

const LOG_STORAGE_KEY = 'plotmaps.surveyorLog';
const ARRIVAL_STATE_KEY = 'plotmaps.arrivalInFlight';

// ── Session-bridge for OAuth round-trip ────────────────────────────
// When the visitor commits to OAuth, the browser navigates away to
// Google's consent screen. To resume the arrival sequence on return,
// we stash the destination slug + a marker in sessionStorage. On
// /landing remount, if (a) there's a stashed slug and (b) the user is
// authenticated, ArrivalSequence opens in logbook beat with the right
// destination.
interface ArrivalInFlight {
  destinationSlug: string;
  startedAt: string;
}

function stashArrivalInFlight(destinationSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ArrivalInFlight = {
      destinationSlug,
      startedAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem(ARRIVAL_STATE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage unavailable; OAuth still works, sequence just won't auto-resume */
  }
}

export function readArrivalInFlight(): ArrivalInFlight | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(ARRIVAL_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ArrivalInFlight;
    // Stale arrival states (>10 minutes old) get discarded — visitor
    // probably abandoned the OAuth flow.
    const age = Date.now() - new Date(parsed.startedAt).getTime();
    if (age > 10 * 60 * 1000) {
      window.sessionStorage.removeItem(ARRIVAL_STATE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearArrivalInFlight(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ARRIVAL_STATE_KEY);
  } catch {
    /* ignore */
  }
}

function appendToLog(entry: SurveyorLogEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = window.localStorage.getItem(LOG_STORAGE_KEY);
    const log: SurveyorLogEntry[] = existing ? JSON.parse(existing) : [];
    log.push(entry);
    window.localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    /* localStorage may be unavailable; in-session only */
  }
}

// ── Controller rumble ──────────────────────────────────────────────
// On expansion completion, send a brief haptic pulse to any connected
// gamepad. Tells the visitor in their hands that the world is live.
function triggerControllerRumble(durationMs = 280): void {
  if (typeof window === 'undefined' || !navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    // Standard Web Gamepad API rumble; not all controllers support it.
    type ActuatorPad = Gamepad & {
      vibrationActuator?: {
        playEffect: (
          type: string,
          params: {
            duration: number;
            strongMagnitude: number;
            weakMagnitude: number;
          }
        ) => Promise<unknown>;
      };
    };
    const actuator = (pad as ActuatorPad).vibrationActuator;
    if (actuator && typeof actuator.playEffect === 'function') {
      void actuator
        .playEffect('dual-rumble', {
          duration: durationMs,
          strongMagnitude: 0.6,
          weakMagnitude: 0.4,
        })
        .catch(() => {
          /* ignore — not all browsers honor every rumble request */
        });
    }
  }
}

// ── Beat machine ───────────────────────────────────────────────────
type Beat =
  | 'darken'
  | 'instrument'
  | 'manifest'
  | 'logbook'
  | 'brief'
  | 'expansion'
  | 'release';

interface RadioOption<V extends string> {
  value: V;
  label: string;
}

const USER_TYPE_OPTIONS: RadioOption<UserType>[] = [
  { value: 'real_estate', label: 'I work in real estate' },
  { value: 'investor', label: 'I invest in property' },
  { value: 'buyer_seller', label: 'I’m looking to buy or sell' },
  { value: 'exploring', label: 'Just exploring' },
  { value: 'other', label: 'Something else' },
];

const HOW_HEARD_OPTIONS: RadioOption<HowHeard>[] = [
  { value: 'friend', label: 'From someone I know' },
  { value: 'social', label: 'Social media' },
  { value: 'search', label: 'Found it searching' },
  { value: 'event', label: 'An event or conference' },
  { value: 'stumbled', label: 'Just stumbled on it' },
  { value: 'other', label: 'Other' },
];

interface Props {
  destination: Destination;
  /** When true, the sequence starts in `logbook` beat with the assumption
   *  the user is already authenticated (typical of OAuth-callback resume). */
  resumeAfterAuth?: boolean;
  onCancel?: () => void;
}

export default function ArrivalSequence({
  destination,
  resumeAfterAuth = false,
  onCancel,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [beat, setBeat] = useState<Beat>(
    resumeAfterAuth ? 'instrument' : 'darken'
  );
  const [userType, setUserType] = useState<UserType | null>(null);
  const [source, setSource] = useState<HowHeard | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const expansionContainerRef = useRef<HTMLDivElement>(null);

  // Derived: visitor's first name from the OAuth identity. Supabase
  // exposes user_metadata.full_name for Google sign-ins; we take the
  // first word.
  const firstName = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
    const full = meta.full_name || meta.name || '';
    return full.split(' ')[0] || '';
  }, [user]);

  // Preload the map route as soon as we know the visitor is committed
  // (post-auth on the resume path; on first-arrival, after manifest).
  useEffect(() => {
    if (beat === 'logbook' || beat === 'brief') {
      router.prefetch(`/map?destination=${destination.slug}`);
    }
  }, [beat, router, destination.slug]);

  // Body scroll lock — once arrival starts, the landing beneath is
  // out of reach until release.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Esc cancels and returns to the landing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && onCancel) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Beat machine — automatic transitions for visual-only beats.
  // Interactive beats (manifest, logbook, brief) wait for visitor input.
  useEffect(() => {
    if (beat === 'darken') {
      const t = setTimeout(() => setBeat('instrument'), 600);
      return () => clearTimeout(t);
    }
    if (beat === 'instrument') {
      // After the instrument has its moment, advance to either manifest
      // (if not authenticated) or logbook (if already authenticated, e.g.
      // returning visitor or post-OAuth resume).
      const next = user ? 'logbook' : 'manifest';
      const t = setTimeout(() => setBeat(next), 1200);
      return () => clearTimeout(t);
    }
    if (beat === 'expansion') {
      // Trigger the controller rumble at the start of expansion.
      triggerControllerRumble();
      const t = setTimeout(() => setBeat('release'), 1100);
      return () => clearTimeout(t);
    }
    if (beat === 'release') {
      // Persist final log entry then navigate.
      if (userType && source) {
        appendToLog({
          firstName,
          userType,
          source,
          destinationSlug: destination.slug,
          recordedAt: new Date().toISOString(),
        });
      }
      clearArrivalInFlight();
      const t = setTimeout(() => {
        router.push(`/map?destination=${destination.slug}`);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [beat, user, userType, source, firstName, destination.slug, router]);

  // ── Manifest beat: OAuth ─────────────────────────────────────────
  const handleSignIn = useCallback(async () => {
    setOauthLoading(true);
    stashArrivalInFlight(destination.slug);
    // Set a short-lived cookie so the /auth/callback route can detect
    // that we came from the landing's arrival flow even if Google
    // strips the ?next= query param during the round-trip (which it
    // sometimes does). The callback reads + clears this cookie and
    // routes back to /landing?resumeArrival=1 when set. 10-minute TTL.
    if (typeof document !== 'undefined') {
      document.cookie = `pm_arrival_oauth=1; path=/; max-age=600; samesite=lax`;
    }
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            `/landing?resumeArrival=1`
          )}`,
        },
      });
    } catch {
      setOauthLoading(false);
      clearArrivalInFlight();
      if (typeof document !== 'undefined') {
        document.cookie = `pm_arrival_oauth=; path=/; max-age=0`;
      }
    }
  }, [destination.slug]);

  // ── Logbook beat: progress to brief when both answered ───────────
  const logbookComplete = userType !== null && source !== null;
  const advanceFromLogbook = useCallback(() => {
    if (logbookComplete) setBeat('brief');
  }, [logbookComplete]);

  // ── Brief beat: progress to expansion ────────────────────────────
  const releaseToFlight = useCallback(() => {
    setBeat('expansion');
  }, []);

  // Coordinates formatted for the instrument display.
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
      {/* Field of navy that the world recedes into. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#0E1626',
          opacity: beat === 'darken' ? 0 : 1,
          transition: 'opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Warm-light pinhole from upper-left. */}
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

      {/* Stage container. */}
      <div className="relative h-full w-full flex items-center justify-center px-6">
        <div
          ref={expansionContainerRef}
          className="w-full max-w-[640px]"
          style={{
            opacity: beat === 'darken' ? 0 : 1,
            transform:
              beat === 'darken'
                ? 'translateY(12px)'
                : beat === 'expansion' || beat === 'release'
                  ? 'scale(1.04)'
                  : 'translateY(0)',
            transition:
              'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1) 200ms, transform 800ms cubic-bezier(0.4, 0, 0.2, 1) 200ms',
          }}
        >
          {/* Instrument — kept mounted across beats. */}
          <div className="flex justify-center mb-8">
            <Instrument beat={beat} />
          </div>

          {/* Coordinates header. */}
          <header className="text-center select-none mb-10">
            <div className="flex items-center justify-center gap-4 text-surface/60">
              <span className="h-px w-12 bg-current" aria-hidden />
              <span className="text-[10px] font-headline font-semibold tracking-[0.4em] uppercase">
                {beat === 'expansion' || beat === 'release'
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

          {/* ── Manifest beat: OAuth gate ──────────────────────── */}
          {beat === 'manifest' && (
            <div
              className="text-center"
              style={{
                animation:
                  'plot-arrival-beat-in 600ms cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
              }}
            >
              <p className="font-headline text-xl sm:text-2xl italic text-surface/90 mb-2">
                Before you fly,
              </p>
              <p className="font-headline text-lg sm:text-xl italic text-surface/70 mb-8">
                sign the manifest.
              </p>
              <button
                type="button"
                onClick={handleSignIn}
                disabled={oauthLoading}
                className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-surface text-on-surface font-headline text-sm tracking-wide hover:bg-surface/90 disabled:opacity-60 transition-all"
              >
                <GoogleGlyph />
                {oauthLoading ? 'Routing to Google…' : 'Continue with Google'}
              </button>
              <p className="mt-6 text-[10px] font-headline tracking-[0.28em] uppercase text-surface/35">
                The manual remembers those who sign it
              </p>
            </div>
          )}

          {/* ── Logbook beat: two radio questions ──────────────── */}
          {beat === 'logbook' && (
            <div
              className="text-center"
              style={{
                animation:
                  'plot-arrival-beat-in 600ms cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
              }}
            >
              {firstName && (
                <p className="font-headline text-lg italic text-surface/70 mb-8">
                  Welcome aboard, {firstName}.
                </p>
              )}

              <div className="mb-10">
                <p className="font-headline text-base italic text-surface/85 mb-4">
                  Who&apos;s flying today?
                </p>
                <RadioGroup
                  options={USER_TYPE_OPTIONS}
                  value={userType}
                  onChange={setUserType}
                />
              </div>

              <div className="mb-10">
                <p className="font-headline text-base italic text-surface/85 mb-4">
                  How did you find us?
                </p>
                <RadioGroup
                  options={HOW_HEARD_OPTIONS}
                  value={source}
                  onChange={setSource}
                />
              </div>

              <button
                type="button"
                onClick={advanceFromLogbook}
                disabled={!logbookComplete}
                className="px-6 py-2.5 rounded border border-surface/30 text-surface/85 font-headline italic text-sm hover:border-surface/70 hover:text-surface disabled:opacity-30 disabled:hover:border-surface/30 disabled:hover:text-surface/85 transition-all"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ── Brief beat: flight controls overview ───────────── */}
          {beat === 'brief' && (
            <div
              className="text-center"
              style={{
                animation:
                  'plot-arrival-beat-in 600ms cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
              }}
            >
              <p className="font-headline text-xl italic text-surface/90 mb-8">
                A brief from the cockpit.
              </p>

              <div className="space-y-5 text-left max-w-md mx-auto mb-10">
                <BriefRow
                  label="Forward"
                  detail="W / S or left stick"
                  desc="Throttle ahead or pull back."
                />
                <BriefRow
                  label="Look"
                  detail="Mouse or right stick"
                  desc="Tilt and turn the camera."
                />
                <BriefRow
                  label="Descend"
                  detail="LT / RT triggers"
                  desc="Drop closer or rise above."
                />
              </div>

              <button
                type="button"
                onClick={releaseToFlight}
                className="px-7 py-3 rounded bg-surface text-on-surface font-headline text-sm tracking-wide hover:bg-surface/90 transition-all"
              >
                Ready to fly →
              </button>

              <p className="mt-6 text-[10px] font-headline tracking-[0.28em] uppercase text-surface/35">
                Take your time. The field will wait.
              </p>
            </div>
          )}

          {/* ── Expansion / release beats ──────────────────────── */}
          {(beat === 'expansion' || beat === 'release') && (
            <div
              className="text-center"
              style={{
                animation:
                  'plot-arrival-beat-in 400ms cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
              }}
            >
              <p className="font-headline text-xl italic text-surface/85">
                {firstName ? `Hold tight, ${firstName}.` : 'Hold tight.'}
              </p>
              <p className="font-headline text-sm italic text-surface/55 mt-1">
                The field is opening.
              </p>
            </div>
          )}
        </div>

        {/* Cancel affordance — quiet escape. Hidden during expansion/release. */}
        {onCancel &&
          beat !== 'darken' &&
          beat !== 'expansion' &&
          beat !== 'release' && (
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

      {/* Release fade — covers the route handoff. */}
      {beat === 'release' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: '#0E1626',
            opacity: 0,
            animation: 'plot-arrival-release-fade 200ms ease-in forwards',
          }}
        />
      )}

      <style jsx global>{`
        @keyframes plot-arrival-beat-in {
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

// ── Subcomponents ───────────────────────────────────────────────────

function RadioGroup<V extends string>({
  options,
  value,
  onChange,
}: {
  options: RadioOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-2 rounded border text-sm font-headline italic transition-all ${
              active
                ? 'border-surface text-surface bg-surface/[0.08]'
                : 'border-surface/25 text-surface/70 hover:border-surface/55 hover:text-surface'
            }`}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function BriefRow({
  label,
  detail,
  desc,
}: {
  label: string;
  detail: string;
  desc: string;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <div className="w-24 shrink-0 text-[10px] font-headline tracking-[0.28em] uppercase text-surface/55">
        {label}
      </div>
      <div className="flex-1">
        <p className="font-mono text-xs text-surface/80">{detail}</p>
        <p className="font-headline italic text-sm text-surface/65 mt-0.5">
          {desc}
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function Instrument({ beat }: { beat: Beat }) {
  const isApproaching = beat === 'expansion' || beat === 'release';
  const isWaiting =
    beat === 'manifest' || beat === 'logbook' || beat === 'brief';

  return (
    <div
      aria-hidden
      style={{
        animation: isApproaching
          ? 'plot-instrument-descend 1100ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
          : undefined,
      }}
    >
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        style={{
          animation: isWaiting
            ? 'plot-instrument-breathe 4500ms ease-in-out infinite'
            : undefined,
        }}
      >
        <circle
          cx="48"
          cy="48"
          r="40"
          stroke="rgba(244, 234, 213, 0.55)"
          strokeWidth="1.25"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r="22"
          stroke="rgba(244, 234, 213, 0.75)"
          strokeWidth="1"
          fill="none"
        />
        <line x1="48" y1="14" x2="48" y2="32" stroke="rgba(244, 234, 213, 0.7)" strokeWidth="1" />
        <line x1="48" y1="64" x2="48" y2="82" stroke="rgba(244, 234, 213, 0.7)" strokeWidth="1" />
        <line x1="14" y1="48" x2="32" y2="48" stroke="rgba(244, 234, 213, 0.7)" strokeWidth="1" />
        <line x1="64" y1="48" x2="82" y2="48" stroke="rgba(244, 234, 213, 0.7)" strokeWidth="1" />
        <circle cx="48" cy="48" r="1.5" fill="rgba(244, 234, 213, 0.9)" />
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
