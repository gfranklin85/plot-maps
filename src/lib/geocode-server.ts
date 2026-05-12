import { supabaseAdmin } from './supabase-server';
import { logCost } from './cost-tracker';

// Server-only reverse-geocode helper. Same logic as /api/geocode's
// reverseGeocode() but importable from other server routes (e.g.
// /api/inquiry/send when auto-creating a Lead from a reticle grab).
//
// Uses the Supabase geocode_cache table for both lat/lng-keyed and
// address-keyed entries so forward and reverse lookups share results.
// Costs $0.005 per uncached Google call; logs via cost-tracker.

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

export interface GeocodedResult {
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

export async function reverseGeocodeServer(
  lat: number,
  lng: number,
  userId: string | null,
): Promise<GeocodedResult | null> {
  const key = `latlng:${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = await getCached(key);
  if (cached) return cached;

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
    city,
    state,
    zip,
  };

  setCache(key, geocoded);
  setCache(normalizeAddress(geocoded.formatted_address), geocoded);
  logCost(userId, 'google_geocode', 'reverse_geocode', 0.005, 1);

  return geocoded;
}
