// Google sign-in — the one entry point now that the old /landing cinematic
// is scrapped. Calls Supabase OAuth and returns to /auth/callback, which
// completes the session and routes the user into the app (/dashboard).
//
// Extracted from the old ArrivalSequence flow (minus the destination-
// arrival cookies, which were only for the retired search-fly landing).

import { supabase } from '@/lib/supabase';

export async function signInWithGoogle() {
  // signInWithOAuth does a FULL-PAGE redirect to Google (no popup). If the
  // current origin isn't in Supabase's allowed redirect URLs, it resolves
  // WITHOUT navigating and the tap looks dead — the exact "nothing happened"
  // on mobile prod. Surface the error + the origin so failures aren't silent,
  // and drive the redirect ourselves via the returned url as a fallback.
  const origin = window.location.origin;
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
