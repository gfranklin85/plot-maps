import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

// Public marketing / informational pages reachable without login.
const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/subscribe', '/landing', '/privacy', '/terms', '/cookies', '/support', '/waitlist'];

// Logged-in pages reachable even for users without beta access. The
// app proper is gated; these are the "you're on the waitlist" / "log
// out" surfaces that need to work for non-beta users so they aren't
// trapped.
const BETA_BYPASS_PATHS = ['/waitlist', '/auth', '/login'];

export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request);

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
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
