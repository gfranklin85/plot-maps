// Public Place Details — resolves a place_id from the autocomplete
// suggestions to lat/lng + formatted address. Pairs with
// /api/public/places-autocomplete to complete the search flow on the
// landing page.
//
// Why a separate endpoint:
//   The autocomplete REST API returns place_ids only. The user picks
//   one, and we need coords + a clean display name to route the map
//   page. Place Details returns both with one cheap call.
//
// Hardening: same model as the other public routes — per-IP rate limit,
// bounded inputs, server-side key, minimal response.

import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_API_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

const BUCKETS = new Map<string, { tokens: number; refillAt: number }>();
const MAX_TOKENS = 60;
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

export async function GET(req: NextRequest) {
  if (!GOOGLE_API_KEY) {
    return NextResponse.json(
      { hit: false, error: 'Place details not configured' },
      { status: 503 }
    );
  }

  const placeId = (req.nextUrl.searchParams.get('placeId') || '').trim();
  if (!placeId) {
    return NextResponse.json({ hit: false, error: 'Missing placeId' }, { status: 400 });
  }
  if (placeId.length > 300) {
    return NextResponse.json({ hit: false, error: 'Invalid placeId' }, { status: 400 });
  }

  const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() || 'unknown';
  if (!takeToken(ip)) {
    return NextResponse.json({ hit: false, error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    // Places API (New) — fields list goes in X-Goog-FieldMask header.
    // We ask only for what the map needs to fly: coords + display name.
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'id,location,formattedAddress,displayName',
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) {
      return NextResponse.json(
        { hit: false, error: 'Place details upstream error' },
        { status: 502 }
      );
    }
    const data = await res.json();
    if (!data?.location?.latitude || !data?.location?.longitude) {
      return NextResponse.json({ hit: false, formatted: null, lat: null, lng: null });
    }
    return NextResponse.json({
      hit: true,
      formatted: data.formattedAddress ?? data.displayName?.text ?? '',
      lat: data.location.latitude,
      lng: data.location.longitude,
    });
  } catch {
    return NextResponse.json(
      { hit: false, error: 'Place details network error' },
      { status: 502 }
    );
  }
}
