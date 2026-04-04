import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-middleware';

const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/subscribe', '/landing'];

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
    return response;
  }

  // Not logged in on protected page → redirect to login
  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Logged in on auth pages → redirect home
  if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/landing')) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = '/';
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
