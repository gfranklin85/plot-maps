import { NextResponse } from 'next/server';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY!;

interface GeocodedResult {
  formatted_address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
}

function extractAddressComponents(components: Array<{ types: string[]; long_name: string; short_name: string }>) {
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;

  for (const component of components) {
    if (component.types.includes('locality')) {
      city = component.long_name;
    }
    if (component.types.includes('administrative_area_level_1')) {
      state = component.short_name;
    }
    if (component.types.includes('postal_code')) {
      zip = component.long_name;
    }
  }

  return { city, state, zip };
}

async function geocodeAddress(address: string): Promise<GeocodedResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) {
    return null;
  }

  const result = data.results[0];
  const { city, state, zip } = extractAddressComponents(result.address_components);

  return {
    formatted_address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    city,
    state,
    zip,
  };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, addresses } = body;

    if (!address && !addresses) {
      return NextResponse.json(
        { error: 'address or addresses is required' },
        { status: 400 }
      );
    }

    // Single address mode
    if (address) {
      const result = await geocodeAddress(address);
      if (!result) {
        return NextResponse.json({ error: 'Could not geocode address' }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    // Batch mode
    const results: Array<{ address: string; lat: number | null; lng: number | null; city: string | null; state: string | null; zip: string | null }> = [];

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const result = await geocodeAddress(addr);
      results.push({
        address: addr,
        lat: result?.lat ?? null,
        lng: result?.lng ?? null,
        city: result?.city ?? null,
        state: result?.state ?? null,
        zip: result?.zip ?? null,
      });

      // Rate limit: 100ms delay between requests
      if (i < addresses.length - 1) {
        await delay(100);
      }
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error('Geocode error:', error);
    const message = error instanceof Error ? error.message : 'Geocoding failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
