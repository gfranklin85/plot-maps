import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY!;

const DEFAULT_TYPES = [
  'school',
  'restaurant',
  'park',
  'shopping_mall',
  'grocery_or_supermarket',
  'transit_station',
];

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  school: { label: 'Schools', icon: 'school' },
  restaurant: { label: 'Restaurants', icon: 'restaurant' },
  park: { label: 'Parks', icon: 'park' },
  shopping_mall: { label: 'Shopping', icon: 'shopping_cart' },
  grocery_or_supermarket: { label: 'Grocery', icon: 'local_grocery_store' },
  transit_station: { label: 'Transit', icon: 'directions_transit' },
};

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface PlaceResult {
  displayName?: { text: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
}

interface NearbyCategory {
  type: string;
  label: string;
  icon: string;
  places: {
    name: string;
    address: string;
    rating: number | null;
    ratingCount: number | null;
    distance: number;
    lat: number;
    lng: number;
  }[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { lat, lng, types } = body as {
      lat: number;
      lng: number;
      types?: string[];
    };

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'lat and lng are required numbers' },
        { status: 400 }
      );
    }

    const searchTypes = types && types.length > 0 ? types : DEFAULT_TYPES;

    const categories: NearbyCategory[] = [];

    for (const type of searchTypes) {
      try {
        const res = await fetch(
          'https://places.googleapis.com/v1/places:searchNearby',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': GOOGLE_API_KEY,
              'X-Goog-FieldMask':
                'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location,places.primaryType',
            },
            body: JSON.stringify({
              includedTypes: [type],
              maxResultCount: 5,
              locationRestriction: {
                circle: {
                  center: { latitude: lat, longitude: lng },
                  radius: 1600.0,
                },
              },
            }),
          }
        );

        const data = await res.json();
        const places = (data.places || []) as PlaceResult[];

        const meta = CATEGORY_META[type] || { label: type, icon: 'place' };

        categories.push({
          type,
          label: meta.label,
          icon: meta.icon,
          places: places.map((p) => {
            const pLat = p.location?.latitude ?? 0;
            const pLng = p.location?.longitude ?? 0;
            const distance = haversineDistance(lat, lng, pLat, pLng);
            return {
              name: p.displayName?.text ?? 'Unknown',
              address: p.formattedAddress ?? '',
              rating: p.rating ?? null,
              ratingCount: p.userRatingCount ?? null,
              distance: Math.round(distance * 100) / 100,
              lat: pLat,
              lng: pLng,
            };
          }),
        });
      } catch {
        // Skip failed category silently
        const meta = CATEGORY_META[type] || { label: type, icon: 'place' };
        categories.push({
          type,
          label: meta.label,
          icon: meta.icon,
          places: [],
        });
      }
    }

    return NextResponse.json({ categories });
  } catch (error: unknown) {
    console.error('Nearby places error:', error);
    const message = error instanceof Error ? error.message : 'Nearby search failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
