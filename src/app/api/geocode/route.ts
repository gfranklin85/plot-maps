import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-server';
import { logCost } from '@/lib/cost-tracker';

// Prefer the server-only key. The NEXT_PUBLIC_* key is restricted to
// browser referrers and will be denied on server-side fetches.
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

interface GeocodedResult {
  formatted_address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
}

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/[.,#]/g, '').replace(/\s+/g, ' ');
}

function extractAddressComponents(components: Array<{ types: string[]; long_name: string; short_name: string }>) {
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;

  for (const component of components) {
    if (component.types.includes('locality')) city = component.long_name;
    if (component.types.includes('administrative_area_level_1')) state = component.short_name;
    if (component.types.includes('postal_code')) zip = component.long_name;
  }

  return { city, state, zip };
}

// Check cache before hitting Google
async function getCached(key: string): Promise<GeocodedResult | null> {
  const { data } = await supabaseAdmin
    .from('geocode_cache')
    .select('formatted_address, lat, lng, city, state, zip')
    .eq('address_key', key)
    .single();
  if (!data) return null;
  return {
    formatted_address: data.formatted_address,
    lat: data.lat,
    lng: data.lng,
    city: data.city,
    state: data.state,
    zip: data.zip,
  };
}

// Store result in cache (fire-and-forget)
function setCache(key: string, result: GeocodedResult) {
  supabaseAdmin.from('geocode_cache').upsert({
    address_key: key,
    formatted_address: result.formatted_address,
    lat: result.lat,
    lng: result.lng,
    city: result.city,
    state: result.state,
    zip: result.zip,
  }, { onConflict: 'address_key' }).then(({ error }) => {
    if (error) console.error('Geocode cache write error:', error);
  });
}

async function geocodeAddress(address: string, userId: string | null): Promise<GeocodedResult | null> {
  // Check cache first
  const key = normalizeAddress(address);
  const cached = await getCached(key);
  if (cached) return cached;

  // Cache miss — call Google
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) return null;

  const result = data.results[0];
  const { city, state, zip } = extractAddressComponents(result.address_components);

  const geocoded: GeocodedResult = {
    formatted_address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    city, state, zip,
  };

  // Store in cache + log cost
  setCache(key, geocoded);
  logCost(userId, 'google_geocode', 'forward_geocode', 0.005, 1);

  return geocoded;
}

async function reverseGeocode(lat: number, lng: number, userId: string | null): Promise<GeocodedResult | null> {
  // Check cache — round to 5 decimal places (~1m precision)
  const key = `latlng:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = await getCached(key);
  if (cached) return cached;

  // Cache miss — call Google
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=street_address&key=${GOOGLE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 'OK' || !data.results?.length) return null;

  const result = data.results[0];
  const { city, state, zip } = extractAddressComponents(result.address_components);

  const geocoded: GeocodedResult = {
    formatted_address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    city, state, zip,
  };

  // Store in cache (both by latlng key AND by address key for forward lookups)
  setCache(key, geocoded);
  setCache(normalizeAddress(geocoded.formatted_address), geocoded);
  logCost(userId, 'google_geocode', 'reverse_geocode', 0.005, 1);

  return geocoded;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { address, addresses, latlng, latlngs } = body;

    // Reverse geocode: single
    if (latlng) {
      const result = await reverseGeocode(latlng.lat, latlng.lng, user.id);
      if (!result) return NextResponse.json({ error: 'No address found at location' }, { status: 404 });
      return NextResponse.json(result);
    }

    // Reverse geocode: batch
    if (latlngs && Array.isArray(latlngs)) {
      const results: (GeocodedResult | null)[] = [];
      for (let i = 0; i < latlngs.length; i++) {
        const result = await reverseGeocode(latlngs[i].lat, latlngs[i].lng, user.id);
        results.push(result);
        if (i < latlngs.length - 1) await delay(50);
      }
      return NextResponse.json({ results: results.filter(Boolean) });
    }

    if (!address && !addresses) {
      return NextResponse.json(
        { error: 'address, addresses, latlng, or latlngs is required' },
        { status: 400 }
      );
    }

    // Single address mode
    if (address) {
      const result = await geocodeAddress(address, user.id);
      if (!result) {
        return NextResponse.json({ error: 'Could not geocode address' }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    // Batch mode
    const results: Array<{ address: string; lat: number | null; lng: number | null; city: string | null; state: string | null; zip: string | null }> = [];

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const result = await geocodeAddress(addr, user.id);
      results.push({
        address: addr,
        lat: result?.lat ?? null,
        lng: result?.lng ?? null,
        city: result?.city ?? null,
        state: result?.state ?? null,
        zip: result?.zip ?? null,
      });

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
