'use client';

import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import type { ParcelColorMode, ParcelHitTester } from './ParcelOverlay';

// ── 3D parcel overlay ──────────────────────────────────────────────────
//
// Mounts the county assessor parcels as <gmp-polygon-3d> children of the
// <gmp-map-3d> element. Same fetch contract as the 2D ParcelOverlay
// (calls /api/parcels/viewport on camera changes, debounced), same
// color modes, same click → onParcelClick(apn, latLng) flow.
//
// Two deliberate differences from the 2D path:
//
// 1. Tighter feature cap (500 vs 2D's 5000). Map3DElement's
//    Polygon3D rendering is still alpha-quality at scale; pushing 5000
//    polygons would tank framerate. The cathedral-tier WebGL pipeline
//    is the answer for higher density later; today we keep it honest.
//
// 2. Tiny altitude lift (~0.5m). Polygon3D rendered AT ground level
//    z-fights with the photoreal tile surface; lifting slightly puts
//    parcels above the terrain without breaking the "polygons sit on
//    the ground" impression.
//
// The hit-tester exposed through hitTesterRef uses geometric point-in-
// polygon math against the cached feature set, so the gamepad reticle
// can ask "what parcel is at screen pixel (x, y)?" without depending on
// Map3D's own event system (which is currently flaky during flight).
//
// Hit-testing pipeline:
//   screen (x,y) → lat/lng via Map3DElement.screenToLatLng
//                                     ↓
//                          point-in-polygon test against
//                          cached parcel rings
//                                     ↓
//                          returns { apn, lat, lng } or null

interface Map3DElement extends HTMLElement {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
  /** Map3D's screen→lat/lng projection helper. Returns null if the
   *  pixel is outside the camera frustum. Available on the
   *  Map3DElement web component once it's mounted. */
  screenToLatLng?: (x: number, y: number) => { lat: number; lng: number } | null;
}

// gmp-polygon-3d-interactive is the clickable variant of gmp-polygon-3d.
// The plain (non-interactive) variant does NOT fire gmp-click events
// even with a clickable attribute set — Map3D's API treats interactive
// children as a separate element class (same pattern as gmp-marker-3d
// vs gmp-marker-3d-interactive). 'path' and 'innerPaths' are the
// current geometry properties; 'outerCoordinates'/'innerCoordinates'
// are deprecated aliases that still work but emit console warnings.
interface Polygon3DElement extends HTMLElement {
  path: { lat: number; lng: number; altitude?: number }[];
  innerPaths?: { lat: number; lng: number; altitude?: number }[][];
  fillColor: string;
  fillExtrusionColor?: string;
  strokeColor: string;
  strokeWidth: number;
  altitudeMode: string; // 'CLAMP_TO_GROUND' | 'RELATIVE_TO_GROUND' | 'ABSOLUTE'
  extruded?: boolean;
  drawsOccludedSegments?: boolean;
}

interface ParcelFeatureProps {
  apn?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  buildingSqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  assesseeName?: string | null;
  netValue?: number | null;
}

interface Props {
  /** The <gmp-map-3d> DOM element we attach Polygon3D children to. */
  mapElRef: MutableRefObject<Map3DElement | null>;
  /** First-person camera state ref (lat/lng/altitude/heading/pitch).
   *  Used to debounce fetches on real camera motion and to derive
   *  the viewport bbox for /api/parcels/viewport. */
  cameraRef: MutableRefObject<{
    lat: number;
    lng: number;
    altitude: number;
    heading: number;
    pitch: number;
  } | null>;
  visible: boolean;
  colorMode: ParcelColorMode;
  /** Reticle hit-tester output: MapView3D writes a function here and
   *  the gamepad loop calls it each frame at the reticle pixel. Click
   *  + hover dispatch happens IN MapView3D, not here. */
  hitTesterRef?: MutableRefObject<ParcelHitTester | null>;
  /** Lat/lng → parcel finder. Used by MapView3D's gmp-click handler:
   *  Map3D gives us the click's geographic position directly, so we
   *  skip the screen-projection step the reticle hit-tester does and
   *  ray-cast directly against the cached parcel rings. */
  latLngFinderRef?: MutableRefObject<((lat: number, lng: number) => { apn: string; lat: number; lng: number } | null) | null>;
  /** Mouse click on a polygon → fires this. We set clickable="true" on
   *  each <gmp-polygon-3d> and listen for gmp-click, which is the only
   *  reliable mouse-click path on Map3D's photoreal surface (raw
   *  pointer events get consumed inside Map3D's shadow DOM, and
   *  gmp-click on the map element itself is not dispatched in the
   *  current preview API — only on interactive children). */
  onParcelClick?: (apn: string, latLng: { lat: number; lng: number }) => void;
  /** Above this eye altitude (meters), we don't fetch. The aerial
   *  view above this point sees too many parcels to render at
   *  Polygon3D's current performance ceiling. Tuned to ~1500m so
   *  most flight work is below it. */
  maxAltitudeMeters?: number;
}

