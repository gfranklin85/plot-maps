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
import PlotMarkLive from '@/components/ui/PlotMarkLive';
import PlotLoader from '@/components/ui/PlotLoader';
import AppHeader from '@/components/layout/AppHeader';
import SkyWorld from '@/components/sky/SkyWorld';

export default function PostMoveRequestPage() {
  const { user, loading } = useAuth();

  // Signed-IN: the actual intake (AppShell provides the app header).
  if (loading) {
    return (
      <div className="dsh min-h-screen" style={{ display: 'grid', placeItems: 'center' }}>
        <PlotLoader size={80} label="Getting your workspace ready…" />
      </div>
    );
  }
  if (user) {
    return (
      <div className="post-gate">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
          <SkyWorld quiet>
            <SellerIntake />
          </SkyWorld>
        </APIProvider>
        <PostGateStyles />
      </div>
    );
  }
  // Signed-OUT: the beautiful sky-framed sign-in gate.
  return <SignInGate />;
}

// shared frame styles for both the gate and the signed-in intake
function PostGateStyles() {
  return (
    <style>{`
      .post-gate { height: 100svh; display: flex; flex-direction: column;
        background: linear-gradient(180deg, #cfe0f6 0%, #dbe8fa 50%, #eaf2fd 100%); overflow: hidden; }
    `}</style>
  );
}

// ── the seller-framed sign-in gate — wears the SkyWorld ──
// Auth before the intake (locked: no anonymous daydreamers, every post tied to
// a real account, no AI spend on tire-kickers). Now beautiful: the Floating
// Plots world, coordinated blues, living mark. One viewport, no scroll.
function SignInGate() {
  return (
    <div className="post-gate">
      <div className="fp" style={{ flex: 'none' }}>
        <AppHeader variant="public" />
      </div>
      <SkyWorld>
        <span className="post-gate__eyebrow">
          <PlotMarkLive size={17} /> Real Estate Interconnector
        </span>
        <h1 className="font-headline post-gate__h">Post your move.</h1>
        <p className="post-gate__sub">
          Tell us what you have and where you want to go. We&apos;ll work the map
          to uncover direct matches and multi-home move paths. Private until you
          say otherwise.
        </p>
        <button className="post-gate__cta" onClick={() => signInWithGoogle('/post')}>
          Post your move <span aria-hidden>→</span>
        </button>
        <p className="post-gate__fine">
          <MaterialIcon icon="lock" className="text-[13px]" />
          Sign in with Google so every request is real — no spam, no selling your info.
        </p>
      </SkyWorld>

      <PostGateStyles />
      <style>{`
        .post-gate__eyebrow { display: inline-flex; align-items: center; gap: 7px;
          font-size: 11.5px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--plot-brand-deep, #122d8d); }
        .post-gate__h { margin-top: 10px; font-size: clamp(2.6rem, 6.5vw, 4.4rem); font-weight: 800;
          line-height: 1.02; letter-spacing: -0.02em; color: var(--plot-brand-deep, #122d8d); }
        .post-gate__sub { margin: 16px auto 0; max-width: 460px; font-size: clamp(0.98rem, 1.5vw, 1.15rem);
          line-height: 1.55; color: #3a4a72; }
        .post-gate__cta { display: inline-flex; align-items: center; gap: 10px; margin-top: 30px;
          padding: 16px 38px; border-radius: 14px; border: none; cursor: pointer;
          background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 16px;
          box-shadow: 0 16px 32px -12px rgba(19,73,212,0.6);
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .post-gate__cta:hover { transform: translateY(-2px); background: var(--plot-brand-deep, #122d8d);
          box-shadow: 0 20px 38px -12px rgba(19,73,212,0.65); }
        .post-gate__fine { display: flex; align-items: center; justify-content: center; gap: 6px;
          margin: 18px auto 0; max-width: 380px; font-size: 12.5px; color: #6b7699; }
        @media (max-width: 720px) { .post-gate__h { font-size: 2.3rem; } }
      `}</style>
    </div>
  );
}
