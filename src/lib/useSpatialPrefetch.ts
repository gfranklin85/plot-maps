"use client";

import { useEffect, useRef } from "react";
import { setCachedParcel, primeGeomCache, cacheSize, type CachedParcel } from "./parcelCache";

// ── useSpatialPrefetch ───────────────────────────────────────────────
//
// THE primary latency win for the Google-native map. Instead of waiting
// for the user to click a property before querying Supabase, this hook
// watches the camera and silently prefetches the parcels in (and a bit
// ahead of) the current view into the in-memory parcelCache. When the
// user clicks, the data is already there — instant card, no spinner.
//
// How it stays cheap:
//   • Polls the <gmp-map-3d> element's camera (center + range) on an
//     interval instead of hooking the tuned per-frame flight loop.
//   • Only fires a fetch when the camera has moved meaningfully AND has
//     gone quiet for a beat (debounce) — no slamming the server mid-pan.
//   • Skips entirely above a zoom/altitude where the viewport query
//     refuses anyway (range too high → too many parcels).
//   • Re-uses the existing /api/parcels/viewport bbox endpoint (one round
//     trip returns full parcel data + geometry for the whole view).
//
// Reads the map element via the same ref the page already forwards
// (map3DElRef). Self-contained: no changes to MapView3D's camera math.
// See [[project-renderer-webgl-locked]] + parcelCache.ts.

type Map3DEl = HTMLElement & {
  center?: { lat: number; lng: number; altitude?: number };
  range?: number;
};

interface Options {
  /** Ref to the <gmp-map-3d> element. */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  /** Disable while in walk mode / when no map. */
  enabled?: boolean;
}

// Tunables.
const POLL_MS = 600;           // how often we sample the camera
const QUIET_MS = 350;          // camera must be still this long before fetch
const MIN_MOVE_DEG = 0.004;    // ~400m — ignore tiny jitters
const MAX_RANGE_M = 4000;      // above this we're too high; viewport refuses
// Convert camera range to an approximate viewport half-width in degrees.
// Rough: 1 deg lat ≈ 111km. We bias the box toward the camera's facing by
// expanding it slightly; cheap heuristic, good enough for prefetch.
const DEG_PER_M = 1 / 111_000;

export function useSpatialPrefetch({ mapElRef, enabled = true }: Options) {
  const lastFetchKeyRef = useRef<string>("");
  const lastPos = useRef<{ lat: number; lng: number } | null>(null);
  const stillSinceRef = useRef<number>(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const sample = () => {
      const el = mapElRef.current as Map3DEl | null;
      const center = el?.center;
      const range = el?.range ?? 0;
      if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
      if (range > MAX_RANGE_M || range <= 0) return; // too high to prefetch usefully

      const now = performance.now();
      const prev = lastPos.current;
      const moved =
        !prev ||
        Math.abs(center.lat - prev.lat) > MIN_MOVE_DEG ||
        Math.abs(center.lng - prev.lng) > MIN_MOVE_DEG;

      if (moved) {
        // Camera is moving — reset the "quiet" timer, don't fetch yet.
        lastPos.current = { lat: center.lat, lng: center.lng };
        stillSinceRef.current = now;
        return;
      }

      // Camera has been roughly still — has it been quiet long enough?
      if (now - stillSinceRef.current < QUIET_MS) return;
      if (inFlightRef.current) return;

      // Build a bbox around the camera center sized to the view, padded
      // ~1.5× so we grab a margin ahead/around the user.
      const halfDeg = Math.max(0.002, range * DEG_PER_M * 1.5);
      const minLng = center.lng - halfDeg;
      const maxLng = center.lng + halfDeg;
      const minLat = center.lat - halfDeg;
      const maxLat = center.lat + halfDeg;

      // Dedup: skip if this is the same box we just fetched.
      const key = `${minLng.toFixed(3)},${minLat.toFixed(3)},${maxLng.toFixed(3)},${maxLat.toFixed(3)}`;
      if (key === lastFetchKeyRef.current) return;
      lastFetchKeyRef.current = key;

      // Estimate a zoom from range so the viewport endpoint doesn't refuse
      // (it gates below zoom 14). Closer range → higher zoom. This is a
      // coarse mapping; the endpoint only uses it as a floor check.
      const zoom = range < 800 ? 18 : range < 1800 ? 16 : 15;

      inFlightRef.current = true;
      const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;
      fetch(`/api/parcels/viewport?bbox=${bbox}&zoom=${zoom}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data?.features) return;
          const at = Date.now();
          for (const f of data.features as Array<{
            geometry: unknown;
            properties: Record<string, unknown>;
          }>) {
            const p = f.properties || {};
            const apn = p.apn as string | null;
            if (!apn) continue;
            const entry: CachedParcel = {
              apn,
              geometry: f.geometry,
              address: (p.address as string) ?? null,
              city: (p.city as string) ?? null,
              propertyType: (p.propertyType as string) ?? null,
              yearBuilt: (p.yearBuilt as number) ?? null,
              buildingSqft: (p.buildingSqft as number) ?? null,
              bedrooms: (p.bedrooms as number) ?? null,
              bathrooms: (p.bathrooms as number) ?? null,
              assesseeName: (p.assesseeName as string) ?? null,
              netValue: (p.netValue as number) ?? null,
              cachedAt: at,
            };
            setCachedParcel(entry);
            primeGeomCache(apn, f.geometry); // so PlotPropertyHighlight is instant too
          }
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug(`[prefetch] cached ${data.features.length} parcels (total ${cacheSize()})`);
          }
        })
        .catch(() => { /* silent — prefetch is best-effort */ })
        .finally(() => { inFlightRef.current = false; });
    };

    const id = window.setInterval(sample, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, mapElRef]);
}
