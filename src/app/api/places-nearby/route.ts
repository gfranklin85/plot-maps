import { NextResponse } from 'next/server';

// Places Nearby Search proxy. Given a lat/lng, returns the closest
// Google POI (address, business, anything Google labels).
//
// This is Plot's universal "aim → fire → what's there" lookup.
// Works anywhere on Earth, no parcel data required. Parcel records
// from Plot's own DB are a bonus augmentation done elsewhere.
//
// GET /api/places-nearby?lat=...&lng=...&radius=...
//   200 → { placeId, name, address, lat, lng, types }
//   200 → { placeId: null } when nothing labeled within radius
//   400 → { error }
//   502 → { error } (upstream)
//
// Uses GOOGLE_MAPS_API_KEY (server-side) — same key as Place Details.

export const dynamic = 'force-dynamic';

interface NormalizedPoi {
  placeId: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  types: string[];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? 'NaN');
  const lng = parseFloat(url.searchParams.get('lng') ?? 'NaN');
  // Default search radius — small enough that we don't pull in
  // POIs the user wasn't aiming at, large enough to catch the
  // labeled address numbers Google floats above houses.
  const radius = Math.max(5, Math.min(500, parseFloat(url.searchParams.get('radius') ?? '100')));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'server misconfigured: missing key' }, { status: 500 });
  }

  // Places API (New) — searchNearby with rankPreference=DISTANCE so
  // the closest hit comes first. We DON'T pass a `type` filter so we
  // pick up residential addresses, businesses, points of interest,
  // whatever Google has labeled at that coordinate.
  const upstream = 'https://places.googleapis.com/v1/places:searchNearby';
  const body = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius,
      },
    },
    rankPreference: 'DISTANCE',
    maxResultCount: 1,
  };

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // Field mask restricts response (and billing tier) to what
        // the popup actually renders.
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (err) {
    console.error('[places-nearby] upstream fetch failed:', err);
    return NextResponse.json({ error: 'upstream fetch failed' }, { status: 502 });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[places-nearby] upstream non-200:', res.status, text);
    return NextResponse.json({
      error: 'upstream non-200',
      upstreamStatus: res.status,
      upstreamBody: text.slice(0, 500),
    }, { status: 502 });
  }

  const json = (await res.json()) as {
    places?: Array<{
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      types?: string[];
    }>;
  };

  const first = json.places?.[0];
  if (!first || !first.id) {
    // Log on the server so we can see whether Google returned an empty
    // result set or whether our request was malformed. The browser
    // only sees the null result; this gives us the upstream context.
    console.log('[places-nearby] no results', {
      lat, lng, radius,
      placesCount: json.places?.length ?? 0,
    });
    return NextResponse.json({ placeId: null, lat, lng, debug: 'no_results', radius });
  }

  const out: NormalizedPoi = {
    placeId: first.id,
    name: first.displayName?.text ?? null,
    address: first.formattedAddress ?? null,
    lat: first.location?.latitude ?? lat,
    lng: first.location?.longitude ?? lng,
    types: first.types ?? [],
  };

  return NextResponse.json(out);
}
