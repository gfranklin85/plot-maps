import { createClient } from '@supabase/supabase-js';
import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

// Admin client — bypasses RLS, use in API routes for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export { supabaseAdmin };

// Same cookie-domain logic as the middleware client. Scoping auth
// cookies to .plot.solutions lets the PKCE verifier set on
// app.plot.solutions survive an apex ↔ subdomain hop in the Google
// OAuth callback path. See AuthPKCECodeVerifierMissingError thread in
// the project notes.
function cookieDomainForHost(host: string | null | undefined): string | undefined {
  if (!host) return undefined;
  if (host.endsWith('.plot.solutions') || host === 'plot.solutions') {
    return '.plot.solutions';
  }
  return undefined;
}

// Server client — respects RLS, reads user session from cookies
// Use in server components and API routes for user-scoped queries
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const host = headerStore.get('host');
  const cookieDomain = cookieDomainForHost(host);

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const opts = cookieDomain ? { ...options, domain: cookieDomain } : options;
              cookieStore.set(name, value, opts);
            });
          } catch {
            // Can't set cookies in server components, only in route handlers/middleware
          }
        },
      },
    }
  );
}
