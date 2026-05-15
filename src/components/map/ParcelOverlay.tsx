'use client';

import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

export interface ParcelHitTestResult {
  apn: string;
  lat: number;
  lng: number;
}

/** Pixel→parcel hit-test exposed for the gamepad reticle. The controller
 *  hands a {x, y} container-pixel each frame and gets back the parcel
 *  underneath (or null). Bypasses Google's flaky-during-flight mouseover
 *  events entirely — we own the geometry, so we ask our own data. */
export type ParcelHitTester = (x: number, y: number) => ParcelHitTestResult | null;

// Color modes the overlay can render. Each one is a styling function over
// the polygon properties returned by /api/parcels/viewport — no extra
// fetches when the user switches modes.
export type ParcelColorMode =
  | 'none'           // outline only, no fill
  | 'land_use'       // by property_type / use code
  | 'value'          // by netValue (assessor net assessed)
  | 'year_built'     // age heatmap
  | 'occupancy'      // owner-occupied vs absentee (mailing == situs heuristic)
  | 'developed';     // has building vs vacant land

interface ParcelFeatureProps {
  apn?: string | null;
  address?: string | null;
  city?: string | null;
  propertyType?: string | null;
  yearBuilt?: number | null;
  buildingSqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  assesseeName?: string | null;
  netValue?: number | null;
}

interface Props {
  visible: boolean;
  colorMode: ParcelColorMode;
  /** Fires when the user clicks a parcel polygon. Pass the APN so the
   *  page can open the property popup against existing resolver flow. */
  onParcelClick?: (apn: string, latLng: { lat: number; lng: number }) => void;
  /** Fires when the cursor enters or leaves a parcel polygon. Used by
   *  airplane-mode to drive the reticle's hover-ready state when flying
   *  over a parcel. Page combines this with pin-DOM hover from the
   *  gamepad controller and lets the pin win on overlap. */
  onParcelHoverChange?: (apn: string | null, latLng: { lat: number; lng: number } | null) => void;
  /** Optional ref the overlay writes its hit-tester into. Lets the
   *  gamepad reticle ask "what parcel is under (x, y)?" each frame
   *  without depending on Google's mouseover events (which are flaky
   *  during camera motion). The ref is unset while the layer is
   *  hidden or before features have loaded. */
  hitTesterRef?: MutableRefObject<ParcelHitTester | null>;
  /** Minimum zoom level before we even ask the server. Below this we
   *  stay quiet — the viewport would return 5000+ polygons and the
   *  map would chug. */
  minZoom?: number;
}

const MIN_ZOOM_DEFAULT = 14;
const MAX_FEATURES_RENDERED = 5000;

// Color helpers — kept inline so adding a new mode is one function
// next to the existing ones, not a separate module.

function colorForLandUse(p: ParcelFeatureProps): string {
  const code = (p.propertyType ?? '').toString().toUpperCase();
  if (!code) return '#475569';
  if (code.startsWith('R') || code.startsWith('1')) return '#22c55e';     // residential
  if (code.startsWith('C') || code.startsWith('2')) return '#3b82f6';     // commercial
  if (code.startsWith('M') || code.startsWith('3')) return '#a855f7';     // industrial/manufacturing
  if (code.startsWith('A') || code.startsWith('4')) return '#84cc16';     // agricultural
  if (code.startsWith('5')) return '#10b981';                              // open / recreational
  if (code.startsWith('7')) return '#f59e0b';                              // institutional / public
  if (code.startsWith('V') || code.startsWith('9')) return '#64748b';     // vacant
  return '#475569';
}

function colorForValue(p: ParcelFeatureProps): string {
  const v = p.netValue;
  if (v == null) return '#1e293b';
  // Stepped scale tuned for Central Valley assessor values. Numbers are
  // total net assessed value, not market — typically ~60-80% of market
  // because Prop 13 bases on purchase year.
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
  if (y < 1940) return '#7c2d12';   // pre-WWII
  if (y < 1960) return '#b45309';
  if (y < 1980) return '#ca8a04';
  if (y < 2000) return '#65a30d';
  if (y < 2010) return '#16a34a';
  return '#06b6d4';                  // 2010+
}

function colorForOccupancy(): string {
  // True owner-occupied detection requires comparing mailing vs situs
  // addresses — that data isn't on the viewport feature today (we'd need
  // to add it to parcels_in_bbox). For now this mode is a placeholder
  // single color; v2 will use the address comparison.
  return '#3b82f6';
}

function colorForDeveloped(p: ParcelFeatureProps): string {
  return p.buildingSqft && p.buildingSqft > 0 ? '#22c55e' : '#64748b';
}

