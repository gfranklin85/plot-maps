// useInitialMapCenter — compute the map's first-frame center from URL
// parameters, falling back to the user's profile default.
//
// Used by /map/page.tsx as the useState initializer for the map's
// camera center. Reading the URL at render time (rather than in
// useEffect) means the map mounts already framed on the requested
// destination — no flash of the profile default before the camera
// flies over.
//
// Resolution priority:
//   1. Explicit ?lat=&lng= params — direct camera coordinates
//   2. ?destination=<slug> — looked up in the shared destinations
//      catalog and resolved to that destination's full camera pose
//   3. profile.defaultMapCenter — the visitor's saved home

import { useSearchParams } from 'next/navigation';
import { DESTINATIONS, type Destination } from './destinations';

export function useInitialMapCenter(
  fallback: { lat: number; lng: number } | null
): { lat: number; lng: number } | null {
  const searchParams = useSearchParams();
  if (!searchParams) return fallback;

  // Priority 1: explicit lat/lng in URL.
  const latStr = searchParams.get('lat');
  const lngStr = searchParams.get('lng');
  const lat = latStr ? parseFloat(latStr) : NaN;
  const lng = lngStr ? parseFloat(lngStr) : NaN;
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    return { lat, lng };
  }

  // Priority 2: destination slug resolved against the catalog.
  const destinationParam = searchParams.get('destination');
  if (destinationParam) {
    const match = DESTINATIONS.find(d => d.slug === destinationParam);
    if (match) {
      return { lat: match.lat, lng: match.lng };
    }
  }

  // Priority 3: profile fallback.
  return fallback;
}

// Resolve a full destination pose (altitude, heading, pitch, range)
// from the URL's ?destination=<slug> param. Returns null when the
// slug doesn't match a known destination. Called by /map/page.tsx
// alongside useInitialMapCenter — the first sets the camera position,
// the second sets the full first-person pose for the cinematic
// match-cut arrival.
export function useInitialDestinationPose(): Destination | null {
  const searchParams = useSearchParams();
  if (!searchParams) return null;
  const destinationParam = searchParams.get('destination');
  if (!destinationParam) return null;
  return DESTINATIONS.find(d => d.slug === destinationParam) ?? null;
}
