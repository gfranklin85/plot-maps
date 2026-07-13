'use client';

// ── /listings/new — post your property for FREE ──────────────────────
//
// "Post your listing for free — yes, that's right." (Greg 2026-07-13). Zillow
// charges; we don't. Google sign-in is required (kills spam, ties the listing
// to a real account), but there is ZERO fee. Owners (FSBO) and agents both
// post. The page self-gates like /post: signed-out shows the sign-in gate,
// signed-in shows the form.

import { APIProvider } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { signInWithGoogle } from '@/lib/signIn';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotMarkLive from '@/components/ui/PlotMarkLive';
import PlotLoader from '@/components/ui/PlotLoader';
import AppHeader from '@/components/layout/AppHeader';
import ListingForm from '@/components/listings/ListingForm';

export default function NewListingPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="dsh min-h-screen" style={{ display: 'grid', placeItems: 'center' }}>
        <PlotLoader size={80} label="Getting things ready…" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="lst-new">
        <div className="fp" style={{ flex: 'none' }}>
          <AppHeader variant="app" />
        </div>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
          <ListingForm />
        </APIProvider>
        <NewListingStyles />
      </div>
    );
  }

  return <SignInGate />;
}

function NewListingStyles() {
  return (
    <style>{`
      .lst-new { min-height: 100svh; display: flex; flex-direction: column;
        background: linear-gradient(180deg, #eef4fd 0%, #f6f9ff 100%); }
    `}</style>
  );
}

function SignInGate() {
  return (
    <div className="lst-gate">
      <div className="fp" style={{ flex: 'none' }}>
        <AppHeader variant="public" />
      </div>
      <div className="lst-gate__body">
        <span className="lst-gate__eyebrow">
          <PlotMarkLive size={17} /> Free listings
        </span>
        <h1 className="font-headline lst-gate__h">Post your listing. Free.</h1>
        <p className="lst-gate__sub">
          Yes, really — no fee. List your property, add photos, set your price.
          It goes on the map and the public board where buyers are looking.
        </p>
        <button className="lst-gate__cta" onClick={() => signInWithGoogle('/listings/new')}>
          Sign in to post <span aria-hidden>→</span>
        </button>
        <p className="lst-gate__fine">
          <MaterialIcon icon="lock" className="text-[13px]" />
          Sign in with Google so every listing is real — no spam, no selling your info.
        </p>
      </div>
      <style>{`
        .lst-gate { min-height: 100svh; display: flex; flex-direction: column;
          background: linear-gradient(180deg, #cfe0f6 0%, #dbe8fa 50%, #eaf2fd 100%); }
        .lst-gate__body { flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; text-align: center; padding: 24px; }
        .lst-gate__eyebrow { display: inline-flex; align-items: center; gap: 7px;
          font-size: 11.5px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--plot-brand-deep, #122d8d); }
        .lst-gate__h { margin-top: 10px; font-size: clamp(2.6rem, 6.5vw, 4.4rem); font-weight: 800;
          line-height: 1.02; letter-spacing: -0.02em; color: var(--plot-brand-deep, #122d8d); }
        .lst-gate__sub { margin: 16px auto 0; max-width: 480px; font-size: clamp(0.98rem, 1.5vw, 1.15rem);
          line-height: 1.55; color: #3a4a72; }
        .lst-gate__cta { display: inline-flex; align-items: center; gap: 10px; margin-top: 30px;
          padding: 16px 38px; border-radius: 14px; border: none; cursor: pointer;
          background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 16px;
          box-shadow: 0 16px 32px -12px rgba(19,73,212,0.6);
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
        .lst-gate__cta:hover { transform: translateY(-2px); background: var(--plot-brand-deep, #122d8d);
          box-shadow: 0 20px 38px -12px rgba(19,73,212,0.65); }
        .lst-gate__fine { display: flex; align-items: center; justify-content: center; gap: 6px;
          margin: 18px auto 0; max-width: 380px; font-size: 12.5px; color: #6b7699; }
        @media (max-width: 720px) { .lst-gate__h { font-size: 2.3rem; } }
      `}</style>
    </div>
  );
}
