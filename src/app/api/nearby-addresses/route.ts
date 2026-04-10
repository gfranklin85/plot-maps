import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface AddressResult {
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
}

function extractComponents(components: Array<{ types: string[]; long_name: string; short_name: string }>) {
  let city: string | null = null;
  let state: string | null = null;
  let zip: string | null = null;
  let streetNumber: string | null = null;
  let streetName: string | null = null;

  for (const c of components) {
    if (c.types.includes('locality')) city = c.long_name;
    if (c.types.includes('administrative_area_level_1')) state = c.short_name;
    if (c.types.includes('postal_code')) zip = c.long_name;
    if (c.types.includes('street_number')) streetNumber = c.long_name;
    if (c.types.includes('route')) streetName = c.long_name;
  }

  return { city, state, zip, streetNumber, streetName };
}

async function reverseGeocode(lat: number, lng: number): Promise<AddressResult | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=street_address&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== 'OK' || !data.results?.length) return null;

  const result = data.results[0];
  const { city, state, zip, streetName } = extractComponents(result.address_components);

  return {
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    city,
    state,
    zip,
    street: streetName,
  };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate grid points around a center at roughly residential spacing
function generateGrid(centerLat: number, centerLng: number, radiusMiles: number): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  // 1 degree lat ≈ 69 miles. 1 degree lng ≈ 69 * cos(lat) miles
  const latPerMile = 1 / 69;
  const lngPerMile = 1 / (69 * Math.cos(centerLat * Math.PI / 180));

  // Step size: ~0.02 miles (about 100 feet — typical lot width)
  const step = 0.02;
  const steps = Math.ceil(radiusMiles / step);

  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const dLat = i * step * latPerMile;
      const dLng = j * step * lngPerMile;
      const dist = Math.sqrt((i * step) ** 2 + (j * step) ** 2);
      if (dist <= radiusMiles) {
        points.push({ lat: centerLat + dLat, lng: centerLng + dLng });
      }
    }
  }

  return points;
}

// Generate points along a street bearing
function generateStreetPoints(centerLat: number, centerLng: number, count: number): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const latPerMile = 1 / 69;
  const lngPerMile = 1 / (69 * Math.cos(centerLat * Math.PI / 180));
  const lotSpacing = 0.015; // ~80 feet between houses

  // Generate in 4 cardinal directions to find street houses
  for (const angle of [0, 90, 180, 270]) {
    const rad = angle * Math.PI / 180;
    for (let i = 1; i <= Math.ceil(count / 2); i++) {
      const dLat = Math.cos(rad) * i * lotSpacing * latPerMile;
      const dLng = Math.sin(rad) * i * lotSpacing * lngPerMile;
      points.push({ lat: centerLat + dLat, lng: centerLng + dLng });
    }
  }

  return points;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function deduplicate(results: AddressResult[]): AddressResult[] {
  const seen = new Map<string, AddressResult>();
  for (const r of results) {
    // Normalize: use just the street address part (before first comma)
    const key = r.address.split(',')[0].trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, r);
  }
  return Array.from(seen.values());
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { lat, lng, mode = 'nearest', count = 12, radiusMiles = 0.25, referenceStreet } = body;

  if (lat == null || lng == null) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
  }

  let gridPoints: { lat: number; lng: number }[];
  let maxResults = 50; // safety cap

  if (mode === 'street') {
    // Generate points along cardinal directions, filter to same street later
    gridPoints = generateStreetPoints(lat, lng, count || 20);
    maxResults = count || 20;
  } else if (mode === 'radius') {
    // Radius mode: grab all within distance
    const radius = Math.min(radiusMiles, 1); // cap at 1 mile
    gridPoints = generateGrid(lat, lng, radius);
    // Sample grid points — don't reverse geocode thousands
    if (gridPoints.length > 80) {
      // Randomly sample to keep API costs reasonable
      gridPoints.sort(() => Math.random() - 0.5);
      gridPoints = gridPoints.slice(0, 80);
    }
  } else {
    // Nearest mode: generate a tight grid and take closest N
    const radius = 0.15; // ~800 feet — covers a few blocks
    gridPoints = generateGrid(lat, lng, radius);
    if (gridPoints.length > 60) {
      // Sort by distance, take closest
      gridPoints.sort((a, b) =>
        haversine(lat, lng, a.lat, a.lng) - haversine(lat, lng, b.lat, b.lng)
      );
      gridPoints = gridPoints.slice(0, 60);
    }
    maxResults = count || 12;
  }

  // Reverse geocode each grid point
  const results: AddressResult[] = [];

  for (let i = 0; i < gridPoints.length; i++) {
    const result = await reverseGeocode(gridPoints[i].lat, gridPoints[i].lng);
    if (result) results.push(result);

    // Rate limit
    if (i < gridPoints.length - 1) await delay(50);

    // Early exit if we have enough unique results
    const unique = deduplicate(results);
    if (unique.length >= maxResults) break;
  }

  let addresses = deduplicate(results);

  // Remove the reference address itself
  const refKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  addresses = addresses.filter(a => {
    const key = `${a.lat.toFixed(4)},${a.lng.toFixed(4)}`;
    return key !== refKey;
  });

  // Mode-specific filtering
  if (mode === 'street' && referenceStreet) {
    addresses = addresses.filter(a =>
      a.street?.toLowerCase() === referenceStreet.toLowerCase()
    );
  }

  if (mode === 'nearest') {
    // Sort by distance and take top N
    addresses.sort((a, b) =>
      haversine(lat, lng, a.lat, a.lng) - haversine(lat, lng, b.lat, b.lng)
    );
    addresses = addresses.slice(0, count || 12);
  }

  return NextResponse.json({
    addresses,
    count: addresses.length,
    mode,
  });
}
