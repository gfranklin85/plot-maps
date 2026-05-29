// Public geocode endpoint — no auth required.
//
// Used by the search-first landing page so visitors can type a city /
// address / neighborhood and fly there. The authenticated geocode
// route (/api/geocode) requires a user session and tracks usage/cost
// per user; this route is public-by-design because the landing must
// work BEFORE the visitor has an account (per
// memory/project_landing_search_first_no_gate.md — "no signup required
// to fly").
//
// Hardening:
//   - Rate-limited per IP (in-memory token bucket; replace with Upstash
//     Redis when the platform reaches material traffic)
//   - Server-only Google API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is the
//     fallback — both are read so the route works in any env config)
//   - Bounded query length to defend against abuse
//   - Result shape is intentionally minimal (formatted address + coords)
//     so a leaked response is not an enrichment vector
//
// Routes to: GET /api/public/geocode?q=<text>
// Response shape: { hit: boolean, formatted: string | null, lat, lng }

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

// In-memory token bucket per IP. 30 lookups / 5 minutes is plenty for
// a curious visitor; abuse would have to come from many IPs to be
// material. When the platform grows past local launch, replace with
// Upstash Redis or move to a per-session token.
const BUCKETS = new Map<string, { tokens: number; refillAt: number }>();
const MAX_TOKENS = 30;
const WINDOW_MS = 5 * 60 * 1000;

function takeToken(ip: string): boolean {
  const now = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || now >= b.refillAt) {
    BUCKETS.set(ip, { tokens: MAX_TOKENS - 1, refillAt: now + WINDOW_MS });
    return true;
  }
  if (b.tokens <= 0) return false;
  b.tokens -= 1;
  return true;
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { hit: false, error: 'Geocoder not configured' },
      { status: 503 }
    );
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ hit: false, error: 'Missing query' }, { status: 400 });
  }
  if (q.length > 200) {
    return NextResponse.json({ hit: false, error: 'Query too long' }, { status: 400 });
  }

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
  if (!takeToken(ip)) {
    return NextResponse.json({ hit: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', q);
  url.searchParams.set('key', GOOGLE_API_KEY);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ hit: false, error: 'Geocoder upstream error' }, { status: 502 });
    }
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) {
      return NextResponse.json({ hit: false, formatted: null, lat: null, lng: null });
    }
    const top = data.results[0];
    const loc = top.geometry?.location;
    return NextResponse.json({
      hit: true,
      formatted: top.formatted_address ?? q,
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
    });
  } catch {
    return NextResponse.json({ hit: false, error: 'Geocoder network error' }, { status: 502 });
  }
}
