// Google sign-in — the one entry point now that the old /landing cinematic
// is scrapped. Calls Supabase OAuth and returns to /auth/callback, which
// completes the session and routes the user into the app (/dashboard).
//
// Extracted from the old ArrivalSequence flow (minus the destination-
// arrival cookies, which were only for the retired search-fly landing).

import { supabase } from '@/lib/supabase';

// The ONE canonical app origin OAuth must go through. app.plot.solutions is
// being retired — the app lives on the APEX plot.solutions. Sign-in must start
// AND finish on that single origin; otherwise the PKCE verifier cookie is set
// for one host and the code is exchanged on another, and the flow silently dies
// ("nothing happened" tapping Explore the map on mobile — that was the app./apex
// split). localhost + *.vercel.app previews keep their own origin.
const CANONICAL_APP_ORIGIN = 'https://plot.solutions';
function canonicalAuthOrigin(): string {
  const { hostname, origin } = window.location;
  const isProdDomain =
    hostname === 'plot.solutions' || hostname.endsWith('.plot.solutions');
  return isProdDomain ? CANONICAL_APP_ORIGIN : origin;
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