const MAX_ALTITUDE_DEFAULT_M = 1500;
const MAX_FEATURES_RENDERED = 500;
const FETCH_DEBOUNCE_MS = 350;
// Visual: lift parcels slightly above terrain to avoid z-fighting with
// the photoreal tile surface. Sub-meter feels right — they read as
// "sitting on the ground" without flickering.
const PARCEL_LIFT_M = 0.5;

// ── Color helpers (mirrors 2D ParcelOverlay so visuals stay consistent) ──
// Kept inline so adding a new mode here doesn't require coordinating
// edits across files.

function colorForLandUse(p: ParcelFeatureProps): string {
  const code = (p.propertyType ?? '').toString().toUpperCase();
  if (!code) return '#475569';
  if (code.startsWith('R') || code.startsWith('1')) return '#22c55e';
  if (code.startsWith('C') || code.startsWith('2')) return '#3b82f6';
  if (code.startsWith('M') || code.startsWith('3')) return '#a855f7';
  if (code.startsWith('A') || code.startsWith('4')) return '#84cc16';
  if (code.startsWith('5')) return '#10b981';
  if (code.startsWith('7')) return '#f59e0b';
  if (code.startsWith('V') || code.startsWith('9')) return '#64748b';
  return '#475569';
}

function colorForValue(p: ParcelFeatureProps): string {
  const v = p.netValue;
  if (v == null) return '#1e293b';
  if (v < 50_000) return '#1e3a8a';
  if (v < 150_000) return '#1d4ed8';
  if (v < 300_000) return '#2563eb';
  if (v < 500_000) return '#3b82f6';
  if (v < 800_000) return '#f59e0b';
  if (v < 1_500_000) return '#ea580c';
  return '#dc2626';
}

function colorForYearBuilt(p: ParcelFeatureProps): string {
  const y = p.yearBuilt;
  if (!y) return '#1e293b';
  if (y < 1940) return '#7c2d12';
  if (y < 1960) return '#b45309';
  if (y < 1980) return '#ca8a04';
  if (y < 2000) return '#65a30d';
  if (y < 2010) return '#16a34a';
  return '#06b6d4';
}

function colorForDeveloped(p: ParcelFeatureProps): string {
  return p.buildingSqft && p.buildingSqft > 0 ? '#22c55e' : '#64748b';
}

function colorFor(mode: ParcelColorMode, p: ParcelFeatureProps): string {
  switch (mode) {
    case 'land_use':   return colorForLandUse(p);
    case 'value':      return colorForValue(p);
    case 'year_built': return colorForYearBuilt(p);
    case 'occupancy':  return '#3b82f6'; // placeholder same as 2D
    case 'developed':  return colorForDeveloped(p);
    default:           return '#475569';
  }
}

// rgba() helper for fill opacity baked into the color string.
function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Point-in-polygon (ray casting). Used by the hit-tester to map a
//    screen pixel back to a parcel APN. Standard even-odd-crossings
//    algorithm; works on geographic coordinates because at parcel
//    scales the lat/lng plane is locally Euclidean.
function pointInRing(pt: [number, number], ring: [number, number][]): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Cached feature shape used both for rendering and hit-testing.
interface IndexedFeature {
  apn: string;
  props: ParcelFeatureProps;
  /** Outer ring as [lng, lat] pairs. We index by lng/lat because that's
   *  the GeoJSON convention and the ray-cast doesn't care about
   *  geographic order — only that x and y are consistent. */
  outerRing: [number, number][];
  innerRings: [number, number][][];
  polygonEl: Polygon3DElement | null;
  centerLat: number;
  centerLng: number;
  bboxMinLat: number;
  bboxMinLng: number;
  bboxMaxLat: number;
  bboxMaxLng: number;
}

