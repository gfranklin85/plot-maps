// Public Aerial View render endpoint — submit an address for a cinematic
// flyover. Google's renderVideo is FREE (per their docs: "There is no charge
// for using this endpoint"). If the video already exists for the address it
// returns immediately ACTIVE; otherwise it returns PROCESSING + a videoId to
// poll via /api/public/aerial/lookup.
// See memory/project_orbit_property_agent_magnet.
//
// POST /api/public/aerial/render  body: { address: string }
// → { state, videoId?, uri?, error? }

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

// Light per-IP rate limit (renders are free but we don't want abuse).
const BUCKETS = new Map<string, { tokens: number; refillAt: number }>();
const MAX_TOKENS = 20;
const WINDOW_MS = 5 * 60 * 1000;
function takeToken(ip: string): boolean {
  const now = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || now >= b.refillAt) { BUCKETS.set(ip, { tokens: MAX_TOKENS - 1, refillAt: now + WINDOW_MS }); return true; }
  if (b.tokens <= 0) return false;
  b.tokens -= 1; return true;
}

// Pull a playable URI out of an ACTIVE response (Google returns a `uris` map
// with mp4/image variants keyed by resolution).
function pickUri(json: unknown): string | null {
  const v = json as { uris?: Record<string, { landscapeUri?: string; portraitUri?: string }> };
  if (!v?.uris) return null;
  for (const key of Object.keys(v.uris)) {
    const u = v.uris[key];
    if (u?.landscapeUri) return u.landscapeUri;
    if (u?.portraitUri) return u.portraitUri;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ state: 'ERROR', error: 'Aerial not configured' }, { status: 503 });
  }
  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
  if (!takeToken(ip)) {
    return NextResponse.json({ state: 'ERROR', error: 'Rate limit exceeded' }, { status: 429 });
  }

  let address = '';
  try {
    const body = await req.json();
    address = (body?.address || '').toString().trim();
  } catch {
    return NextResponse.json({ state: 'ERROR', error: 'Bad request' }, { status: 400 });
  }
  if (!address || address.length > 200) {
    return NextResponse.json({ state: 'ERROR', error: 'Missing or invalid address' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://aerialview.googleapis.com/v1/videos:renderVideo?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
        cache: 'no-store',
      },
    );
    const json = await res.json();

    if (json.error) {
      // US-only / unsupported address → 400 INVALID_ARGUMENT.
      return NextResponse.json({ state: 'UNSUPPORTED', error: json.error.message || 'Address not supported.' });
    }

    const state = json.state || (json.metadata?.videoId ? 'PROCESSING' : 'UNKNOWN');
    return NextResponse.json({
      state,
      videoId: json.metadata?.videoId ?? null,
      uri: state === 'ACTIVE' ? pickUri(json) : null,
    });
  } catch {
    return NextResponse.json({ state: 'ERROR', error: 'Aerial upstream error' }, { status: 502 });
  }
}
