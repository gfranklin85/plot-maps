import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

// Public marketing / informational pages reachable without login.
// Locked 2026-05-29: /position, /join-position, /contact must stay
// public per project_landing_search_first_no_gate + the brokerage
// hierarchy thesis.
// Locked 2026-05-31: /map and /listings are GATED again. Universal
// Google OAuth is the entry — same friction as Zillow/Realtor/Loopnet,
// data layer + future ad targeting. The OAuth happens MID-CINEMATIC
// inside ArrivalSequence (pick destination → camera arc starts → OAuth
// → ?resumeArrival=1 → arrival lands user in the map authed). Direct
// URLs to /map bounce here, take the same cinematic-OAuth path.
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth',
  '/subscribe',
  '/landing',
  '/privacy',
  '/terms',
  '/cookies',
  '/support',
  '/waitlist',
  '/position',
  '/join-position',
  '/contact',
];

// Logged-in pages reachable even for users without beta access. The
// app proper is gated; these are the "you're on the waitlist" / "log
// out" surfaces that need to work for non-beta users so they aren't
// trapped.
const BETA_BYPASS_PATHS = ['/waitlist', '/auth', '/login'];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── /auth/callback bypass ──────────────────────────────────────────
  // The auth-callback route handler is the ONLY place that should
  // exchange an OAuth ?code= for a session. If we let the Supabase
  // middleware client run here (supabase.auth.getUser triggers the
  // session-from-URL handling), the code gets consumed in the middle-
  // ware and the callback handler tries to exchange an already-spent
  // code, producing auth_failed. Skip the middleware entirely and let
  // the route handler do its work.
  if (pathname.startsWith('/auth/callback')) {
    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareClient(request);

  const { data: { user } } = await supabase.auth.getUser();

  // ── OAuth code catcher ──────────────────────────────────────────────
  // Supabase + Google sometimes send OAuth callback traffic to the
  // configured Site URL (https://app.plot.solutions/) instead of the
  // explicit redirectTo (/auth/callback). Handle two cases:
  //
  // 1. ?code=... present AND no session yet → forward to /auth/callback
  //    so the session-exchange handler can run.
  // 2. ?code=... present AND session already exists → the code was
  //    already consumed (Supabase's client-side detectSessionInUrl ran
  //    on the dashboard load and ate it). Strip the stale code and
  //    route the user to /landing?resumeArrival=1 so the atlas can
  //    resume the in-flight ArrivalSequence.
  if (
    searchParams.has('code') &&
    !pathname.startsWith('/auth/callback')
  ) {
    if (user) {
      // Session already established — code is stale. Send the user
      // to the arrival-resume page; if no arrival was in flight, the
      // atlas just renders normally.
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.pathname = '/landing';
      cleanUrl.search = '?resumeArrival=1';
      return NextResponse.redirect(cleanUrl);
    }
    // No session yet — the code is fresh, hand it to the callback.
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    return NextResponse.redirect(callbackUrl);
  }

  // Strip ?error=auth_failed from the root after a stale-code race so
  // the URL doesn't carry the failure noise forward.
  if (pathname === '/' && searchParams.get('error') === 'auth_failed') {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.search = '';
    return NextResponse.redirect(cleanUrl);
  }

  // The root / is PUBLIC — it's the new FrontPage marketing door, must be
  // reachable logged-out. (2026-06-19: was being caught by the protected-
  // page redirect below and bounced to the old /landing.)
  const isPublicPath = pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Root path: logged-OUT visitors see the new FrontPage (rendered by
  // app/page.tsx itself — no rewrite). Logged-IN users fall through to the
  // beta-gate check below (and app/page.tsx redirects them to /dashboard).
  // 2026-06-19: the old search-first /landing no longer fronts the root;
  // the new FrontPage is the marketing door. /landing survives ONLY as the
  // OAuth sign-in cinematic host (ArrivalSequence), reached via CTAs.

  // Not logged in on a protected page → send to /landing, the sign-in
  // cinematic (Flight Manifest → Google OAuth → ?resumeArrival=1 → authed).
  // Locked 2026-05-31: universal Google OAuth, no boring /login wall.
  if (!user && !isPublicPath) {
    const landingUrl = request.nextUrl.clone();
    landingUrl.pathname = '/landing';
    landingUrl.search = '';
    return NextResponse.redirect(landingUrl);
  }

  // Logged in on auth pages → redirect home.
  // Exception: /landing?resumeArrival=1 — the OAuth round-trip from
  // ArrivalSequence sends users back here so the destination flow can
  // pick up where it left off. Authenticated users hitting this exact
  // URL need to land on /landing so the carousel can re-mount the
  // ArrivalSequence in resume mode. Without this exception, the OAuth
  // flow bounces to '/' and the user never sees their destination land.
  // Logged in on /login or /signup (dead redirect pages) → go home.
  // /landing stays reachable for logged-in users (preview / OAuth resume).
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    return NextResponse.redirect(homeUrl);
  }

  // ── Private beta gate ────────────────────────────────────────────
  // Logged in but missing beta_access → forced to /waitlist. Admins
  // are auto-granted beta_access via DB trigger, so this also gates
  // by-omission anyone who isn't an admin and hasn't been explicitly
  // flipped on. Bypass list keeps logout/waitlist reachable so a
  // gated user isn't trapped.
  //
  // Note: invited testers must have beta_access = true in their
  // profile so the /landing?resumeArrival=1 OAuth callback can complete
  // the destination flow. Otherwise they'd OAuth successfully but get
  // bounced to /waitlist mid-arrival.
  if (user && !BETA_BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('beta_access')
      .eq('id', user.id)
      .single();
    if (!profile?.beta_access) {
      const waitlistUrl = request.nextUrl.clone();
      waitlistUrl.pathname = '/waitlist';
      return NextResponse.redirect(waitlistUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.jpg|.*\\.jpeg|.*\\.png|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.webp).*)'],
};
