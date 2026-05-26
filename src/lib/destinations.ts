// Plot's unified destination catalog.
//
// One canonical record per place. Read by every "fly to X" surface:
//   - Landing globe pins + carousel cards (CesiumGlobe, DestinationCarousel,
//     DestinationAtlas) — uses the landing-facing fields (name, tagline,
//     imageSrc) and the camera pose to position the pin and frame the
//     match-cut shot.
//   - In-map destinations panel (DestinationsPanel) — uses the panel-
//     facing fields (name, region) and the camera pose to fly the
//     camera when the user clicks a card from inside the map.
//   - Arrival sequence (ArrivalSequence → /map?destination=<slug>) —
//     resolves the slug to its pose so the live map camera arrives at
//     the same shot the user saw on the landing card.
//
// Each surface decides which destinations it wants to expose via the
// `surfaces` array (e.g. ['landing', 'panel']). The pose itself is
// universal: the same hand-tuned framing the user sees on the landing
// card is the same framing they fly to when they pick the card from
// the in-map panel.
//
// Adding a new destination:
//   1. Fly Plot to the location and find the shot
//   2. Record lat/lng/altitude/heading/pitch/range from the dev panel
//   3. Drop a screenshot at public/assets/landing/destinations/<slug>.jpg
//      (only needed for landing-surface destinations)
//   4. Add a row below
//
// Pose tuning rules (so airplane mode never starts underground):
//   - altitude is METERS ABOVE GROUND. For coastal/low-rise cities,
//     300-500m. For tall cities (Dubai, Manhattan), 450-800m. Never
//     below 250m — pulling up has to give sky room.
//   - pitch is degrees. 0 = horizon, negative = looking down. Stay
//     between -10 and -20 for cinematic arrival; -25 starts to feel
//     like satellite, and steeper than that puts the focal point
//     close to the camera and risks "underground" framing if the
//     terrain tile elevates after load.
//   - range is the orbital focal-point distance in meters. 900-1500
//     is the cinematic band; smaller = tighter framing, larger =
//     wider.

export type DestinationSurface = 'landing' | 'panel';

export interface DestinationPose {
  /** Camera lat/lng — eye position, NOT focal point. */
  lat: number;
  lng: number;
  /** Eye altitude in meters above ground. */
  altitude: number;
  /** Compass heading of look direction in degrees (0=N, 90=E, 180=S, 270=W). */
  heading: number;
  /** View pitch in degrees. 0=horizon, negative=looking down. */
  pitch: number;
  /** Virtual focal range in meters. Typical 900-1500. */
  range: number;
}

export interface Destination {
  /** URL-friendly slug. Used by /map?destination=<slug>. */
  slug: string;
  /** Display name. */
  name: string;
  /** Short country/region descriptor (under the name in panel cards). */
  region: string;
  /** Italic one-liner shown on landing cards. Optional. */
  tagline?: string;
  /** Surfaces that expose this destination. Most appear on both. */
  surfaces: DestinationSurface[];
  /** Hand-tuned cinematic arrival pose. Same shot the landing card was
   *  screenshotted at; the in-map panel also flies the camera here. */
  pose: DestinationPose;
  /** Public path to the landing card hero image (in-app screenshot
   *  captured at `pose`). Optional — when absent the card renders a
   *  typographic placeholder. */
  imageSrc?: string;
}

// ─────────────────────────────────────────────────────────────────────
// The catalog. Poses are hand-tuned for cinematic arrival framing —
// the camera is positioned to frame the city's most-recognizable
// angle, with enough altitude and shallow-enough pitch that the
// arrival lands in flyable airspace, not underground.
// ─────────────────────────────────────────────────────────────────────

