'use client';

// ── /post — the SELLER intake: "Post your move" ───────────────────────
//
// This page is for SELLERS — people who OWN a property and want to make a
// move (Greg 2026-07-08). They post what they want AND show what they've got;
// the property is the tradeable asset that makes a match possible. Renters
// "dreaming about where they'd buy" have nothing to put in the web — they go
// through the buyers platform, not here.
//
// AUTH FIRST: you must sign in with Google before the intake appears. No
// anonymous daydreamers, every want tied to a real account from turn one,
// and no AI spend on unqualified visitors. plan: lazy-bubbling-dragon.

import { APIProvider } from '@vis.gl/react-google-maps';
import SellerIntake from '@/components/want/SellerIntake';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { signInWithGoogle } from '@/lib/signIn';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function PostMoveRequestPage() {
  const { user, loading } = useAuth();

  return (
    <div className="dsh min-h-screen">
      <header className="mrq-chrome">
        <a href="/" className="mrq-chrome__logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" />
          <span>
            by
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/position-logo.svg" alt="Position" />
          </span>
        </a>
        <nav className="mrq-chrome__nav">
          <span className="mrq-chrome__link is-soon" title="Coming soon">How it works</span>
          <span className="mrq-chrome__link is-soon" title="Coming soon">For Service Members</span>
          <a className="mrq-chrome__link" href="/position">For Agents</a>
          <span className="mrq-chrome__link is-soon" title="Coming soon">About</span>
        </nav>
        <div className="mrq-chrome__auth">
          {!user && (
            <button type="button" className="mrq-chrome__login" onClick={() => signInWithGoogle('/post')}>Log in</button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="mrq-gate"><div className="mrq-gate__spin" /></div>
      ) : user ? (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
          <div className="sp-page"><SellerIntake /></div>
        </APIProvider>
      ) : (
        <SignInGate />
      )}
    </div>
  );
}

// ── the seller-framed sign-in gate ──
// Auth before the intake. Framed for the audience: you own, you want to move,
// post it. Sets the expectation (this is for sellers with a property) and
// filters daydreamers before a single AI token is spent.
function SignInGate() {
  return (
    <div className="mrq-gate">
      <span className="mrq-badge"><MaterialIcon icon="hub" className="text-[14px]" /> Real Estate Interconnector</span>
      <h1 className="mrq-gate__h">Post your move.</h1>
      <p className="mrq-gate__sub">
        For owners ready to make a move: tell us where you&apos;d go and what
        you&apos;ve got, and we&apos;ll work the map for a real connection — a direct
        match or a multi-home move path. Private until you say otherwise.
      </p>
      <button className="mrq-btn mrq-btn--primary mrq-gate__btn" onClick={() => signInWithGoogle('/post')}>
        <MaterialIcon icon="login" className="text-[18px]" /> Continue with Google
      </button>
      <p className="mrq-gate__fine">
        <MaterialIcon icon="lock" className="text-[13px]" />
        We ask you to sign in so every request is real — no spam, no selling your info.
      </p>
      <p className="mrq-gate__buyer">
        Looking to buy but don&apos;t own yet? <a href="/position">That&apos;s the buyers path →</a>
      </p>
    </div>
  );
}
