"use client";

// PlotPropertyHighlight — outlines the selected property's actual parcel
// polygon as a <gmp-polygon-3d-interactive> over the photoreal map.
// Locked 2026-05-30 evening per the in-world-stack spec.
//
// Data: real PostGIS polygon via /api/parcels/by-apn. Coverage is
// Kings/Tulare/Fresno/Sacramento counties only today; outside those
// counties the highlight simply doesn't render (no fabricated footprint
// — falsifying lot lines is worse than no highlight).
//
// Visual: Plot-blue stroke + low-opacity blue fill, lifted ~0.5m to
// avoid z-fighting with the photoreal terrain (matches the parcel
// overlay pattern in Parcel3DOverlay.tsx). drawsOccludedSegments=true
// so the outline still reads when terrain occludes the segment.
//
// Mount sequence:
//   1. Fetch /api/parcels/by-apn?apn=<apn> on apn change
//   2. Extract first ring of coords from GeoJSON (Polygon or first
//      ring of MultiPolygon)
//   3. Create <gmp-polygon-3d-interactive> with path=[{lat,lng,alt}]
//   4. Append to gmp-map-3d; Google handles projection/depth/camera

import { useEffect, useRef, useState } from "react";

interface Props {
  /** Map element ref (gmp-map-3d host). */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  /** APN of the property whose parcel to outline. Null = no highlight. */
  apn: string | null;
}

interface Polygon3DElement extends HTMLElement {
  path: { lat: number; lng: number; altitude?: number }[];
  innerPaths?: { lat: number; lng: number; altitude?: number }[][];
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  altitudeMode: string;
  extruded?: boolean;
  drawsOccludedSegments?: boolean;
}

interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];  // [ring][point][lng,lat]
}
interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}
type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon | null;

const POLYGON_TAG = 'gmp-polygon-3d-interactive';
const LIFT_M = 0.5;

// Plot blue from globals.css.
const PLOT_BLUE = '#2B6BFF';
const PLOT_BLUE_FILL = 'rgba(43,107,255,0.18)';

function extractFirstRing(geom: GeoJSONGeometry): { lat: number; lng: number }[] | null {
  if (!geom) return null;
  if (geom.type === 'Polygon') {
    const ring = geom.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 3) return null;
    return ring.map(([lng, lat]) => ({ lat, lng }));
  }
  if (geom.type === 'MultiPolygon') {
    const ring = geom.coordinates?.[0]?.[0];
    if (!Array.isArray(ring) || ring.length < 3) return null;
    return ring.map(([lng, lat]) => ({ lat, lng }));
  }
  return null;
}

export default function PlotPropertyHighlight({ mapElRef, apn }: Props) {
  const polyRef = useRef<Polygon3DElement | null>(null);
  const [ring, setRing] = useState<{ lat: number; lng: number }[] | null>(null);

  // Fetch the polygon when APN changes.
  useEffect(() => {
    let cancelled = false;
    setRing(null);
    if (!apn) return;
    fetch(`/api/parcels/by-apn?apn=${encodeURIComponent(apn)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.geometry) return;
        const extracted = extractFirstRing(data.geometry as GeoJSONGeometry);
        if (extracted) setRing(extracted);
      })
      .catch(() => { /* silent — no highlight if anything fails */ });
    return () => { cancelled = true; };
  }, [apn]);

  // Mount / unmount the polygon element when we have a ring + map.
  useEffect(() => {
    if (!ring || ring.length < 3) return;

    let retryId: number | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 50;
    let createdPoly: Polygon3DElement | null = null;

    const tryMount = () => {
      attempt += 1;
      const mapEl = mapElRef.current;
      if (!mapEl) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        }
        return;
      }
      const def = window.customElements?.get?.(POLYGON_TAG);
      if (!def) {
        if (attempt < MAX_ATTEMPTS) {
          retryId = window.setTimeout(tryMount, 100);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`[PlotPropertyHighlight] ${POLYGON_TAG} not registered after retries.`);
        }
        return;
      }

      const poly = document.createElement(POLYGON_TAG) as Polygon3DElement;
      try { poly.altitudeMode = 'RELATIVE_TO_GROUND'; } catch { /* ignore */ }
      try {
        poly.path = ring.map((p) => ({ lat: p.lat, lng: p.lng, altitude: LIFT_M }));
      } catch { /* ignore */ }
      try { poly.fillColor = PLOT_BLUE_FILL; } catch { /* ignore */ }
      try { poly.strokeColor = PLOT_BLUE; } catch { /* ignore */ }
      try { poly.strokeWidth = 3; } catch { /* ignore */ }
      try { poly.drawsOccludedSegments = true; } catch { /* ignore */ }
      try { poly.setAttribute('plot-property-highlight', ''); } catch { /* ignore */ }

      mapEl.appendChild(poly);
      createdPoly = poly;
      polyRef.current = poly;
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (createdPoly) {
        try { createdPoly.remove(); } catch { /* already gone */ }
      }
      polyRef.current = null;
    };
  }, [ring, mapElRef]);

  return null;
}