function colorFor(mode: ParcelColorMode, p: ParcelFeatureProps): string {
  switch (mode) {
    case 'land_use':   return colorForLandUse(p);
    case 'value':      return colorForValue(p);
    case 'year_built': return colorForYearBuilt(p);
    case 'occupancy':  return colorForOccupancy();
    case 'developed':  return colorForDeveloped(p);
    default:           return '#475569';
  }
}

export default function ParcelOverlay({
  visible,
  colorMode,
  onParcelClick,
  onParcelHoverChange,
  hitTesterRef,
  minZoom = MIN_ZOOM_DEFAULT,
}: Props) {
  const map = useMap();
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  // Currently-hovered feature, kept here so mouseout can revert its style
  // without leaking a closure through the listener.
  const hoveredFeatureRef = useRef<google.maps.Data.Feature | null>(null);
  // Latest hover callback as a ref so we don't have to re-subscribe the
  // mouseover/mouseout listeners every time the page identity changes.
  const onParcelHoverChangeRef = useRef(onParcelHoverChange);
  onParcelHoverChangeRef.current = onParcelHoverChange;
  // OverlayView for pixel↔latLng projection. Google's Map.getProjection()
  // only exposes fromLatLngToPoint (world-pixel space), not container
  // pixels — OverlayView.getProjection() does. We mount a hidden one
  // for its projection-accessor side effect; it has no visual.
  const projectionOverlayRef = useRef<google.maps.OverlayView | null>(null);
  const projectionReadyRef = useRef<boolean>(false);
  // Per-feature geometry index: APN → { feature, bounds (for cheap
  // bbox prefilter), polygons (for exact containsLocation hit-test).
  // A single feature can have multiple rings (MultiPolygon) — we store
  // each ring as its own google.maps.Polygon so containsLocation works
  // ring-by-ring.
  type Indexed = {
    feature: google.maps.Data.Feature;
    apn: string;
    bounds: google.maps.LatLngBounds;
    polys: google.maps.Polygon[];
  };
  const geomIndexRef = useRef<Map<string, Indexed>>(new Map());
  // Track what we've fetched so panning back over loaded area is free.
  // We key by string bbox at low precision; effectively this is a
  // viewport-history cache. New viewport = new fetch only if it's not
  // already a subset of fetched area.
  const fetchedFeaturesRef = useRef<Set<string>>(new Set()); // apn keys
  const inflightRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<number>(0);

  // ── Style function — re-applied when colorMode changes. ──────────
  const applyStyle = useCallback(() => {
    if (!dataLayerRef.current) return;
    dataLayerRef.current.setStyle((feature) => {
      const props: ParcelFeatureProps = {
        apn: feature.getProperty('apn') as string | null,
        propertyType: feature.getProperty('propertyType') as string | null,
        yearBuilt: feature.getProperty('yearBuilt') as number | null,
        buildingSqft: feature.getProperty('buildingSqft') as number | null,
        bedrooms: feature.getProperty('bedrooms') as number | null,
        bathrooms: feature.getProperty('bathrooms') as number | null,
        assesseeName: feature.getProperty('assesseeName') as string | null,
        netValue: feature.getProperty('netValue') as number | null,
      };
      const fillColor = colorFor(colorMode, props);
      return {
        fillColor,
        fillOpacity: colorMode === 'none' ? 0 : 0.35,
        strokeColor: '#0ea5e9',
        strokeWeight: 0.75,
        strokeOpacity: 0.6,
        clickable: true,
      };
    });
  }, [colorMode]);

  // ── Init the Data layer once. ────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    if (!dataLayerRef.current) {
      dataLayerRef.current = new google.maps.Data({ map });
    }
    applyStyle();
  }, [map, applyStyle]);

  // ── Hidden OverlayView for container-pixel ↔ latLng projection. ─
  // Mounted once per map. No DOM output; we only consume its
  // getProjection().fromContainerPixelToLatLng() for the reticle
  // hit-test. Without it we'd need to do center+offset arithmetic
  // by hand, which gets imprecise under tilt and rotation.
  useEffect(() => {
    if (!map) return;
    class ProjOverlay extends google.maps.OverlayView {
      onAdd() { projectionReadyRef.current = true; }
      onRemove() { projectionReadyRef.current = false; }
      draw() { /* nothing to draw */ }
    }
    const ov = new ProjOverlay();
    projectionOverlayRef.current = ov;
    ov.setMap(map);
    return () => {
      ov.setMap(null);
      projectionOverlayRef.current = null;
      projectionReadyRef.current = false;
    };
  }, [map]);

  // ── Reapply style on colorMode change. ───────────────────────────
  useEffect(() => { applyStyle(); }, [colorMode, applyStyle]);

  // ── Show / hide the layer. ───────────────────────────────────────
  useEffect(() => {
    if (!map || !dataLayerRef.current) return;
    dataLayerRef.current.setMap(visible ? map : null);
  }, [map, visible]);

  // ── Geometry indexing + reticle hit-test plumbing. ───────────────
  // For each feature we add to the Data layer, we also build a parallel
  // index keyed by APN so the gamepad reticle can ask "what parcel is
  // under (pixel x, y)?" each frame. The index is rebuilt as features
  // come in via the viewport-fetch loop and torn down when the layer
  // is toggled off. Google's Data layer doesn't expose a `getGeometry()`
  // that gives us LatLng arrays directly; we iterate paths via
  // forEachLatLng. A MultiPolygon contributes multiple paths.

  const indexFeatureGeometry = useCallback((feature: google.maps.Data.Feature, apn: string) => {
    const geom = feature.getGeometry();
    if (!geom) return;
    const bounds = new google.maps.LatLngBounds();
    const ringPaths: google.maps.LatLng[][] = [];

    // Polygon: getArray() returns LinearRing[]; first ring is outer,
    // rest are holes. We treat each LinearRing as its own path for
    // hit-test simplicity (a point inside a hole still hits the parcel
    // — that's the common case and matches user expectation).
    // MultiPolygon: getArray() returns Polygon[]; recurse one level.
    function ingestPolygon(poly: google.maps.Data.Polygon) {
      const rings = poly.getArray();
      for (const ring of rings) {
        const ringPath: google.maps.LatLng[] = [];
        ring.getArray().forEach(latLng => {
          ringPath.push(latLng);
          bounds.extend(latLng);
        });
        if (ringPath.length >= 3) ringPaths.push(ringPath);
      }
    }

    const type = geom.getType();
    if (type === 'Polygon') {
      ingestPolygon(geom as google.maps.Data.Polygon);
    } else if (type === 'MultiPolygon') {
      const mp = geom as google.maps.Data.MultiPolygon;
      for (const poly of mp.getArray()) ingestPolygon(poly);
    } else {
      return;  // Points/LineStrings don't belong in a parcel layer
    }

    // One google.maps.Polygon per ring keeps containsLocation() honest;
    // we don't render these — they exist only as hit-test geometry. We
    // never call setMap() on them, so they have zero visual cost.
    const polys = ringPaths.map(path => new google.maps.Polygon({ paths: path }));
    geomIndexRef.current.set(apn, { feature, apn, bounds, polys });
  }, []);

  // Pixel→latLng→APN hit-tester. The gamepad RAF loop calls this each
  // frame at the reticle pixel; we bbox-prefilter before the exact
  // containsLocation check, which keeps the per-frame cost down to a
  // handful of polygon checks even with thousands of parcels loaded.
  const hitTestAt = useCallback<ParcelHitTester>((x, y) => {
    const ov = projectionOverlayRef.current;
    if (!ov || !projectionReadyRef.current) return null;
    const proj = ov.getProjection();
    if (!proj) return null;
    const latLng = proj.fromContainerPixelToLatLng(new google.maps.Point(x, y));
    if (!latLng) return null;
    // Walk the index. Bounds-first filter, then exact containsLocation.
    // Could index by spatial bucket for huge counts but 5000-parcel cap
    // keeps this fine.
    const idx = geomIndexRef.current;
    let hit: ParcelHitTestResult | null = null;
    idx.forEach(entry => {
      if (hit) return;
      if (!entry.bounds.contains(latLng)) return;
      for (const poly of entry.polys) {
        if (google.maps.geometry.poly.containsLocation(latLng, poly)) {
          hit = { apn: entry.apn, lat: latLng.lat(), lng: latLng.lng() };
          return;
        }
      }
    });
    return hit;
  }, []);

  // Publish the hit-tester through the shared ref the page handed down.
  // Clears on unmount so callers can no-op gracefully when the layer
  // isn't mounted.
  useEffect(() => {
    if (!hitTesterRef) return;
    hitTesterRef.current = hitTestAt;
    return () => {
      if (hitTesterRef) hitTesterRef.current = null;
    };
  }, [hitTesterRef, hitTestAt]);

  // ── Click handler — fire callback with the APN. ─────────────────
  useEffect(() => {
    if (!dataLayerRef.current) return;
    const listener = dataLayerRef.current.addListener('click', (e: google.maps.Data.MouseEvent) => {
      const apn = e.feature.getProperty('apn') as string | null;
      if (apn && onParcelClick && e.latLng) {
        onParcelClick(apn, { lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [onParcelClick]);

  // ── Hover handlers — paint a brighter style + report APN up. ─────
  // Brighter stroke + bumped fill opacity makes "I'm over this parcel"
  // legible during flight. Reverts on mouseout. APN/latLng are reported
  // up to the page so airplane-mode can drive the reticle hover state
  // (parcel-under-reticle = hand icon). Pin DOM hover still wins on
  // overlap; the page does the precedence.
  useEffect(() => {
    if (!dataLayerRef.current) return;
    const layer = dataLayerRef.current;
    const overListener = layer.addListener('mouseover', (e: google.maps.Data.MouseEvent) => {
      const feature = e.feature;
      const apn = feature.getProperty('apn') as string | null;
      // Revert previously hovered feature if it was different.
      if (hoveredFeatureRef.current && hoveredFeatureRef.current !== feature) {
        layer.revertStyle(hoveredFeatureRef.current);
      }
      hoveredFeatureRef.current = feature;
      layer.overrideStyle(feature, {
        strokeColor: '#fbbf24',
        strokeWeight: 2,
        strokeOpacity: 1,
        fillOpacity: 0.55,
      });
      if (apn && e.latLng) {
        onParcelHoverChangeRef.current?.(apn, { lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    });
    const outListener = layer.addListener('mouseout', (e: google.maps.Data.MouseEvent) => {
      if (hoveredFeatureRef.current === e.feature) {
        layer.revertStyle(e.feature);
        hoveredFeatureRef.current = null;
        onParcelHoverChangeRef.current?.(null, null);
      }
    });
    return () => {
      google.maps.event.removeListener(overListener);
      google.maps.event.removeListener(outListener);
      if (hoveredFeatureRef.current) {
        layer.revertStyle(hoveredFeatureRef.current);
        hoveredFeatureRef.current = null;
      }
    };
  }, []);

  // ── Viewport-driven fetch on idle. ────────────────────────────────
  useEffect(() => {
    if (!map || !visible) return;

    const fetchViewport = async () => {
      const zoom = map.getZoom() ?? 0;
      if (zoom < minZoom) {
        // Clear what's loaded — at low zoom the overlay just goes quiet.
        return;
      }
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const bbox = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;

      // Throttle — don't refire faster than every 250ms even if "idle"
      // bubbles up multiple times.
      const now = Date.now();
      if (now - lastFetchRef.current < 250) return;
      lastFetchRef.current = now;

      // Cancel any in-flight request — the user moved.
      inflightRef.current?.abort();
      const controller = new AbortController();
      inflightRef.current = controller;

      try {
        const res = await fetch(`/api/parcels/viewport?bbox=${bbox}&zoom=${zoom}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        const features = (json.features ?? []) as { id: string; geometry: unknown; properties: ParcelFeatureProps }[];

        if (!dataLayerRef.current) return;

        // Add new features only — keep what's already on screen. The
        // fetchedFeaturesRef set tracks APNs we've added so panning the
        // map doesn't duplicate features when the viewport overlaps a
        // previously fetched region. For each added feature we also
        // build a polygon-ring index keyed by APN so the gamepad
        // reticle can run an exact containsLocation hit-test against
        // it each frame without depending on Google's mouseover events.
        const layer = dataLayerRef.current;
        let added = 0;
        for (const f of features) {
          const apn = f.properties.apn ?? '';
          if (!apn || fetchedFeaturesRef.current.has(apn)) continue;
          fetchedFeaturesRef.current.add(apn);
          const newFeatures = layer.addGeoJson(
            {
              type: 'Feature',
              id: apn,
              geometry: f.geometry,
              properties: f.properties as Record<string, unknown>,
            },
            { idPropertyName: 'apn' },
          );
          // Build the geometry index entry for the (one) new feature.
          // We expect exactly one back per call, but loop for safety.
          for (const feat of newFeatures) {
            indexFeatureGeometry(feat, apn);
          }
          added++;
          if (fetchedFeaturesRef.current.size > MAX_FEATURES_RENDERED) {
            // Hard cap to keep the browser happy. New parcels at the cap
            // get dropped; user can clear by toggling the overlay off and
            // back on, which resets the cache.
            break;
          }
        }
        if (added > 0) applyStyle();
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          console.error('parcels/viewport fetch failed:', err);
        }
      }
    };

    const listener = map.addListener('idle', fetchViewport);
    // Trigger initial load too.
    fetchViewport();
    return () => google.maps.event.removeListener(listener);
  }, [map, visible, minZoom, applyStyle]);

  // ── Toggle-off resets the cache so a re-toggle on pulls fresh. ───
  useEffect(() => {
    if (visible) return;
    fetchedFeaturesRef.current.clear();
    geomIndexRef.current.clear();
    if (dataLayerRef.current) {
      dataLayerRef.current.forEach(f => dataLayerRef.current!.remove(f));
    }
  }, [visible]);

  return null;
}
