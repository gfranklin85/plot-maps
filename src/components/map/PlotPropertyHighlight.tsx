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
import { animate } from "framer-motion";

interface Props {
  /** Map element ref (gmp-map-3d host). */
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  /** APN of the property whose parcel to outline. Null = no highlight. */
  apn: string | null;
  /** Fired when the parcel ring resolves, with its centroid lat/lng —
   *  the world point to pin the property card to. Fired null when the
   *  highlight clears. Lets the card rise WITH the polygon, anchored to
   *  the same parcel. */
  onCentroid?: (centroid: { lat: number; lng: number } | null) => void;
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
const LIFT_M = 0.5;          // resting height above ground
const TOSS_PEAK_M = 9;       // apex height — the "top of the throw" hang point

// Rise reveal modeled as a REAL vertical toss, not a spring-to-target.
// The polygon is thrown upward from the ground: it launches fast,
// gravity decelerates it so it HANGS at the apex (top of the arc), then
// falls back and settles at rest — the way a ball thrown up behaves.
// The grow-from-center is timed to finish by the apex, so at the top of
// the throw the lot is full-size and just hanging before it settles.
//
// Total duration in ms. The toss + settle play out over this window.
const TOSS_MS = 620;
// What fraction of the duration is the UP (launch → apex) phase. The
// remainder is the gentle fall + settle. Up is quicker than the hang/
// settle so the apex reads as a held beat.
const UP_FRACTION = 0.42;

// Plot blue from globals.css.
const PLOT_BLUE = '#2B6BFF';
const PLOT_BLUE_FILL_OPACITY = 0.18;

// Vertical position over normalized time t (0..1), in meters above
// ground. Two phases:
//   UP   (0 → UP_FRACTION): ballistic rise. Velocity is high at launch
//        and decelerates to ~0 at the apex (top of the throw). Modeled
//        as an ease-OUT (fast→slow) so it visibly hangs at the peak.
//   DOWN (UP_FRACTION → 1): falls from apex and settles to LIFT_M with
//        a soft landing (small secondary cushion, no hard stop).
function tossAltitude(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return LIFT_M;
  if (t < UP_FRACTION) {
    const u = t / UP_FRACTION;          // 0 → 1 over the up phase
    // ease-out (decelerating rise): velocity high at start, ~0 at apex.
    const eased = 1 - Math.pow(1 - u, 2);
    return TOSS_PEAK_M * eased;          // 0 → apex
  }
  const d = (t - UP_FRACTION) / (1 - UP_FRACTION);  // 0 → 1 over the fall
  // ease-in fall (gravity accelerates the drop), then a soft cushion as
  // it nears rest: blend an accelerating drop with an ease-out landing.
  const fall = d * d;                    // accelerating away from apex
  const land = 1 - Math.pow(1 - d, 3);   // decelerating into rest
  const blended = fall * (1 - d) + land * d;  // accel early, cushion late
  return TOSS_PEAK_M + (LIFT_M - TOSS_PEAK_M) * blended;
}

// Grow-from-center scale over normalized time t. Reaches full size right
// around the apex (UP_FRACTION), with a touch of overshoot, then holds.
// So the lot "opens up" on the way up and is fully formed when it hangs.
function growScale(t: number): number {
  const k = Math.min(1, t / (UP_FRACTION + 0.06));  // full a hair after apex
  // ease-out with slight overshoot near the top
  const eased = 1 - Math.pow(1 - k, 2.2);
  const overshoot = Math.sin(Math.min(1, k) * Math.PI) * 0.04;  // tiny bulge
  return eased + overshoot;
}

// Centroid of a lat/lng ring (simple average — exact enough for a small
// parcel; we only need a believable expansion origin, not a true area
// centroid).
function ringCentroid(ring: { lat: number; lng: number }[]): { lat: number; lng: number } {
  let lat = 0, lng = 0;
  for (const p of ring) { lat += p.lat; lng += p.lng; }
  return { lat: lat / ring.length, lng: lng / ring.length };
}

// Build a 'rgba(r,g,b,a)' string for the fill at a given opacity.
function fillAt(opacity: number): string {
  return `rgba(43,107,255,${opacity.toFixed(3)})`;
}

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

export default function PlotPropertyHighlight({ mapElRef, apn, onCentroid }: Props) {
  const polyRef = useRef<Polygon3DElement | null>(null);
  const [ring, setRing] = useState<{ lat: number; lng: number }[] | null>(null);

  // Keep the latest onCentroid in a ref so the resolve effect doesn't
  // re-run when the parent passes a fresh closure each render.
  const onCentroidRef = useRef(onCentroid);
  onCentroidRef.current = onCentroid;

  // Report centroid up whenever the ring changes (resolved → centroid,
  // cleared → null), so the card pins to the same parcel point.
  useEffect(() => {
    if (ring && ring.length >= 3) {
      onCentroidRef.current?.(ringCentroid(ring));
    } else {
      onCentroidRef.current?.(null);
    }
  }, [ring]);

  // Resolve the polygon when APN changes. /api/parcels/at-point now
  // returns the geometry inline on the click round trip and stashes
  // it in window.__plotParcelGeomCache by APN. If we have a cache hit
  // for this APN, render INSTANTLY — no second network round trip.
  // Cache miss (e.g. APN came from search instead of a click) falls
  // back to /api/parcels/by-apn. Locked 2026-05-30.
  useEffect(() => {
    let cancelled = false;
    setRing(null);
    if (!apn) return;

    const cache = (window as unknown as {
      __plotParcelGeomCache?: Map<string, unknown>;
    }).__plotParcelGeomCache;
    const cached = cache?.get(apn) as GeoJSONGeometry | undefined;
    if (cached) {
      const extracted = extractFirstRing(cached);
      if (extracted) {
        setRing(extracted);
        return;
      }
    }

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
    let stopAnim: (() => void) | null = null;
    let attempt = 0;
    const MAX_ATTEMPTS = 50;
    let createdPoly: Polygon3DElement | null = null;

    const centroid = ringCentroid(ring);

    // One frame: scale every vertex from the centroid outward by
    // `scale`, place the whole ring at `altitude`, and fade the fill.
    const applyFrame = (poly: Polygon3DElement, scale: number, altitude: number, fillOpacity: number) => {
      const path = ring.map((p) => ({
        lat: centroid.lat + (p.lat - centroid.lat) * scale,
        lng: centroid.lng + (p.lng - centroid.lng) * scale,
        altitude,
      }));
      try { poly.path = path; } catch { /* ignore */ }
      try { poly.fillColor = fillAt(fillOpacity); } catch { /* ignore */ }
    };

    // Drive normalized time t: 0 → 1 over TOSS_MS (framer's animate() is
    // used as a clean rAF clock; the MOTION is the ballistic toss curves
    // tossAltitude()/growScale(), not a spring-to-target). The lot is
    // thrown up: launches, decelerates, HANGS at the apex (full-size by
    // then), then falls and settles at rest.
    const animateGrow = (poly: Polygon3DElement) => {
      const controls = animate(0, 1, {
        duration: TOSS_MS / 1000,
        ease: 'linear',
        onUpdate: (t: number) => {
          const scale = growScale(t);
          const altitude = tossAltitude(t);
          // fill in quickly during the launch so the lot is visible as it
          // rises (not invisible until the apex).
          const fillOpacity = Math.max(0, Math.min(1, t * 3)) * PLOT_BLUE_FILL_OPACITY;
          applyFrame(poly, scale, altitude, fillOpacity);
        },
        onComplete: () => {
          // settle exactly on the true ring, resting height + final fill
          applyFrame(poly, 1, LIFT_M, PLOT_BLUE_FILL_OPACITY);
        },
      });
      stopAnim = () => controls.stop();
    };

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
      try { poly.strokeColor = PLOT_BLUE; } catch { /* ignore */ }
      try { poly.strokeWidth = 3; } catch { /* ignore */ }
      try { poly.drawsOccludedSegments = true; } catch { /* ignore */ }
      try { poly.setAttribute('plot-property-highlight', ''); } catch { /* ignore */ }
      // Seed at the centroid (scale 0), at ground level, transparent —
      // so frame 1 is a dot on the ground at the impact point, then it's
      // thrown upward, not a full pop-in.
      applyFrame(poly, 0, 0, 0);

      mapEl.appendChild(poly);
      createdPoly = poly;
      polyRef.current = poly;

      animateGrow(poly);
    };

    tryMount();

    return () => {
      if (retryId !== null) window.clearTimeout(retryId);
      if (stopAnim) { try { stopAnim(); } catch { /* ignore */ } }
      if (createdPoly) {
        try { createdPoly.remove(); } catch { /* already gone */ }
      }
      polyRef.current = null;
    };
  }, [ring, mapElRef]);

  return null;
}
