'use client';

// ── /post — the ad landing: "Post a move request" ─────────────────────
//
// PUBLIC (the FB/TikTok ad points here). Minimal chrome: just the logo — no
// app nav, nothing to wander off into. Mounts the Google Maps APIProvider so
// ProspectSearch works for an anonymous visitor (pure Places autocomplete).
// The wizard does the rest. plan: lazy-bubbling-dragon (Prompt 1, locked).

import { APIProvider } from '@vis.gl/react-google-maps';
import MoveRequestWizard from '@/components/want/MoveRequestWizard';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { signInWithGoogle } from '@/lib/signIn';

export default function PostMoveRequestPage() {
  return (
    <div className="dsh min-h-screen">
      {/* Desktop: the designed marketing header. Nav items whose pages don't
          exist yet render disabled (no fake pages) — For Agents goes to the
          real /position surface. Mobile: collapses to the logo. */}
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
          <button type="button" className="mrq-chrome__login" onClick={() => signInWithGoogle()}>Log in</button>
          <button type="button" className="mrq-chrome__signup" onClick={() => signInWithGoogle()}>Sign up</button>
        </div>
      </header>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
        <MoveRequestWizard />
      </APIProvider>
    </div>
  );
}
