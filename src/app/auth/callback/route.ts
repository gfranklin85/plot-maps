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
  const nextFromQuery = searchParams.get('next');
  // Destination slug carried through the OAuth round-trip via the
  // redirectTo URL param. This is the *primary* signal of "which city
  // was the visitor arriving at when they signed in" because URL params
  // survive origin hops (apex ↔ subdomain) cleanly, unlike per-origin
  // localStorage. ArrivalSequence sets this on redirectTo before
  // dispatching signInWithOAuth.
  const destFromQuery = searchParams.get('dest');

  console.log('[auth/callback] hit', {
    origin,
    hasCode: !!code,
    codeLen: code?.length ?? 0,
    next: nextFromQuery,
    dest: destFromQuery,
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

      // Route post-OAuth traffic back to /landing with the destination
      // slug carried through as a URL param. The atlas reads ?dest=<slug>
      // and re-mounts ArrivalSequence in resume mode on that destination.
      //
      // URL params survive origin hops (apex ↔ subdomain), so this is
      // robust across the apex/subdomain redirect chain that broke the
      // previous localStorage-based stash.
      //
      // ?next= is still honored as a fallback for sign-in flows that
      // explicitly request a different post-auth path (e.g. /login →
      // /dashboard direct sign-in) and that didn't carry a dest slug.
      const arrivalFlag = cookieStore.get(ARRIVAL_FLAG_COOKIE)?.value;
      let destination: string;
      if (destFromQuery) {
        destination = `/landing?resumeArrival=1&dest=${encodeURIComponent(destFromQuery)}`;
      } else if (arrivalFlag) {
        destination = '/landing?resumeArrival=1';
      } else if (nextFromQuery) {
        destination = nextFromQuery;
      } else {
        destination = '/landing?resumeArrival=1';
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
