import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

// Cookie domain — when the request comes from a *.plot.solutions host,
// we scope auth cookies to the parent domain (.plot.solutions) so they
// survive the apex ↔ subdomain redirect Google's OAuth callback
// sometimes performs. Without this, the PKCE verifier cookie set on
// app.plot.solutions during signInWithOAuth isn't visible when the
// callback handler runs after a hop through plot.solutions, and the
// session exchange fails with AuthPKCECodeVerifierMissingError.
//
// In development and on Vercel preview deploys (where the host is a
// generated *.vercel.app URL), we return undefined — letting Supabase
// use its default same-host scope.
function cookieDomainForHost(host: string | null): string | undefined {
  if (!host) return undefined;
  if (host.endsWith('.plot.solutions') || host === 'plot.solutions') {
    return '.plot.solutions';
  }
  return undefined;
}

export function createMiddlewareClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const host = request.headers.get('host');
  const cookieDomain = cookieDomainForHost(host);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = cookieDomain ? { ...options, domain: cookieDomain } : options;
            supabaseResponse.cookies.set(name, value, opts);
          });
        },
      },
    }
  );

  return { supabase, response: supabaseResponse };
}
