// /api/mock-listings — serves the hand-curated mock listing JSON
// for the June 9 KCBOR MLS committee demo.
//
// Locked 2026-05-30. Lives in JSON (src/data/mock-listings.json) rather
// than Supabase so:
//   - No DB pollution while the real MLS feed is pending
//   - Easy to edit and review in git
//   - One-line removal once the IDX feed flows June 18+
//
// Public route — no auth required. The committee will be browsing
// without logging in.
//
// Each listing carries:
//   - real Kings County lat/lng so PropertyPopup's /api/parcel resolver
//     can layer real assessor data (beds/baths/sqft/year/lot/APN) on
//     top of the listing-layer (photo / price / status / agent)
//   - listing_photo_urls[] for the carousel
//   - status: Active / Pending / Sold (60/25/15 split)
//   - Position Realty as listing brokerage (Greg's brokerage entity)

import { NextResponse } from 'next/server';
import mockListings from '@/data/mock-listings.json';
import type { Lead } from '@/types';

export const dynamic = 'force-static';

export async function GET() {
  // The JSON shape mirrors the Lead type's relevant subset. Cast through
  // unknown since the JSON is partial (omits the dozens of fields that
  // would be null anyway) — the resolver + popup handle missing fields.
  const listings = mockListings as unknown as Lead[];
  return NextResponse.json({ listings });
}
