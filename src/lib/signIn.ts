// Google sign-in — the one entry point now that the old /landing cinematic
// is scrapped. Calls Supabase OAuth and returns to /auth/callback, which
// completes the session and routes the user into the app (/dashboard).
//
// Extracted from the old ArrivalSequence flow (minus the destination-
// arrival cookies, which were only for the retired search-fly landing).

import { supabase } from '@/lib/supabase';

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}
