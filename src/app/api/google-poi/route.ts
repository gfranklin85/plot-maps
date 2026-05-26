import { NextResponse } from 'next/server';

// Server-side proxy for Google Place Details API.
//
// Why a proxy instead of hitting Place Details directly from the client:
//   1. Hides the API key on the server. The browser-side key
//      (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) is exposed by design for Maps
//      JS; reusing it for arbitrary API calls is fine for read-only
//      JS-API usage but Place Details billing-per-call deserves a key
//      that's never in the page. We use the server-side
//      GOOGLE_MAPS_API_KEY (already configured for other server jobs).
//   2. Lets us reshape Google's response into the slim normalized shape
//      PropertyPopup wants (one POI = one object with the few fields
//      we care about). The Place Details response is huge; the popup
//      needs a fraction of it.
//   3. Lets us cache later — Place Details charges per request. The
//      route is structured so caching can drop in without changing
//      the caller's contract.
//
// GET /api/google-poi?placeId=<id>
//   200 → { placeId, name, address, lat, lng, types, phone, website,
//           rating, userRatingsTotal }
//   400 → { error }
//   502 → { error } (upstream Google failure)

export const dynamic = 'force-dynamic';

interface NormalizedPoi {
  placeId: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  types: string[];
  phone: string | null;
  website: string | null;
  rating: number | null;
  userRatingsTotal: number | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const placeId = url.searchParams.get('placeId');
  if (!placeId) {
    return NextResponse.json({ error: 'placeId required' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'server misconfigured: missing key' }, { status: 500 });
  }

  // Place Details endpoint. `fields` restricts the response (and
  // billing tier — basic vs. contact vs. atmosphere) to only what we
  // need. See https://developers.google.com/maps/documentation/places/web-service/details
  const fields = [
    'place_id',
    'name',
    'formatted_address',
    'geometry/location',
    'types',
    'formatted_phone_number',
    'website',
    'rating',
    'user_ratings_total',
  ].join(',');

  const upstream = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  upstream.searchParams.set('place_id', placeId);
  upstream.searchParams.set('fields', fields);
  upstream.searchParams.set('key', key);

  let res: Response;
  try {
    res = await fetch(upstream.toString(), { cache: 'no-store' });
  } catch (err) {
    console.error('[google-poi] upstream fetch failed:', err);
    return NextResponse.json({ error: 'upstream fetch failed' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'upstream non-200' }, { status: 502 });
  }

  const json = (await res.json()) as {
    status: string;
    error_message?: string;
    result?: {
      place_id?: string;
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      types?: string[];
      formatted_phone_number?: string;
      website?: string;
      rating?: number;
      user_ratings_total?: number;
    };
  };

  if (json.status !== 'OK' || !json.result) {
    // ZERO_RESULTS / INVALID_REQUEST / OVER_QUERY_LIMIT / etc.
    return NextResponse.json(
      { error: 'place not found', upstreamStatus: json.status, upstreamMessage: json.error_message ?? null },
      { status: 404 },
    );
  }

  const r = json.result;
  const out: NormalizedPoi = {
    placeId: r.place_id ?? placeId,
    name: r.name ?? null,
    address: r.formatted_address ?? null,
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
    types: r.types ?? [],
    phone: r.formatted_phone_number ?? null,
    website: r.website ?? null,
    rating: r.rating ?? null,
    userRatingsTotal: r.user_ratings_total ?? null,
  };

  return NextResponse.json(out);
}
