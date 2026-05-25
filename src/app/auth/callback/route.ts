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

  // Diagnostic: log everything we received so we can see why exchanges
  // are failing in Vercel logs without dumping the code itself.
  console.log('[auth/callback] hit', {
    origin,
    hasCode: !!code,
    codeLen: code?.length ?? 0,
    next: nextFromQuery,
    allParams: Array.from(searchParams.keys()),
  });

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('[auth/callback] exchangeCodeForSession failed', {
        message: error.message,
        status: error.status,
        name: error.name,
      });
    }
    if (!error && data.session?.user) {
      // Merge anonymous analytics session with the new user
      const cookieStore = await cookies();
      const anonId = cookieStore.get('pm_anon_id')?.value;
      if (anonId) {
        mergeAnonymousSession(anonId, data.session.user.id).catch(() => {
          /* non-blocking — don't fail auth for analytics */
        });
      }

      // Always route post-OAuth traffic to /landing?resumeArrival=1.
      // The atlas there checks sessionStorage for an in-flight arrival:
      //   - If found → re-mount ArrivalSequence in resume mode and
      //     complete the destination flow.
      //   - If not found → the atlas just renders normally (user can
      //     pick a destination from scratch).
      //
      // This is more reliable than carrying the routing intent through
      // a cookie or query param, because cookies + ?next= are subject
      // to OAuth round-trip stripping by various providers and browsers.
      // sessionStorage is same-origin and survives reliably.
      //
      // The ?next= URL parameter is still honored as a fallback for
      // OAuth flows that explicitly request a different post-auth path
      // (e.g. /login → /dashboard direct sign-in).
      const arrivalFlag = cookieStore.get(ARRIVAL_FLAG_COOKIE)?.value;
      let destination = '/landing?resumeArrival=1';
      if (nextFromQuery && !arrivalFlag) {
        destination = nextFromQuery;
      }

      const response = NextResponse.redirect(`${origin}${destination}`);
      if (arrivalFlag) {
        response.cookies.set(ARRIVAL_FLAG_COOKIE, '', { maxAge: 0, path: '/' });
      }
      return response;
    }
  }

  console.log('[auth/callback] redirecting to login with auth_failed', {
    reasonNoCode: !code,
  });
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
