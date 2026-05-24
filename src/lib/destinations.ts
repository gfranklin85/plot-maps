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
  /** Lat/lng for the camera target when the user picks this card. */
  lat: number;
  lng: number;
  /** Optional altitude / camera framing override. Sensible default if absent. */
  altitudeMeters?: number;
  /** Public path to the hero image. When absent, the card renders the
   *  typographic placeholder so the layout reads as intentional. */
  imageSrc?: string;
}

export const DESTINATIONS: Destination[] = [
  {
    slug: 'lemoore',
    name: 'Lemoore',
    tagline: 'Where the field manual begins.',
    lat: 36.3008,
    lng: -119.7829,
  },
  {
    slug: 'acapulco',
    name: 'Acapulco',
    tagline: 'Cliffs, divers, Pacific gold.',
    lat: 16.8531,
    lng: -99.8237,
  },
  {
    slug: 'new-york',
    name: 'New York',
    tagline: 'The grid that never sleeps.',
    lat: 40.7549,
    lng: -73.984,
  },
  {
    slug: 'tokyo',
    name: 'Tokyo',
    tagline: 'Neon, rain, and quiet temples.',
    lat: 35.6595,
    lng: 139.7005,
  },
  {
    slug: 'paris',
    name: 'Paris',
    tagline: 'Boulevards laid by a king.',
    lat: 48.8584,
    lng: 2.2945,
  },
  {
    slug: 'dubai',
    name: 'Dubai',
    tagline: 'A city written on sand.',
    lat: 25.1972,
    lng: 55.2744,
  },
];