export const DESTINATIONS: Destination[] = [
  {
    slug: 'lemoore',
    name: 'Lemoore',
    region: 'California',
    tagline: 'Where the field manual begins.',
    surfaces: ['landing'],
    pose: {
      lat: 36.3008, lng: -119.7829,
      altitude: 800, heading: 0,
      pitch: -18, range: 1200,
    },
  },
  {
    slug: 'acapulco',
    name: 'Acapulco',
    region: 'Mexico',
    tagline: 'Cliffs, divers, Pacific gold.',
    surfaces: ['landing', 'panel'],
    pose: {
      // Out over the bay, looking back at the amphitheater of hotels.
      lat: 16.8400, lng: -99.9050,
      altitude: 400, heading: 30,
      pitch: -14, range: 1300,
    },
    imageSrc: '/assets/landing/destinations/acapulco.png',
  },
  {
    slug: 'new-york',
    name: 'Manhattan',
    region: 'New York',
    tagline: 'The grid that never sleeps.',
    surfaces: ['landing', 'panel'],
    pose: {
      // Midtown, eye above 7th Ave, looking south-southwest down the avenues.
      lat: 40.7549, lng: -73.9840,
      altitude: 450, heading: 200,
      pitch: -18, range: 1200,
    },
  },
  {
    slug: 'tokyo',
    name: 'Tokyo',
    region: 'Japan',
    tagline: 'Neon, rain, and quiet temples.',
    surfaces: ['landing', 'panel'],
    pose: {
      // Shinjuku looking toward Shibuya / Tokyo Tower.
      lat: 35.6720, lng: 139.7400,
      altitude: 500, heading: 160,
      pitch: -18, range: 1400,
    },
  },
  {
    slug: 'paris',
    name: 'Paris',
    region: 'France',
    tagline: 'Boulevards laid by a king.',
    surfaces: ['landing', 'panel'],
    pose: {
      // Trocadéro side, looking southeast at the Eiffel Tower.
      lat: 48.8620, lng: 2.2900,
      altitude: 280, heading: 130,
      pitch: -12, range: 900,
    },
  },
  {
    slug: 'dubai',
    name: 'Dubai',
    region: 'United Arab Emirates',
    tagline: 'A city written on sand.',
    surfaces: ['landing', 'panel'],
    pose: {
      // East of Burj Khalifa, looking west at the Burj + skyline.
      lat: 25.1900, lng: 55.2750,
      altitude: 700, heading: 270,
      pitch: -10, range: 1500,
    },
  },
  {
    slug: 'san-francisco',
    name: 'San Francisco',
    region: 'California',
    surfaces: ['panel'],
    pose: {
      // North waterfront, looking back at the city.
      lat: 37.8030, lng: -122.4180,
      altitude: 350, heading: 165,
      pitch: -15, range: 1500,
    },
  },
  {
    slug: 'las-vegas',
    name: 'Las Vegas',
    region: 'Nevada',
    tagline: 'A grid in the desert that never sleeps.',
    surfaces: ['landing', 'panel'],
    pose: {
      // Greg's hand-tuned framing: looking south-southwest down the
      // strip toward Mandalay Bay + Luxor pyramid at sunset. Captured
      // from /map dev-readout (focal point at 36.0981, -115.1777,
      // tilt 76.31, heading 208.06). Arrival altitude held at 900m so
      // visitor starts in the sky over the strip.
      lat: 36.0981, lng: -115.1777,
      altitude: 900, heading: 208.06,
      pitch: -14, range: 1800,
    },
    imageSrc: '/assets/landing/destinations/las-vegas.png',
  },
  {
    slug: 'los-angeles',
    name: 'Los Angeles',
    region: 'California',
    surfaces: ['panel'],
    pose: {
      // Downtown LA, eye east of the cluster.
      lat: 34.0400, lng: -118.2600,
      altitude: 400, heading: 250,
      pitch: -18, range: 1300,
    },
  },
  {
    slug: 'london',
    name: 'London',
    region: 'United Kingdom',
    surfaces: ['panel'],
    pose: {
      // Along the Thames, eye south of the river. Looking northwest at
      // Parliament + the Eye.
      lat: 51.5050, lng: -0.0950,
      altitude: 350, heading: 320,
      pitch: -14, range: 1200,
    },
  },
  {
    slug: 'sydney',
    name: 'Sydney',
    region: 'Australia',
    tagline: 'Harbour, opera, sandstone city.',
    surfaces: ['landing', 'panel'],
    pose: {
      // Greg's hand-tuned framing: camera over the harbour looking
      // southwest at the Opera House + CBD skyline. Captured from
      // /map dev-readout (focal point at -33.8597, 151.2132, tilt 72,
      // heading -139.29). Arrival altitude lifted from the focal-point
      // height to 900m so visitor starts in the sky.
      lat: -33.8597, lng: 151.2132,
      altitude: 900, heading: 220.71,
      pitch: -18, range: 1800,
    },
    imageSrc: '/assets/landing/destinations/sydney.png',
  },
];

// Default arrival pose for ad-hoc "fly anywhere" destinations (search
// results, free-text input). Cruise altitude, shallow pitch, looking
// north — generic but always flyable.
export const DEFAULT_ARRIVAL_POSE: DestinationPose = {
  lat: 0, lng: 0,                // overwritten with the actual target
  altitude: 400,
  heading: 0,
  pitch: -18,
  range: 1100,
};

// ─────────────────────────────────────────────────────────────────────
// Filtered views — each surface picks the rows that apply.
// ─────────────────────────────────────────────────────────────────────

/** Destinations visible on the landing globe + carousel. */
export const LANDING_DESTINATIONS: Destination[] = DESTINATIONS.filter(d =>
  d.surfaces.includes('landing')
);

/** Destinations visible in the in-map "Fly somewhere" panel. */
export const PANEL_DESTINATIONS: Destination[] = DESTINATIONS.filter(d =>
  d.surfaces.includes('panel')
);

/** Look up a destination by slug. Returns null when not found. */
export function findDestinationBySlug(slug: string): Destination | null {
  return DESTINATIONS.find(d => d.slug === slug) ?? null;
}
