import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import { mergeAnonymousSession } from '@/lib/analytics-merge';

// Cookies used to carry arrival-sequence state through the OAuth
// round-trip. Set client-side just before dispatching signInWithOAuth,
// read server-side here. 10-minute TTL.
//
// We use cookies (not URL params on redirectTo) because Google's
// consent screen strips arbitrary params from the redirect URL — only
// ?code= survives. Cookies scoped to .plot.solutions survive both the
// Google round-trip and the apex↔subdomain hop.
const ARRIVAL_FLAG_COOKIE = 'pm_arrival_oauth';
const ARRIVAL_DEST_COOKIE = 'pm_arrival_dest';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextFromQuery = searchParams.get('next');

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

      // Route post-OAuth traffic back to /landing with the destination
      // slug forwarded as a URL param. We read the slug from the
      // pm_arrival_dest cookie (set by handleSignIn just before the
      // OAuth dispatch, scoped to .plot.solutions so it survives the
      // apex↔subdomain hop), then attach it as ?dest=<slug> so the
      // atlas's resume effect can read it from the URL on mount.
      //
      // Why forward as a URL param instead of letting the atlas read
      // the cookie directly: the atlas is a client component, and
      // client-side cookie reads after OAuth can race with Next.js
      // routing. The URL param is observed synchronously in the first
      // render, which is more reliable.
      //
      // ?next= is honored as a fallback for sign-in flows that
      // explicitly request a different post-auth path (e.g. /login →
      // /dashboard) and didn't carry an arrival slug.
      const arrivalFlag = cookieStore.get(ARRIVAL_FLAG_COOKIE)?.value;
      const destFromCookie = cookieStore.get(ARRIVAL_DEST_COOKIE)?.value;
      console.log('[auth/callback] cookies', {
        hasArrivalFlag: !!arrivalFlag,
        destFromCookie: destFromCookie ?? null,
      });

      let destination: string;
      if (destFromCookie) {
        destination = `/landing?resumeArrival=1&dest=${encodeURIComponent(destFromCookie)}`;
      } else if (arrivalFlag) {
        destination = '/landing?resumeArrival=1';
      } else if (nextFromQuery) {
        destination = nextFromQuery;
      } else {
        destination = '/landing?resumeArrival=1';
      }

      const response = NextResponse.redirect(`${origin}${destination}`);
      // Clear both arrival cookies. We scope by domain too so the
      // delete actually targets the parent-domain cookie (otherwise
      // we'd just create a same-host cookie set to empty, leaving the
      // .plot.solutions one in place).
      const host = new URL(request.url).hostname;
      const cookieDomain =
        host.endsWith('.plot.solutions') || host === 'plot.solutions'
          ? '.plot.solutions'
          : undefined;
      if (arrivalFlag) {
        response.cookies.set(ARRIVAL_FLAG_COOKIE, '', {
          maxAge: 0,
          path: '/',
          domain: cookieDomain,
        });
      }
      if (destFromCookie) {
        response.cookies.set(ARRIVAL_DEST_COOKIE, '', {
          maxAge: 0,
          path: '/',
          domain: cookieDomain,
        });
      }
      return response;
    }
  }

  console.log('[auth/callback] redirecting to login with auth_failed', {
    reasonNoCode: !code,
  });
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
