// Destination catalog for the landing carousel.
//
// Each destination is a place a casual flyer might want to drop into.
// Initial set (2026-05-24) is six placeholders — when Greg builds real
// hero card art in Affinity, the imageSrc paths populate. Until then
// the card renders a typographic placeholder that reads as deliberately
// in-progress rather than broken.
//
// Adding new destinations is additive: drop a new entry here and a
// matching hero image at the configured path. No code change required
// in the carousel components.

export interface Destination {
  /** URL-friendly slug used for /map?destination=<slug> routing. */
  slug: string;
  /** Display name shown on the card. */
  name: string;
  /** Italic one-liner shown under the name. */
  tagline: string;

  // ── Camera pose ────────────────────────────────────────────────────
  // The destination card image is a screenshot taken from inside Plot
  // at a specific authored framing. When the visitor picks the card,
  // the camera arrives at this exact pose so the live world resolves
  // into the same shot they saw on the card. The transition becomes a
  // match-cut zoom-through: the card image expands and crossfades into
  // the live 3D render at identical framing, no perceived seam.
  //
  // To author a destination:
  //   1. Fly Plot to the location
  //   2. Compose the shot — find the framing that makes the place
  //      instantly recognizable AND looks beautiful in motion
  //   3. Record the camera pose (the in-app dev panel exposes these)
  //   4. Screenshot at 16:9 high-res for the card image
  //   5. Drop the screenshot at public/assets/landing/destinations/<slug>.jpg
  //   6. Fill in the fields below

  /** Camera lat/lng — eye position, NOT focal point. */
  lat: number;
  lng: number;
  /** Eye altitude in meters above ground. */
  altitudeMeters: number;
  /** Compass heading of look direction in degrees (0=N, 90=E, 180=S, 270=W). */
  heading: number;
  /** View pitch in degrees. 0 = horizon-level, -45 = looking 45° down,
   *  +5 = slightly above horizon. */
  pitch: number;
  /** Virtual focal range in meters. Used by Map3D's orbit math; kept
   *  fixed across pose changes to prevent range explosion on small
   *  pitch deltas. Typical: 600-1500. */
  range: number;

  /** Public path to the hero image (the in-app screenshot taken at the
   *  pose above). When absent, the card renders a typographic
   *  placeholder so the layout reads as intentional in-progress
   *  rather than broken. */
  imageSrc?: string;
}

// Default camera pose values are placeholders — sensible aerial framings
// until Greg flies each destination and authors the real cinematic shot.
// When the real screenshot lands, update lat/lng/altitude/heading/pitch/
// range to match the exact pose the screenshot was captured at.
export const DESTINATIONS: Destination[] = [
  {
    slug: 'lemoore',
    name: 'Lemoore',
    tagline: 'Where the field manual begins.',
    lat: 36.3008,
    lng: -119.7829,
    altitudeMeters: 800,
    heading: 0,
    pitch: -45,
    range: 1200,
  },
  {
    slug: 'acapulco',
    name: 'Acapulco',
    tagline: 'Cliffs, divers, Pacific gold.',
    lat: 16.8531,
    lng: -99.8237,
    altitudeMeters: 600,
    heading: 270,
    pitch: -25,
    range: 1500,
  },
  {
    slug: 'new-york',
    name: 'New York',
    tagline: 'The grid that never sleeps.',
    lat: 40.7549,
    lng: -73.984,
    altitudeMeters: 900,
    heading: 0,
    pitch: -30,
    range: 1500,
  },
  {
    slug: 'tokyo',
    name: 'Tokyo',
    tagline: 'Neon, rain, and quiet temples.',
    lat: 35.6595,
    lng: 139.7005,
    altitudeMeters: 700,
    heading: 45,
    pitch: -30,
    range: 1500,
  },
  {
    slug: 'paris',
    name: 'Paris',
    tagline: 'Boulevards laid by a king.',
    lat: 48.8584,
    lng: 2.2945,
    altitudeMeters: 500,
    heading: 60,
    pitch: -20,
    range: 1200,
  },
  {
    slug: 'dubai',
    name: 'Dubai',
    tagline: 'A city written on sand.',
    lat: 25.1972,
    lng: 55.2744,
    altitudeMeters: 700,
    heading: 90,
    pitch: -25,
    range: 1500,
  },
];
