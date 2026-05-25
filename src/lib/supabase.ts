import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cookie domain — when running on plot.solutions or any subdomain, we
// pin auth cookies (including the PKCE verifier) to the parent domain
// so they survive an apex ↔ subdomain hop in Google's OAuth callback
// path. Otherwise the cookie set during signInWithOAuth on
// app.plot.solutions wouldn't be visible to the callback handler if
// the callback request bounced through plot.solutions first, and the
// exchange would fail with AuthPKCECodeVerifierMissingError.
function cookieDomainForHost(host: string | null | undefined): string | undefined {
  if (!host) return undefined;
  if (host.endsWith('.plot.solutions') || host === 'plot.solutions') {
    return '.plot.solutions';
  }
  return undefined;
}

const cookieDomain =
  typeof window !== 'undefined'
    ? cookieDomainForHost(window.location.hostname)
    : undefined;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: cookieDomain
    ? { domain: cookieDomain, path: '/', sameSite: 'lax', secure: true }
    : undefined,
});
