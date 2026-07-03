// Google sign-in — the one entry point now that the old /landing cinematic
// is scrapped. Calls Supabase OAuth and returns to /auth/callback, which
// completes the session and routes the user into the app (/dashboard).
//
// Extracted from the old ArrivalSequence flow (minus the destination-
// arrival cookies, which were only for the retired search-fly landing).

import { supabase } from '@/lib/supabase';

// The CANONICAL app origin OAuth must go through. The bug: on mobile you start
// on plot.solutions (apex), but the callback lands on app.plot.solutions —
// the PKCE verifier cookie is set for one origin and the code is exchanged on
// the other, so the sign-in silently dies ("nothing happened" tapping Explore
// the map). Pin redirectTo to the SAME origin the callback resolves to, so the
// apex ↔ subdomain hop never splits the flow. Prod = app.plot.solutions;
// localhost/preview keeps its own origin.
function canonicalAuthOrigin(): string {
  const { hostname, origin } = window.location;
  if (hostname === 'plot.solutions' || hostname.endsWith('.plot.solutions')) {
    return 'https://app.plot.solutions';
  }
  return origin; // localhost, *.vercel.app previews, etc.
}

export async function signInWithGoogle() {
  // signInWithOAuth does a FULL-PAGE redirect to Google (no popup). If the
  // current origin isn't in Supabase's allowed redirect URLs, it resolves
  // WITHOUT navigating and the tap looks dead. Surface the error + origin so
  // failures aren't silent, and drive the redirect ourselves.
  const origin = canonicalAuthOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      // skipBrowserRedirect lets us navigate deterministically below — some
      // mobile browsers drop the auto-redirect from an async handler.
      skipBrowserRedirect: true,
    },
  });
  if (error) {
    console.error('[signIn] Google OAuth failed for origin', origin, error.message);
    return;
  }
  if (data?.url) {
    window.location.assign(data.url);
  } else {
    console.error('[signIn] OAuth returned no redirect url for origin', origin);
  }
}
