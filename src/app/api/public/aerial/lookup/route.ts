// Public Aerial View lookup endpoint — poll a render's status by videoId.
// The client polls this with exponential backoff until state === 'ACTIVE',
// then plays the returned uri. See memory/project_orbit_property_agent_magnet.
//
// GET /api/public/aerial/lookup?videoId=<id>
// → { state, uri?, error? }

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

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

export async function GET(req: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json({ state: 'ERROR', error: 'Aerial not configured' }, { status: 503 });
  }
  const videoId = (req.nextUrl.searchParams.get('videoId') || '').trim();
  if (!videoId) {
    return NextResponse.json({ state: 'ERROR', error: 'Missing videoId' }, { status: 400 });
  }

  try {
    const url = new URL('https://aerialview.googleapis.com/v1/videos:lookupVideo');
    url.searchParams.set('videoId', videoId);
    url.searchParams.set('key', GOOGLE_API_KEY);

    const res = await fetch(url.toString(), { cache: 'no-store' });
    const json = await res.json();

    if (json.error) {
      return NextResponse.json({ state: 'ERROR', error: json.error.message || 'Lookup failed' });
    }
    const state = json.state || 'UNKNOWN';
    return NextResponse.json({
      state,
      uri: state === 'ACTIVE' ? pickUri(json) : null,
    });
  } catch {
    return NextResponse.json({ state: 'ERROR', error: 'Aerial upstream error' }, { status: 502 });
  }
}
