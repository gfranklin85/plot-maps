import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

// Public marketing / informational pages reachable without login.
// Locked 2026-05-29: /position, /join-position, /contact must stay
// public per project_landing_search_first_no_gate + the brokerage
// hierarchy thesis.
// Locked 2026-05-30: /map is now public too. The two-layer audience
// strategy (project_two_layer_audience_strategy.md) says casual buyers
// browse without auth, the listings popup is the public layer, and the
// agent layer (skip-trace, postcard, owner lookup) is gated INSIDE the
// map at the component level by userIsOperator. The route itself is
// public so the committee + casual buyers can fly the map freely.
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
  '/map',
  '/listings',
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

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Root path: show landing page if not logged in, dashboard if logged in
  if (pathname === '/') {
    if (!user) {
      const landingUrl = request.nextUrl.clone();
      landingUrl.pathname = '/landing';
      return NextResponse.rewrite(landingUrl);
    }
    // Logged-in root falls through to beta-gate check below.
  }

  // Not logged in on protected page → redirect to login
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Logged in on auth pages → redirect home.
  // Exception: /landing?resumeArrival=1 — the OAuth round-trip from
  // ArrivalSequence sends users back here so the destination flow can
  // pick up where it left off. Authenticated users hitting this exact
  // URL need to land on /landing so the carousel can re-mount the
  // ArrivalSequence in resume mode. Without this exception, the OAuth
  // flow bounces to '/' and the user never sees their destination land.
  const isResumingArrival =
    pathname === '/landing' && request.nextUrl.searchParams.get('resumeArrival') === '1';
  if (
    user &&
    !isResumingArrival &&
    (pathname === '/login' || pathname === '/signup' || pathname === '/landing')
  ) {
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