export default function Parcel3DOverlay({
  mapElRef,
  cameraRef,
  visible,
  colorMode,
  hitTesterRef,
  latLngFinderRef,
  onParcelClick,
  maxAltitudeMeters = MAX_ALTITUDE_DEFAULT_M,
}: Props) {
  // Indexed feature set — APN → cached geometry + rendered polygon DOM.
  const featuresRef = useRef<Map<string, IndexedFeature>>(new Map());
  // Live ref to onParcelClick so polygon click listeners (bound at
  // polygon-creation time) always invoke the most-recent callback.
  const onParcelClickRef = useRef(onParcelClick);
  onParcelClickRef.current = onParcelClick;
  const inflightRef = useRef<AbortController | null>(null);
  const fetchTimerRef = useRef<number | null>(null);
  // Last-fetched bbox; we skip the fetch if camera hasn't moved enough.
  const lastBboxRef = useRef<{ minLng: number; minLat: number; maxLng: number; maxLat: number } | null>(null);

  // ── Compute current viewport bbox from camera state.
  // For Map3D the "viewport" isn't a simple lat/lng rectangle — the
  // camera can tilt and rotate, so the visible polygon on the ground is
  // a trapezoid. We approximate with a generous bbox centered on
  // cam.lat/lng, sized by camera altitude. Higher altitude = wider
  // viewport coverage. Conservative — we'll over-fetch slightly to
  // avoid pop-in on edge cases (pan, yaw).
  const computeBbox = useCallback((): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null => {
    const cam = cameraRef.current;
    if (!cam) return null;
    // Rough scale: at 100m altitude show ~250m radius; at 500m altitude
    // show ~1500m. Linear scaling is fine for our purposes.
    const radiusM = Math.max(250, cam.altitude * 3);
    const dLat = radiusM / 111_320;
    const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
    const dLng = radiusM / (111_320 * cosLat);
    return {
      minLng: cam.lng - dLng,
      minLat: cam.lat - dLat,
      maxLng: cam.lng + dLng,
      maxLat: cam.lat + dLat,
    };
  }, [cameraRef]);

  // ── Detach a parcel's polygon from the map DOM (used on color-mode
  //    swaps and on cleanup).
  const detachPolygon = useCallback((feat: IndexedFeature) => {
    const poly = feat.polygonEl;
    if (poly && poly.parentNode) poly.parentNode.removeChild(poly);
    feat.polygonEl = null;
  }, []);

  // ── Build/update a single polygon DOM element for a feature.
  const attachPolygon = useCallback((feat: IndexedFeature, mapEl: Map3DElement) => {
    // Reuse existing polygon if we have one, only mutating what changed.
    let poly = feat.polygonEl;
    const fillHex = colorFor(colorMode, feat.props);
    const fillOpacity = colorMode === 'none' ? 0 : 0.25;
    const fill = rgba(fillHex, fillOpacity);
    const stroke = colorMode === 'none' ? rgba('#1D3557', 0.55) : rgba(fillHex, 0.85);

    if (!poly) {
      // Interactive variant — only this one fires gmp-click events.
      // The plain <gmp-polygon-3d> renders identically but is inert
      // for input. See reference_map3d_element_extension_model.md.
      poly = document.createElement('gmp-polygon-3d-interactive') as Polygon3DElement;
      poly.altitudeMode = 'RELATIVE_TO_GROUND';
      // strokeWidth is in pixels. 1.0 is subtle; we want parcel lines
      // visible without screaming.
      poly.strokeWidth = 1.0;
      // Stash APN on the element so the click listener can recover
      // which parcel was clicked from event.target without holding
      // a closure over `feat` (which would leak across reuse).
      poly.dataset.apn = feat.apn;
      poly.dataset.lat = String(feat.centerLat);
      poly.dataset.lng = String(feat.centerLng);
      // gmp-click is dispatched by Map3D when the user clicks an
      // interactive child. event.detail.position gives the precise
      // click lat/lng; we fall back to the cached centroid if absent.
      poly.addEventListener('gmp-click', (rawEv) => {
        const ev = rawEv as CustomEvent<{ position?: { lat: number; lng: number; altitude?: number } }>;
        const el = ev.target as HTMLElement | null;
        const apn = el?.dataset.apn;
        if (!apn) return;
        const pos = ev.detail?.position;
        const lat = pos?.lat ?? Number(el?.dataset.lat);
        const lng = pos?.lng ?? Number(el?.dataset.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onParcelClickRef.current?.(apn, { lat, lng });
      });
      mapEl.appendChild(poly);
      feat.polygonEl = poly;
    }

    // Geometry — outer ring lifted to PARCEL_LIFT_M altitude. Map3D
    // expects { lat, lng, altitude } objects. Property names are
    // 'path' / 'innerPaths' in the current API; the deprecated
    // 'outerCoordinates' / 'innerCoordinates' still work but emit
    // console warnings.
    poly.path = feat.outerRing.map(([lng, lat]) => ({
      lat,
      lng,
      altitude: PARCEL_LIFT_M,
    }));
    if (feat.innerRings.length > 0) {
      poly.innerPaths = feat.innerRings.map((ring) =>
        ring.map(([lng, lat]) => ({ lat, lng, altitude: PARCEL_LIFT_M })),
      );
    }
    poly.fillColor = fill;
    poly.strokeColor = stroke;
  }, [colorMode]);

  // ── Re-apply colors when colorMode changes (no re-fetch needed; we
  //    have the geometry cached).
  useEffect(() => {
    const mapEl = mapElRef.current;
    if (!mapEl || !visible) return;
    featuresRef.current.forEach((feat) => attachPolygon(feat, mapEl));
  }, [colorMode, visible, mapElRef, attachPolygon]);

  // ── Tear down ALL polygons when visibility goes off. Keep the
  //    feature cache so toggling back on is instant.
  useEffect(() => {
    if (visible) return;
    featuresRef.current.forEach((feat) => detachPolygon(feat));
  }, [visible, detachPolygon]);

  // ── Fetch parcels for current viewport, debounced.
  //    The page's cameraRef updates 60×/sec during flight; we coalesce
  //    to one fetch per ~350ms after motion settles. Uses the existing
  //    /api/parcels/viewport endpoint — same data the 2D path uses.
  const fetchViewport = useCallback(async () => {
    const mapEl = mapElRef.current;
    const cam = cameraRef.current;
    if (!mapEl || !cam || !visible) return;
    if (cam.altitude > maxAltitudeMeters) {
      // Above the cap — clear out anything currently rendered so we
      // don't have stale visible parcels from a previous low flyover.
      // (Cheap; usually no-op if nothing was rendered.)
      featuresRef.current.forEach((feat) => detachPolygon(feat));
      return;
    }
    const bbox = computeBbox();
    if (!bbox) return;
    lastBboxRef.current = bbox;

    // Cancel any pending fetch — only the most recent viewport matters.
    if (inflightRef.current) inflightRef.current.abort();
    const ac = new AbortController();
    inflightRef.current = ac;

    try {
      // We pass zoom=16 as a hint. The endpoint zoom-gates at 14, so 16
      // is well above the threshold and matches our street-level flying.
      const qs = `bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}&zoom=16`;
      const res = await fetch(`/api/parcels/viewport?${qs}`, { signal: ac.signal });
      if (!res.ok) return;
      const json: { features: ParcelGeoJsonFeature[] } = await res.json();
      if (ac.signal.aborted) return;

      // Build incoming APN set; anything in cache NOT in incoming gets
      // detached. New ones get attached. Existing ones get color-refreshed.
      const incomingApns = new Set<string>();
      const features = (json.features ?? []).slice(0, MAX_FEATURES_RENDERED);

      for (const f of features) {
        const apn = String(f.properties?.apn ?? '');
        if (!apn) continue;
        incomingApns.add(apn);

        // Parse GeoJSON geometry into outer + inner rings as
        // [lng, lat] pairs. Polygon = single outer (+ optional holes).
        // MultiPolygon = list of polygons; we use the first one to keep
        // hit-testing simple. (Real-world parcels are almost always
        // single-polygon; MultiPolygon shows up rarely with split lots.)
        const geom = f.geometry;
        if (!geom) continue;
        let outerRing: [number, number][] = [];
        let innerRings: [number, number][][] = [];
        if (geom.type === 'Polygon') {
          outerRing = (geom.coordinates[0] || []) as [number, number][];
          innerRings = (geom.coordinates.slice(1) || []) as [number, number][][];
        } else if (geom.type === 'MultiPolygon') {
          const first = geom.coordinates[0] || [];
          outerRing = (first[0] || []) as [number, number][];
          innerRings = (first.slice(1) || []) as [number, number][][];
        }
        if (outerRing.length < 3) continue;

        // Compute bbox + centroid (centroid is approximate — average of
        // outer ring vertices is fine for opening PropertyPopup; we
        // don't need precise area-weighted centroid).
        let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
        let sumLat = 0, sumLng = 0;
        for (const [lng, lat] of outerRing) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          sumLat += lat;
          sumLng += lng;
        }
        const n = outerRing.length;

        const props: ParcelFeatureProps = {
          apn,
          propertyType: (f.properties?.propertyType as string | null) ?? null,
          yearBuilt: (f.properties?.yearBuilt as number | null) ?? null,
          buildingSqft: (f.properties?.buildingSqft as number | null) ?? null,
          assesseeName: (f.properties?.assesseeName as string | null) ?? null,
          netValue: (f.properties?.netValue as number | null) ?? null,
        };

        let existing = featuresRef.current.get(apn);
        if (existing) {
          // Geometry doesn't change for the same APN; just refresh
          // properties and styling.
          existing.props = props;
        } else {
          existing = {
            apn,
            props,
            outerRing,
            innerRings,
            polygonEl: null,
            centerLat: sumLat / n,
            centerLng: sumLng / n,
            bboxMinLat: minLat,
            bboxMinLng: minLng,
            bboxMaxLat: maxLat,
            bboxMaxLng: maxLng,
          };
          featuresRef.current.set(apn, existing);
        }
        attachPolygon(existing, mapEl);
      }

      // Detach parcels no longer in viewport (moved away). Keep their
      // entries in featuresRef briefly? No — if we kept them forever
      // memory grows unbounded over long sessions. Drop them now;
      // re-fetch is cheap (Postgres + GeoJSON is fast).
      const toDelete: string[] = [];
      featuresRef.current.forEach((feat, apn) => {
        if (!incomingApns.has(apn)) {
          detachPolygon(feat);
          toDelete.push(apn);
        }
      });
      toDelete.forEach((apn) => featuresRef.current.delete(apn));
    } catch (err) {
      // Aborted fetches throw AbortError — silent. Any other error logs
      // because it's a real problem (network / 500 / API change).
      if ((err as Error).name !== 'AbortError') {
        // eslint-disable-next-line no-console
        console.warn('[Parcel3DOverlay] fetch failed', err);
      }
    } finally {
      if (inflightRef.current === ac) inflightRef.current = null;
    }
  }, [mapElRef, cameraRef, visible, maxAltitudeMeters, computeBbox, attachPolygon, detachPolygon]);

  // ── RAF tick that watches the camera and triggers debounced refetches.
  //    Cheaper than a useEffect re-running per camera change because the
  //    camera updates at 60Hz during flight and we only want fetches
  //    when motion settles.
  useEffect(() => {
    if (!visible) return;
    let rafId: number | null = null;
    let lastFetchCenter: { lat: number; lng: number; alt: number } | null = null;
    // Distance threshold to trigger a re-fetch (in meters). Avoids
    // re-fetching on tiny camera wobble while still catching real pan.
    const REFETCH_DIST_M = 60;

    const tick = () => {
      const cam = cameraRef.current;
      if (cam) {
        const last = lastFetchCenter;
        let triggerFetch = false;
        if (!last) {
          triggerFetch = true;
        } else {
          const dLat = (cam.lat - last.lat) * 111_320;
          const dLng = (cam.lng - last.lng) * 111_320 * Math.cos((cam.lat * Math.PI) / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          const dAlt = Math.abs(cam.altitude - last.alt);
          if (dist > REFETCH_DIST_M || dAlt > 100) triggerFetch = true;
        }
        if (triggerFetch) {
          lastFetchCenter = { lat: cam.lat, lng: cam.lng, alt: cam.altitude };
          if (fetchTimerRef.current) window.clearTimeout(fetchTimerRef.current);
          fetchTimerRef.current = window.setTimeout(() => {
            fetchTimerRef.current = null;
            fetchViewport();
          }, FETCH_DEBOUNCE_MS);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (fetchTimerRef.current) {
        window.clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
      if (inflightRef.current) inflightRef.current.abort();
    };
  }, [visible, cameraRef, fetchViewport]);

  // ── Hit-tester: screen pixel → parcel APN.
  //
  // Map3DElement doesn't expose any screen-to-world projection method
  // (no screenToLatLng / getProjection in the current preview API), so
  // we project the reticle ourselves: cast a ray from the eye in the
  // camera's view direction and intersect with the ground plane
  // (altitude = 0). This works for the on-axis reticle pixel; truly
  // arbitrary (x, y) pixels would need a full inverse-projection
  // through the camera frustum, which we don't have here.
  //
  // Since the gamepad loop only ever calls this at the center-screen
  // reticle, the on-axis approximation is exact for the cases that
  // matter. Off-axis callers get the same on-axis ground point —
  // acceptable graceful degradation (would still pick the parcel near
  // the screen center, not at the user's actual cursor).
  useEffect(() => {
    if (!hitTesterRef) return;
    const tester: ParcelHitTester = (_x: number, _y: number) => {
      const cam = cameraRef.current;
      if (!cam) return null;
      // Pitch convention here matches MapView3D's FpCam:
      //   pitch =  0 → looking at horizon
      //   pitch < 0 → looking down (toward ground)
      //   pitch > 0 → looking up (toward sky)
      // The reticle only hits the ground when pitch is negative;
      // looking at or above the horizon misses the ground entirely.
      const pitchDeg = cam.pitch;
      if (pitchDeg >= -0.5) return null; // looking at horizon or up — no ground intercept
      const pitchRad = (Math.abs(pitchDeg) * Math.PI) / 180;
      // Ground distance from the camera footprint to the reticle
      // intercept: altitude / tan(downward angle).
      const groundDistM = cam.altitude / Math.tan(pitchRad);
      // Don't trust ridiculously far intercepts (near-horizon clips
      // can compute kilometers away where parcels aren't fetched).
      if (!Number.isFinite(groundDistM) || groundDistM > 50_000) return null;
      // Convert (heading, groundDist) → lat/lng offset.
      const headingRad = (cam.heading * Math.PI) / 180;
      const dNorthM = groundDistM * Math.cos(headingRad);
      const dEastM = groundDistM * Math.sin(headingRad);
      const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
      const targetLat = cam.lat + dNorthM / 111_320;
      const targetLng = cam.lng + dEastM / (111_320 * cosLat);
      const px: [number, number] = [targetLng, targetLat];
      // Same point-in-polygon search as the lat/lng finder.
      const featArr = Array.from(featuresRef.current.values());
      for (let i = 0; i < featArr.length; i++) {
        const feat = featArr[i];
        if (targetLat < feat.bboxMinLat || targetLat > feat.bboxMaxLat) continue;
        if (targetLng < feat.bboxMinLng || targetLng > feat.bboxMaxLng) continue;
        if (pointInRing(px, feat.outerRing)) {
          let inHole = false;
          for (let r = 0; r < feat.innerRings.length; r++) {
            if (pointInRing(px, feat.innerRings[r])) { inHole = true; break; }
          }
          if (inHole) continue;
          return { apn: feat.apn, lat: feat.centerLat, lng: feat.centerLng };
        }
      }
      return null;
    };
    hitTesterRef.current = tester;
    return () => {
      if (hitTesterRef.current === tester) hitTesterRef.current = null;
    };
  }, [hitTesterRef, cameraRef]);

  // ── Lat/lng finder: same point-in-polygon, but starts from a
  //    geographic coordinate the caller already has (e.g. from gmp-click's
  //    event.detail.position). No screen-projection needed.
  useEffect(() => {
    if (!latLngFinderRef) return;
    const finder = (lat: number, lng: number) => {
      const px: [number, number] = [lng, lat];
      const featArr = Array.from(featuresRef.current.values());
      for (let i = 0; i < featArr.length; i++) {
        const feat = featArr[i];
        if (lat < feat.bboxMinLat || lat > feat.bboxMaxLat) continue;
        if (lng < feat.bboxMinLng || lng > feat.bboxMaxLng) continue;
        if (pointInRing(px, feat.outerRing)) {
          let inHole = false;
          for (let r = 0; r < feat.innerRings.length; r++) {
            if (pointInRing(px, feat.innerRings[r])) { inHole = true; break; }
          }
          if (inHole) continue;
          return { apn: feat.apn, lat: feat.centerLat, lng: feat.centerLng };
        }
      }
      return null;
    };
    latLngFinderRef.current = finder;
    return () => {
      if (latLngFinderRef.current === finder) latLngFinderRef.current = null;
    };
  }, [latLngFinderRef]);

  // useMemo to avoid re-creating the noop component every render.
  return useMemo(() => null, []);
}

// ── Local GeoJSON types ─────────────────────────────────────────────────
// We don't pull in @types/geojson just for this file. Keep narrow.
type GeoCoord = [number, number]; // [lng, lat]
interface PolygonGeometry { type: 'Polygon'; coordinates: GeoCoord[][]; }
interface MultiPolygonGeometry { type: 'MultiPolygon'; coordinates: GeoCoord[][][]; }
type Geometry = PolygonGeometry | MultiPolygonGeometry;
interface ParcelGeoJsonFeature {
  type?: 'Feature';
  geometry: Geometry | null;
  properties: Record<string, unknown> | null;
}
