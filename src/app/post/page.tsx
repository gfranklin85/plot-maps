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

export default function PostMoveRequestPage() {
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
      </header>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
        <MoveRequestWizard />
      </APIProvider>
    </div>
  );
}
