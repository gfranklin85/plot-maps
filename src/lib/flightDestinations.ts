'use client';

// ── Curated flight destinations ─────────────────────────────────────
//
// Plot-authored "fly here" presets. Each has a hand-tuned arrival
// pose (lat/lng/altitude/heading/pitch) so the cinematic landing
// frames the city's most-recognizable angle — Manhattan looking
// south down the avenues, the Eiffel Tower from the Trocadéro side,
// the Las Vegas strip looking down its length, etc.
//
// The list starts with 9 cities I'm confident have high-quality
// Google Photorealistic 3D Tiles coverage based on Google's own
// demo content + public Cesium showcases. Greg validates each by
// flying it post-deploy; demote anything that looks bad, add cities
// from the verify list as we confirm them.
//
// Arrival altitudes are tuned for "iconic skyline framing" — high
// enough to see the city's silhouette, low enough to feel like
// you're *there*, not satellite-viewing. Most sit between 300m and
// 800m altitude depending on the city's vertical scale (Dubai is
// higher because of Burj Khalifa; Sydney lower to get the Harbour
// Bridge + Opera House in frame).

export interface FlightDestination {
  id: string;
  /** Display name shown on the card. */
  name: string;
  /** Short country/region descriptor under the name. */
  region: string;
  /** Camera eye position for the cinematic arrival. */
  lat: number;
  lng: number;
  altitude: number;        // meters
  heading: number;         // compass bearing (0 = north)
  pitch: number;           // -25 = looking slightly down (default cruise)
  /** Map3DElement focal range (meters from eye to focal point). */
  range: number;
}

export const CURATED_DESTINATIONS: FlightDestination[] = [
  {
    id: 'manhattan',
    name: 'Manhattan',
    region: 'New York',
    lat: 40.7549, lng: -73.9840,         // midtown, eye above 7th Ave
    altitude: 450, heading: 200,          // looking south-southwest down the avenues
    pitch: -18, range: 1200,
  },
  {
    id: 'san_francisco',
    name: 'San Francisco',
    region: 'California',
    lat: 37.8030, lng: -122.4180,         // north waterfront, looking back at the city
    altitude: 350, heading: 165,
    pitch: -15, range: 1500,
  },
  {
    id: 'las_vegas',
    name: 'Las Vegas',
    region: 'Nevada',
    lat: 36.1100, lng: -115.1730,         // north end of the strip
    altitude: 400, heading: 200,          // looking south down the strip
    pitch: -16, range: 1500,
  },
  {
    id: 'los_angeles',
    name: 'Los Angeles',
    region: 'California',
    lat: 34.0400, lng: -118.2600,         // downtown LA, eye east of the cluster
    altitude: 400, heading: 250,
    pitch: -18, range: 1300,
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    region: 'Japan',
    lat: 35.6720, lng: 139.7400,          // shinjuku looking toward shibuya/tokyo tower
    altitude: 500, heading: 160,
    pitch: -18, range: 1400,
  },
  {
    id: 'london',
    name: 'London',
    region: 'United Kingdom',
    lat: 51.5050, lng: -0.0950,           // along the thames, eye south of the river
    altitude: 350, heading: 320,          // looking northwest at parliament + the eye
    pitch: -14, range: 1200,
  },
  {
    id: 'paris',
    name: 'Paris',
    region: 'France',
    lat: 48.8620, lng: 2.2900,            // trocadéro side
    altitude: 280, heading: 130,          // looking southeast at the eiffel tower
    pitch: -12, range: 900,
  },
  {
    id: 'sydney',
    name: 'Sydney',
    region: 'Australia',
    lat: -33.8540, lng: 151.2200,         // north shore looking south at the harbour
    altitude: 320, heading: 195,
    pitch: -16, range: 1100,
  },
  {
    id: 'dubai',
    name: 'Dubai',
    region: 'United Arab Emirates',
    lat: 25.1900, lng: 55.2750,           // east of burj khalifa
    altitude: 700, heading: 270,          // looking west at the burj + skyline
    pitch: -10, range: 1500,
  },
];

// Default arrival pose used for search-result destinations (no
// hand-tuned shot available). Friendly cruise altitude looking
// slightly down to the north.
export const DEFAULT_ARRIVAL_POSE: Omit<FlightDestination, 'id' | 'name' | 'region' | 'lat' | 'lng'> = {
  altitude: 300,
  heading: 0,
  pitch: -25,
  range: 700,
};
