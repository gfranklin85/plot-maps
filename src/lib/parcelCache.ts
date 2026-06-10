// ── In-memory parcel cache ───────────────────────────────────────────
//
// The latency win that doesn't require Firebase or any new backend: an
// on-device key-value store of parcel data, keyed by APN. The prefetch
// hook fills it ahead of the camera; click handlers read from it
// instantly (0ms, no spinner, no round trip). Pan back to a parcel you
// already flew over → it's already here.
//
// Allowed by Google's terms: this caches YOUR real-estate data (from
// Supabase/PostGIS), NOT Google's map tiles (which Google's component
// caches itself via browser cache headers). See
// [[project-renderer-webgl-locked]] (final: Google native + glass
// overlay) and [[feedback-no-sender-budgets-use-moderation]] cache-first
// pattern discussion.
//
// Module-level singleton: one cache for the page session. Cleared on
// full reload (which is fine — fresh data on reload is desirable).

export interface CachedParcel {
  apn: string;
  /** GeoJSON geometry (Polygon / MultiPolygon) for the highlight. */
  geometry: unknown;
  address: string | null;
  city: string | null;
  propertyType: string | null;
  yearBuilt: number | null;
  buildingSqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  assesseeName: string | null;
  netValue: number | null;
  /** When this entry was cached (ms epoch) — for optional TTL eviction. */
  cachedAt: number;
}

// Cap the cache so a long flight session doesn't grow unbounded. ~4000
// parcels is generous (covers a lot of Lemoore) and cheap in memory.
const MAX_ENTRIES = 4000;

const store = new Map<string, CachedParcel>();

export function getCachedParcel(apn: string): CachedParcel | undefined {
  const hit = store.get(apn);
  if (hit) {
    // Touch for simple LRU-ish recency (re-insert moves it to newest).
    store.delete(apn);
    store.set(apn, hit);
  }
  return hit;
}

export function setCachedParcel(p: CachedParcel): void {
  if (store.has(p.apn)) store.delete(p.apn);
  store.set(p.apn, p);
  // Evict oldest if over cap.
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
}

export function hasCachedParcel(apn: string): boolean {
  return store.has(apn);
}

export function cacheSize(): number {
  return store.size;
}

// Bridge to the existing geometry cache that PlotPropertyHighlight reads
// (window.__plotParcelGeomCache). Keeping both in sync means a prefetched
// parcel's polygon is also instantly available to the highlight layer
// without its own fetch. Locked 2026-05-30 pattern — see that component.
export function primeGeomCache(apn: string, geometry: unknown): void {
  if (typeof window === 'undefined' || !geometry) return;
  const w = window as unknown as { __plotParcelGeomCache?: Map<string, unknown> };
  if (!w.__plotParcelGeomCache) w.__plotParcelGeomCache = new Map();
  w.__plotParcelGeomCache.set(apn, geometry);
}
