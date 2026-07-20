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
  // Pricing tool — public lead-capture funnel (ported from lemoore-homes).
  // Has its own in-page lead gate; gating behind OAuth would kill conversions.
  '/price',
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
      // Session already established — code is stale. Just send the user
      // home (the old arrival-resume landing is scrapped).
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.pathname = '/';
      cleanUrl.search = '';
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

  // The root / is PUBLIC — the new FrontPage marketing door, reachable
  // logged-out. Sign-in happens from the front page's buttons (Google OAuth
  // → /auth/callback), so the old /landing is no longer needed.
  const isPublicPath = pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // The old search-first /landing is SCRAPPED (2026-06-19) → redirect to the
  // new front page. (Keep /auth/callback etc. untouched — those run above.)
  if (pathname === '/landing') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  // /dashboard is RETIRED (2026-06-19) — the tool grid lives on / now.
  // Redirect SERVER-SIDE here so the old (cream Material) AppShell never
  // renders + flashes before a client redirect. (memory/
  // project_one_page_tools_on_landing)
  if (pathname === '/dashboard') {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  // Not logged in on a protected page → send to the new front page (/),
  // where the Get Started / Log in buttons kick off Google OAuth.
  if (!user && !isPublicPath) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  // Logged in on /login or /signup (dead redirect pages) → go home.
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
