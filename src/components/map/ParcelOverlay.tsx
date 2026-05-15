'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

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
  minZoom = MIN_ZOOM_DEFAULT,
}: Props) {
  const map = useMap();
  const dataLayerRef = useRef<google.maps.Data | null>(null);
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

  // ── Reapply style on colorMode change. ───────────────────────────
  useEffect(() => { applyStyle(); }, [colorMode, applyStyle]);

  // ── Show / hide the layer. ───────────────────────────────────────
  useEffect(() => {
    if (!map || !dataLayerRef.current) return;
    dataLayerRef.current.setMap(visible ? map : null);
  }, [map, visible]);

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
        // previously fetched region.
        const layer = dataLayerRef.current;
        let added = 0;
        for (const f of features) {
          const apn = f.properties.apn ?? '';
          if (!apn || fetchedFeaturesRef.current.has(apn)) continue;
          fetchedFeaturesRef.current.add(apn);
          layer.addGeoJson(
            {
              type: 'Feature',
              id: apn,
              geometry: f.geometry,
              properties: f.properties as Record<string, unknown>,
            },
            { idPropertyName: 'apn' },
          );
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
    if (dataLayerRef.current) {
      dataLayerRef.current.forEach(f => dataLayerRef.current!.remove(f));
    }
  }, [visible]);

  return null;
}
