'use client';

// ── AppHeader ─────────────────────────────────────────────────────────
//
// The shared top bar for the new light theme — used by the front page AND
// the dashboard so the chrome is identical everywhere (consistent app
// surface). Real PlotMaps logomark + the dotless-i Position wordmark
// ([[feedback_position_dotless_i_signature]]), nav, and auth actions.
//
// `variant`:
//   'public'  — Log in / Get Started (logged-out front door)
//   'app'     — in-app nav for a signed-in user (Dashboard / Map / ...)

import { NAV_ITEMS } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function AppHeader({ variant = 'public' }: { variant?: 'public' | 'app' }) {
  const { signOut } = useAuth();
  return (
    <header className="fp-header">
      <div className="fp__wrap">
        <nav className="fp-nav">
          <a href={variant === 'app' ? '/dashboard' : '/'} className="fp-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" className="fp-logo__img" />
            <span className="fp-logo__by">
              by
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/position-logo.svg" alt="Position" className="fp-logo__position" />
            </span>
          </a>

          {variant === 'public' ? (
            <div className="fp-navlinks">
              <a className="fp-navlink" href="/map">Plot Maps</a>
              <a className="fp-navlink" href="/position">Brokerage</a>
              <a className="fp-navlink" href="/map">Listings</a>
              <a className="fp-navlink" href="/position">Company</a>
            </div>
          ) : (
            <div className="fp-navlinks">
              {NAV_ITEMS.map((item) => (
                <a key={item.href} className="fp-navlink" href={item.href}>{item.label}</a>
              ))}
            </div>
          )}

          <div className="fp-nav__spacer" />

          {variant === 'public' ? (
            <>
              {/* both enter the sign-in cinematic (/landing → Google OAuth) */}
              <a className="fp-login" href="/landing">Log in</a>
              <a className="fp-get" href="/landing">Get Started</a>
            </>
          ) : (
            <>
              <a className="fp-login" href="/settings">Settings</a>
              <button
                type="button"
                className="fp-login fp-signout"
                onClick={() => { signOut(); window.location.href = '/'; }}
                title="Sign out"
              >
                <MaterialIcon icon="logout" className="text-[16px]" />
                <span>Sign out</span>
              </button>
              <a className="fp-get" href="/map?view=3d">Open the Map</a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
