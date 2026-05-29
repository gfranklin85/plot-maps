// Public Places autocomplete — proxies Google's Places Autocomplete
// (New) REST API for the landing search bar. NO auth required (the
// landing must work before signup — see project_landing_search_first_no_gate).
//
// Two endpoints make the search work end-to-end:
//   GET /api/public/places-autocomplete?q=…  — returns suggestion list
//   GET /api/public/place-details?placeId=…  — resolves a chosen suggestion
//                                              to lat/lng + formatted address
//
// We use Google's NEW Places API (places.googleapis.com), not the
// legacy autocomplete service, because the new API is the supported
// path going forward and returns cleaner shaped responses.
//
// Hardening:
//   - Per-IP rate limit (in-memory token bucket; replace with Redis at scale)
//   - Server-only Google API key (NEXT_PUBLIC_* is the fallback so the
//     route works in any env config)
//   - Bounded query length
//   - Minimal response shape (place_id + display string + type tags) so
//     a leaked response is not an enrichment vector

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

// Generous bucket — autocomplete fires per-keystroke. 200 / 5min still
// only costs a few cents per IP per session.
const BUCKETS = new Map<string, { tokens: number; refillAt: number }>();
const MAX_TOKENS = 200;
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

interface AutocompleteSuggestion {
  placeId: string;
  /** Bold-friendly main text (e.g. "Acapulco") */
  mainText: string;
  /** Secondary location context (e.g. "Guerrero, Mexico") */
  secondaryText: string;
  /** Google's primary type tag, useful for icon selection */
  primaryType: string | null;
}

export async function GET(req: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { suggestions: [], error: 'Autocomplete not configured' },
      { status: 503 }
    );
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }
  if (q.length > 200) {
    return NextResponse.json({ suggestions: [], error: 'Query too long' }, { status: 400 });
  }
  // Don't burn quota on single-character queries — Google returns noise
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
  if (!takeToken(ip)) {
    return NextResponse.json(
      { suggestions: [], error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        input: q,
        // No country restriction — Plot is a global flight platform.
        // No type filter — let geocodes, regions, cities, addresses,
        // landmarks all return. The landing user might type a city or
        // a famous landmark or a specific address.
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Places autocomplete upstream error:', res.status, errText);
      return NextResponse.json(
        { suggestions: [], error: 'Autocomplete upstream error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw: Array<{ placePrediction?: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; types?: string[] } }> = data.suggestions || [];

    const suggestions: AutocompleteSuggestion[] = raw
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => !!p?.placeId)
      .slice(0, 8)
      .map((p) => ({
        placeId: p.placeId!,
        mainText: p.structuredFormat?.mainText?.text ?? '',
        secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        primaryType: p.types?.[0] ?? null,
      }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('Places autocomplete network error:', err);
    return NextResponse.json(
      { suggestions: [], error: 'Autocomplete network error' },
      { status: 502 }
    );
  }
}
