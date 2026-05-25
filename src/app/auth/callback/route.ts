import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { mergeAnonymousSession } from '@/lib/analytics-merge';

// Name of the cookie used to flag "an arrival sequence was in flight
// when OAuth started, so route post-auth traffic back to /landing where
// the atlas can resume the sequence." Set client-side just before
// dispatching signInWithOAuth, read server-side here. 10-minute TTL so
// it doesn't persist across sessions.
const ARRIVAL_FLAG_COOKIE = 'pm_arrival_oauth';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Some OAuth round-trips (notably Google) strip extra query params
  // appended to redirectTo, so we can't always rely on ?next= surviving
  // the round-trip. The arrival-flag cookie is the reliable signal that
  // we came from the landing's destination-pick flow and should return
  // there.
  const nextFromQuery = searchParams.get('next');

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session?.user) {
      // Merge anonymous analytics session with the new user
      const cookieStore = await cookies();
      const anonId = cookieStore.get('pm_anon_id')?.value;
      if (anonId) {
        mergeAnonymousSession(anonId, data.session.user.id).catch(() => {
          /* non-blocking — don't fail auth for analytics */
        });
      }

      // Resolve destination:
      //   1. If the arrival-flag cookie is set, route to /landing so
      //      the atlas can pick up the in-flight ArrivalSequence.
      //   2. Else if ?next= survived the round-trip, honor it.
      //   3. Else default to /.
      const arrivalFlag = cookieStore.get(ARRIVAL_FLAG_COOKIE)?.value;
      let destination = nextFromQuery ?? '/';
      if (arrivalFlag === '1') {
        destination = '/landing?resumeArrival=1';
      }

      const response = NextResponse.redirect(`${origin}${destination}`);
      // Clear the arrival flag cookie now that we've consumed it.
      if (arrivalFlag) {
        response.cookies.set(ARRIVAL_FLAG_COOKIE, '', { maxAge: 0, path: '/' });
      }
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
