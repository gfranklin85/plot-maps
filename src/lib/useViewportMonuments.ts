"use client";

// useViewportMonuments — keeps a list of every parcel's monument anchor
// in the current camera viewport. Polls /api/parcels/monuments whenever
// the map center moves more than a threshold distance (debounced).
//
// The hook is centered on a single point (mapCenter) with a radius in
// degrees rather than reading the actual map bbox, because the 3D map's
// camera bbox is messy (heading + tilt skew). A simple radius around
// the center gives us "monuments near where the camera is looking" with
// no math jank. ~0.015 deg = ~1.6 km radius — covers everything visible
// at typical flight altitudes without overshooting.

import { useEffect, useRef, useState } from 'react';

export interface MonumentAnchor {
  apn: string;
  lat: number;
  lng: number;
}

const RADIUS_DEG = 0.015;
// Re-fetch if the center moved more than this since the last fetch.
const REFETCH_THRESHOLD_DEG = 0.005;
// Don't fire fetches faster than this.
const DEBOUNCE_MS = 350;

export function useViewportMonuments(
  center: { lat: number; lng: number } | null,
): MonumentAnchor[] {
  const [monuments, setMonuments] = useState<MonumentAnchor[]>([]);
  const lastFetchedCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!center) return;
    const last = lastFetchedCenterRef.current;
    if (last) {
      const dLat = Math.abs(center.lat - last.lat);
      const dLng = Math.abs(center.lng - last.lng);
      if (dLat < REFETCH_THRESHOLD_DEG && dLng < REFETCH_THRESHOLD_DEG) {
        return;  // close enough; don't re-fetch
      }
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      const minLat = center.lat - RADIUS_DEG;
      const maxLat = center.lat + RADIUS_DEG;
      const minLng = center.lng - RADIUS_DEG;
      const maxLng = center.lng + RADIUS_DEG;

      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;

      fetch(
        `/api/parcels/monuments?minLat=${minLat}&minLng=${minLng}&maxLat=${maxLat}&maxLng=${maxLng}`,
        { signal: ac.signal },
      )
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data || !Array.isArray(data.monuments)) return;
          lastFetchedCenterRef.current = { lat: center.lat, lng: center.lng };
          setMonuments(data.monuments as MonumentAnchor[]);
        })
        .catch(err => {
          if ((err as Error).name !== 'AbortError') {
            console.warn('[useViewportMonuments] fetch failed', err);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [center]);

  // Cleanup outstanding fetch on unmount
  useEffect(() => {
    return () => { acRef.current?.abort(); };
  }, []);

  return monuments;
}
