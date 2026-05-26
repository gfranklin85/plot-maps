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

const ARRIVAL_STATE_KEY = 'plotmaps.arrivalInFlight';

// ── Session-bridge for OAuth round-trip ────────────────────────────
// When the visitor commits to OAuth, the browser navigates away to
// Google's consent screen. To resume the arrival sequence on return,
// we stash the destination slug + a marker in localStorage. On
// /landing remount, if (a) there's a stashed slug and (b) the user is
// authenticated, ArrivalSequence opens in logbook beat with the right
// destination.
//
// Why localStorage (not sessionStorage): an OAuth round-trip can cross
// origins (apex plot.solutions ↔ subdomain app.plot.solutions) and may
// open a fresh top-level navigation context, both of which can lose
// sessionStorage. localStorage persists per-origin and is robust to
// the redirect chain. The 10-minute TTL below prevents stale state
// from leaking across sessions.
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
    window.localStorage.setItem(ARRIVAL_STATE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage unavailable; OAuth still works, sequence just won't auto-resume */
  }
}

export function readArrivalInFlight(): ArrivalInFlight | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ARRIVAL_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ArrivalInFlight;
    // Stale arrival states (>10 minutes old) get discarded — visitor
    // probably abandoned the OAuth flow.
    const age = Date.now() - new Date(parsed.startedAt).getTime();
    if (age > 10 * 60 * 1000) {
      window.localStorage.removeItem(ARRIVAL_STATE_KEY);
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
    window.localStorage.removeItem(ARRIVAL_STATE_KEY);
    // Clean up any legacy sessionStorage entries from before the
    // localStorage migration — safe no-op if absent.
    window.sessionStorage.removeItem(ARRIVAL_STATE_KEY);
  } catch {
    /* ignore */
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
//
// darken      → opening fade-in
// instrument  → reticle + coordinates settle
// manifest    → OAuth gate (sign in with Google). Skipped if already
//               authenticated.
// expansion   → camera "punches in" toward the world
// release     → navy fade covering the handoff to /map
//
// The questions form (logbook + brief) was cut once destination load
// became fast enough that we no longer needed it as a holdover. If we
// ever want first-session attribution back, do it as a one-shot prompt
// inside /map, not on the entry critical path.
type Beat =
  | 'darken'
  | 'instrument'
  | 'manifest'
  | 'expansion'
  | 'release';

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
    // OAuth resume skips straight to expansion — the user already
    // signed the manifest before the round-trip; we just need the
    // visual handoff into /map.
    resumeAfterAuth ? 'expansion' : 'darken',
  );
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

  // Preload the map route as soon as we have a committed destination.
  // Cuts the JS-chunk download off the post-handoff transition.
  useEffect(() => {
    if (beat !== 'darken') {
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
  // Manifest is the only beat that waits for visitor input (OAuth click).
  useEffect(() => {
    if (beat === 'darken') {
      const t = setTimeout(() => setBeat('instrument'), 600);
      return () => clearTimeout(t);
    }
    if (beat === 'instrument') {
      // After the instrument settles, branch on auth state:
      //   - Signed-in visitor → straight to the handoff (expansion → release).
      //   - Anonymous visitor → manifest beat for the OAuth gate.
      const next = user ? 'expansion' : 'manifest';
      const t = setTimeout(() => setBeat(next), 1200);
      return () => clearTimeout(t);
    }
    if (beat === 'expansion') {
      triggerControllerRumble();
      const t = setTimeout(() => setBeat('release'), 1100);
      return () => clearTimeout(t);
    }
    if (beat === 'release') {
      clearArrivalInFlight();
      const t = setTimeout(() => {
        router.push(`/map?destination=${destination.slug}`);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [beat, user, destination.slug, router]);

  // ── Manifest beat: OAuth ─────────────────────────────────────────
  const handleSignIn = useCallback(async () => {
    setOauthLoading(true);
    // Carry the destination slug through the OAuth round-trip via a
    // parent-domain cookie. Why a cookie and not localStorage or a URL
    // param:
    //   - localStorage is strictly per-origin. Google's OAuth can hop
    //     between apex (plot.solutions) and subdomain
    //     (app.plot.solutions), making any same-origin stash invisible
    //     on return.
    //   - URL params on redirectTo are stripped by Google's consent
    //     screen for arbitrary keys (verified empirically — only ?code=
    //     arrives back at /auth/callback).
    //   - A cookie scoped to .plot.solutions survives both the round-
    //     trip AND the apex↔subdomain hop. Same mechanism that already
    //     carries the PKCE verifier cookie.
    stashArrivalInFlight(destination.slug);
    if (typeof document !== 'undefined') {
      // Scope to parent domain so the cookie is visible on both apex
      // (plot.solutions) and subdomain (app.plot.solutions). Locally,
      // host is 'localhost' which doesn't accept domain= cookies, so
      // we omit it there.
      const host = window.location.hostname;
      const domainAttr =
        host.endsWith('.plot.solutions') || host === 'plot.solutions'
          ? '; domain=.plot.solutions'
          : '';
      const cookieValue = encodeURIComponent(destination.slug);
      document.cookie = `pm_arrival_dest=${cookieValue}; path=/; max-age=600; samesite=lax; secure${domainAttr}`;
      document.cookie = `pm_arrival_oauth=1; path=/; max-age=600; samesite=lax; secure${domainAttr}`;
    }
    try {
      // Plain callback — no query params, since Google strips them
      // anyway. Destination comes through via the pm_arrival_dest cookie.
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch {
      setOauthLoading(false);
      clearArrivalInFlight();
      if (typeof document !== 'undefined') {
        const host = window.location.hostname;
        const domainAttr =
          host.endsWith('.plot.solutions') || host === 'plot.solutions'
            ? '; domain=.plot.solutions'
            : '';
        document.cookie = `pm_arrival_dest=; path=/; max-age=0${domainAttr}`;
        document.cookie = `pm_arrival_oauth=; path=/; max-age=0${domainAttr}`;
      }
    }
  }, [destination.slug]);


  // Coordinates formatted for the instrument display.
  const coordsLabel = useMemo(() => {
    const latAbs = Math.abs(destination.pose.lat).toFixed(2);
    const lngAbs = Math.abs(destination.pose.lng).toFixed(2);
    const latHem = destination.pose.lat >= 0 ? 'N' : 'S';
    const lngHem = destination.pose.lng >= 0 ? 'E' : 'W';
    return `${latAbs}° ${latHem}   ${lngAbs}° ${lngHem}`;
  }, [destination.pose.lat, destination.pose.lng]);

  return (
    <div
      className="plot-arrival-overlay fixed inset-0 z-[100]"
      aria-modal="true"
      role="dialog"
      aria-label={`Arriving at ${destination.name}`}
    >
      {/* Destination image — blurred, the world we're flying into.
          Renders behind everything when the destination has a hero
          shot; the navy fallback covers the gap when it doesn't. The
          blur + darken keep the foreground type legible. */}
      {destination.imageSrc && (
        <div
          aria-hidden
          className="absolute inset-0 overflow-hidden"
          style={{
            opacity: beat === 'darken' ? 0 : 1,
            transition: 'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <img
            src={destination.imageSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              filter: 'blur(28px) saturate(1.05) brightness(0.55)',
              transform: 'scale(1.1)', // avoid blur edge fringe
            }}
            draggable={false}
          />
          {/* Tint the blurred image toward navy so it composes with the
              rest of Plot's brand surface rather than fighting it. */}
          <div
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(14, 22, 38, 0.55)' }}
          />
        </div>
      )}

      {/* Field of navy — covers when no destination image, and fades
          in on release to mask the route handoff. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: '#0E1626',
          opacity: destination.imageSrc
            ? beat === 'release'
              ? 1
              : 0
            : beat === 'darken'
              ? 0
              : 1,
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
  const isWaiting = beat === 'manifest';

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
