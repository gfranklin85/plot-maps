'use client';

// ── AppHeader ─────────────────────────────────────────────────────────
//
// THE navigation for the whole app — one header on every page, no sidebar
// ([[project_nav_model_header_only]]). Real PlotMaps logomark + dotless-i
// Position wordmark ([[feedback_position_dotless_i_signature]]).
//
// `variant`:
//   'public'  — logged-out front door: Plot Maps / Brokerage / Listings /
//               Company · Log in · Get Started (both → Google OAuth).
//   'app'     — signed-in: Home · Map · account menu (Settings, Sign out).
//               Tools are reached via the cards on Home, not nav links.

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/profile-context';
import { signInWithGoogle } from '@/lib/signIn';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function AppHeader({ variant = 'public' }: { variant?: 'public' | 'app' }) {
  const { user, signOut } = useAuth();

  return (
    <header className="fp-header">
      <div className="fp__wrap">
        <nav className="fp-nav">
          <a href="/" className="fp-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" className="fp-logo__img" />
            <span className="fp-logo__by">
              by
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/position-logo.svg" alt="Position" className="fp-logo__position" />
            </span>
          </a>

          {variant === 'public' ? (
            // The shared marketing nav spine — same links on every public
            // surface so nothing orphans. memory/feedback_reveal_facts_not_hype_voice
            <div className="fp-navlinks">
              <a className="fp-navlink" href="/map">The map</a>
              <a className="fp-navlink" href="/#intent">The Network</a>
              <a className="fp-navlink" href="/#orbit">Orbit</a>
              <a className="fp-navlink" href="/bullpen">The Bullpen</a>
              <a className="fp-navlink" href="/essays">Essays</a>
              <a className="fp-navlink" href="/position">Position</a>
            </div>
          ) : (
            <div className="fp-navlinks">
              <a className="fp-navlink" href="/">Home</a>
              <a className="fp-navlink" href="/map?view=3d">Map</a>
              <a className="fp-navlink" href="/connections">Connections</a>
              <a className="fp-navlink" href="/documents">Documents</a>
            </div>
          )}

          <div className="fp-nav__spacer" />

          {variant === 'public' ? (
            // Auth-aware: logged OUT → "Log in" (the only header action; the
            // real CTAs are the hero buttons). Logged IN → the account menu
            // (avatar → Settings / Sign out). Nothing forced into the gap.
            // memory/project_dreamer_funnel_buttons
            user ? (
              <AccountMenu onSignOut={() => { signOut(); window.location.href = '/'; }} />
            ) : (
              <button type="button" className="fp-get" onClick={() => signInWithGoogle()}>Log in</button>
            )
          ) : (
            <>
              <a className="fp-get fp-app-map" href="/map?view=3d">Open the Map</a>
              <AccountMenu onSignOut={() => { signOut(); window.location.href = '/'; }} />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

// ── Account menu (signed-in) ──────────────────────────────────────────
// Initials avatar → dropdown with Settings + Sign out. Replaces the loose
// buttons. Closes on outside-click / Escape.
function AccountMenu({ onSignOut }: { onSignOut: () => void }) {
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const name = profile.fullName || '';
  const initials = name
    ? name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
    : 'PM';

  return (
    <div className="fp-account" ref={ref}>
      <button type="button" className="fp-account__btn" onClick={() => setOpen((o) => !o)} aria-label="Account">
        <span className="fp-account__avatar">{initials}</span>
        <MaterialIcon icon="expand_more" className="text-[18px] fp-account__caret" />
      </button>
      {open && (
        <div className="fp-account__menu">
          {name && <div className="fp-account__name">{name}</div>}
          <a className="fp-account__item" href="/settings">
            <MaterialIcon icon="settings" className="text-[18px]" /> Settings
          </a>
          <button type="button" className="fp-account__item" onClick={onSignOut}>
            <MaterialIcon icon="logout" className="text-[18px]" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
