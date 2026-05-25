'use client';

// MapViewCesium — the cinematic work map rendered with CesiumJS.
//
// Parallel to MapView3D (Map3DElement). Same world, different renderer.
// Cesium gives us things Map3DElement can't:
//   - Volumetric atmospheric scattering + sun lighting + ground fog
//   - Extruded parcel volumes (height encodes value, color encodes use)
//   - Glowing walls along parcel boundaries (territory marking)
//   - Polyline glow materials (tron-line edges)
//   - Drill-pick (reticle through transparent walls to building behind)
//
// Render path: Cesium loaded from CDN via <Script /> (in
// MapViewCesiumLoader). This component reads the runtime off
// window.Cesium. No npm dependency.

import { useEffect, useRef, useState } from 'react';

// Loose runtime shape for window.Cesium — covers the surface this
// component uses without pulling Cesium's full type tree.
type CesiumViewer = {
  destroy: () => void;
  scene: {
    skyAtmosphere: { show: boolean };
    fog: {
      enabled: boolean;
      density: number;
      minimumBrightness: number;
    };
    globe: {
      enableLighting: boolean;
      showGroundAtmosphere: boolean;
      atmosphereLightIntensity: number;
      depthTestAgainstTerrain: boolean;
    };
    backgroundColor: unknown;
    primitives: { add: (p: unknown) => unknown };
    pick: (pos: unknown) => { id?: { id?: string } } | undefined;
    pickPosition: (pos: unknown) => unknown;
  };
  camera: {
    flyTo: (opts: unknown) => void;
    moveEnd: { addEventListener: (cb: () => void) => void; removeEventListener: (cb: () => void) => void };
    computeViewRectangle: () => { west: number; south: number; east: number; north: number } | undefined;
    positionCartographic: { height: number };
  };
  entities: {
    add: (opts: unknown) => unknown;
    removeById: (id: string) => unknown;
  };
  canvas: HTMLCanvasElement;
};

type CesiumGlobal = {
  Ion: { defaultAccessToken: string };
  Viewer: new (container: HTMLElement, options: Record<string, unknown>) => CesiumViewer;
  Cesium3DTileset: { fromIonAssetId: (id: number) => Promise<unknown> };
  Cartesian3: {
    fromDegrees: (lng: number, lat: number, h?: number) => unknown;
    fromDegreesArray: (coords: number[]) => unknown;
  };
  Cartographic: { fromCartesian: (c: unknown) => { latitude: number; longitude: number } };
  Color: { fromCssColorString: (s: string) => { withAlpha: (a: number) => unknown } };
  ColorMaterialProperty: new (color: unknown) => unknown;
  Math: { toRadians: (d: number) => number; toDegrees: (r: number) => number };
  HeightReference: { CLAMP_TO_GROUND: unknown; RELATIVE_TO_GROUND: unknown };
  ScreenSpaceEventHandler: new (canvas: HTMLCanvasElement) => {
    setInputAction: (cb: (event: { position?: unknown; endPosition?: unknown }) => void, type: unknown) => void;
    destroy: () => void;
  };
  ScreenSpaceEventType: { LEFT_CLICK: unknown; MOUSE_MOVE: unknown };
};

// window.Cesium typing comes from src/types/cesium-global.d.ts as
// Record<string, unknown>. We narrow to CesiumGlobal at the call site.

interface Props {
  /** Initial camera target. Cesium will fly here on mount. */
  center?: { lat: number; lng: number } | null;
  /** Initial eye altitude in meters above ground. Default 300m. */
  altitude?: number;
  /** Show parcel polygons as extruded 3D blocks. */
  showParcels?: boolean;
  /** Color coding for extruded parcels. */
  parcelColorMode?: 'value' | 'land_use' | 'flat';
  /** Show glowing walls along parcel boundaries. */
  showParcelWalls?: boolean;
  /** Fires on click of a parcel. */
  onParcelClick?: (apn: string, latLng: { lat: number; lng: number }) => void;
}

// Cesium ion asset IDs.
const PHOTOREAL_TILES_ASSET_ID = 2275207; // Google Photorealistic 3D Tiles

// Parcel viewport-fetch constants — parallel to ParcelOverlay.
const VIEWPORT_MIN_ZOOM = 14;
const VIEWPORT_FETCH_DEBOUNCE_MS = 350;

interface ParcelFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
  properties: {
    apn: string | null;
    address: string | null;
    city: string | null;
    propertyType: string | null;
    yearBuilt: number | null;
    buildingSqft: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    assesseeName: string | null;
    netValue: number | null;
  };
}

interface ParcelResponse {
  type: 'FeatureCollection';
  features: ParcelFeature[];
  truncated: boolean;
}

export default function MapViewCesium({
  center,
  altitude = 300,
  showParcels = true,
  parcelColorMode = 'land_use',
  showParcelWalls = false,
  onParcelClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const cesiumRef = useRef<CesiumGlobal | null>(null);
  const parcelEntityIdsRef = useRef<string[]>([]);
  const wallEntityIdsRef = useRef<string[]>([]);
  const fetchAbortRef = useRef<AbortController | null>(null);
  const fetchDebounceRef = useRef<number | null>(null);
  const loadedApnSetRef = useRef<Set<string>>(new Set());
  const onParcelClickRef = useRef(onParcelClick);
  onParcelClickRef.current = onParcelClick;

  // Capture latest visual-control props in refs so handlers / effects
  // running long after mount read current values without re-creating.
  const showParcelsRef = useRef(showParcels);
  showParcelsRef.current = showParcels;
  const parcelColorModeRef = useRef(parcelColorMode);
  parcelColorModeRef.current = parcelColorMode;
  const showParcelWallsRef = useRef(showParcelWalls);
  showParcelWallsRef.current = showParcelWalls;

  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize viewer once Cesium loads from the CDN.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    function tryInit() {
      if (cancelled) return;
      if (typeof window === 'undefined' || !window.Cesium) {
        setTimeout(tryInit, 100);
        return;
      }
      void init(window.Cesium as unknown as CesiumGlobal);
    }

    async function init(Cesium: CesiumGlobal) {
      try {
        if (!containerRef.current) return;
        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (!token) {
          setLoadError('Cesium token missing');
          return;
        }
        Cesium.Ion.defaultAccessToken = token;
        cesiumRef.current = Cesium;

        const viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          creditContainer: document.createElement('div'),
          // baseLayer false — we replace ground with Google Photoreal 3D Tiles
          baseLayer: false,
        });

        if (cancelled) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;

        // Atmospheric polish.
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0001;
        viewer.scene.fog.minimumBrightness = 0.03;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.globe.atmosphereLightIntensity = 10.0;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0E1626');

        // Google Photorealistic 3D Tiles via Cesium ion.
        try {
          const photoreal = await Cesium.Cesium3DTileset.fromIonAssetId(PHOTOREAL_TILES_ASSET_ID);
          if (!cancelled) {
            viewer.scene.primitives.add(photoreal);
          }
        } catch (err) {
          console.error('[MapViewCesium] Photoreal tiles failed:', err);
        }

        if (cancelled) {
          viewer.destroy();
          return;
        }

        // Initial camera pose.
        const seed = center ?? { lat: 36.3274, lng: -119.6457 }; // Hanford (Kings County center)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(seed.lng, seed.lat, altitude),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-15),
            roll: 0,
          },
          duration: 0,
        });

        // Click handler — pick a parcel entity.
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction((event) => {
          if (!event.position) return;
          const picked = viewer.scene.pick(event.position);
          if (!picked || !picked.id || !picked.id.id) return;
          const entityId = picked.id.id;
          if (!entityId.startsWith('parcel-')) return;
          const apn = entityId.slice('parcel-'.length).split('-')[0];
          const cartesian = viewer.scene.pickPosition(event.position);
          if (!cartesian) return;
          const carto = Cesium.Cartographic.fromCartesian(cartesian);
          const lat = Cesium.Math.toDegrees(carto.latitude);
          const lng = Cesium.Math.toDegrees(carto.longitude);
          onParcelClickRef.current?.(apn, { lat, lng });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((event) => {
          if (!event.endPosition) return;
          const picked = viewer.scene.pick(event.endPosition);
          const canvas = viewer.canvas;
          const isParcel = picked?.id?.id && picked.id.id.startsWith('parcel-');
          canvas.style.cursor = isParcel ? 'pointer' : 'default';
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Viewport change → debounced parcel fetch.
        const onCameraIdle = () => {
          if (fetchDebounceRef.current != null) {
            window.clearTimeout(fetchDebounceRef.current);
          }
          fetchDebounceRef.current = window.setTimeout(() => {
            void fetchParcelsForViewport();
          }, VIEWPORT_FETCH_DEBOUNCE_MS);
        };
        viewer.camera.moveEnd.addEventListener(onCameraIdle);

        // First fetch.
        void fetchParcelsForViewport();

        cleanupFn = () => {
          handler.destroy();
          viewer.camera.moveEnd.removeEventListener(onCameraIdle);
          viewer.destroy();
          viewerRef.current = null;
          cesiumRef.current = null;
        };
      } catch (err) {
        console.error('[MapViewCesium] init failed:', err);
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    tryInit();

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
      if (fetchAbortRef.current) fetchAbortRef.current.abort();
      if (fetchDebounceRef.current != null) window.clearTimeout(fetchDebounceRef.current);
    };
    // Mount-once. Prop changes trigger styling rebuild via the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild parcel styling when controls change.
  useEffect(() => {
    if (!viewerRef.current || !cesiumRef.current) return;
    clearParcelEntities();
    loadedApnSetRef.current.clear();
    void fetchParcelsForViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showParcels, parcelColorMode, showParcelWalls]);

  async function fetchParcelsForViewport() {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;

    const rect = viewer.camera.computeViewRectangle();
    if (!rect) return;

    const minLng = Cesium.Math.toDegrees(rect.west);
    const minLat = Cesium.Math.toDegrees(rect.south);
    const maxLng = Cesium.Math.toDegrees(rect.east);
    const maxLat = Cesium.Math.toDegrees(rect.north);

    // Altitude → approximate zoom level for the viewport API gate.
    const altMeters = viewer.camera.positionCartographic.height;
    const approxZoom = Math.max(0, 22 - Math.log2(Math.max(altMeters, 1) / 0.5));

    if (approxZoom < VIEWPORT_MIN_ZOOM) {
      clearParcelEntities();
      loadedApnSetRef.current.clear();
      return;
    }

    if (fetchAbortRef.current) fetchAbortRef.current.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;

    try {
      const url = `/api/parcels/viewport?bbox=${minLng},${minLat},${maxLng},${maxLat}&zoom=${approxZoom.toFixed(2)}`;
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) return;
      const data: ParcelResponse = await res.json();
      if (ac.signal.aborted) return;
      renderParcels(data.features);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.error('[MapViewCesium] parcel fetch failed:', err);
    }
  }

  function clearParcelEntities() {
    const viewer = viewerRef.current;
    if (!viewer) return;
    for (const id of parcelEntityIdsRef.current) {
      viewer.entities.removeById(id);
    }
    parcelEntityIdsRef.current = [];
    for (const id of wallEntityIdsRef.current) {
      viewer.entities.removeById(id);
    }
    wallEntityIdsRef.current = [];
  }

  function renderParcels(features: ParcelFeature[]) {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    if (!showParcelsRef.current) return;

    for (const feat of features) {
      if (!feat.properties.apn) continue;
      const apn = feat.properties.apn;
      if (loadedApnSetRef.current.has(apn)) continue;
      loadedApnSetRef.current.add(apn);

      const rings = extractRings(feat.geometry);
      if (rings.length === 0) continue;

      const fillColor = colorForParcel(feat.properties, parcelColorModeRef.current, Cesium);
      const extrudeM = extrusionForParcel(feat.properties);

      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i];
        const positions = Cesium.Cartesian3.fromDegreesArray(ring.flat());
        const parcelId = `parcel-${apn}${i > 0 ? `-${i}` : ''}`;

        viewer.entities.add({
          id: parcelId,
          name: feat.properties.address ?? apn,
          polygon: {
            hierarchy: positions,
            material: fillColor,
            outline: false,
            extrudedHeight: extrudeM,
            extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        parcelEntityIdsRef.current.push(parcelId);

        if (showParcelWallsRef.current) {
          const wallPositions = Cesium.Cartesian3.fromDegreesArray(ring.flat());
          const wallId = `wall-${apn}${i > 0 ? `-${i}` : ''}`;
          const wallColor = Cesium.Color.fromCssColorString('#F4C97F');
          viewer.entities.add({
            id: wallId,
            wall: {
              positions: wallPositions,
              maximumHeights: ring.map(() => extrudeM + 6),
              minimumHeights: ring.map(() => 0),
              material: new Cesium.ColorMaterialProperty(wallColor.withAlpha(0.35)),
              outline: true,
              outlineColor: wallColor.withAlpha(0.9),
              outlineWidth: 2,
            },
          });
          wallEntityIdsRef.current.push(wallId);
        }
      }
    }
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0E1626]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Cesium photoreal work map"
      />
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70 font-mono text-sm">
          Cesium failed to load: {loadError}
        </div>
      )}
      <style jsx global>{`
        .cesium-viewer-bottom { display: none !important; }
        .cesium-credit-textContainer,
        .cesium-credit-logoContainer { display: none !important; }
      `}</style>
    </div>
  );
}

// ── Pure helpers ─────────────────────────────────────────────────────

/** GeoJSON Polygon/MultiPolygon → flat array of outer rings ([[lng,lat],...]).
 *  Skips holes (interior rings) for v1. */
function extractRings(geom: ParcelFeature['geometry']): number[][][] {
  if (geom.type === 'Polygon') {
    return geom.coordinates.length > 0 ? [geom.coordinates[0] as number[][]] : [];
  }
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates as number[][][][]).map((poly) => poly[0]);
  }
  return [];
}

/** Extrusion height in meters. Encodes net value on a log scale so a $5M
 *  parcel doesn't dwarf the photoreal buildings. Floor of 8m so unknown
 *  parcels still show as visible volumes. */
function extrusionForParcel(props: ParcelFeature['properties']): number {
  const FLOOR = 8;
  const MAX = 120;
  const v = props.netValue;
  if (v == null) return FLOOR;
  const scaled = 20 + 22 * Math.log10(Math.max(v / 100_000, 1));
  return Math.max(FLOOR, Math.min(MAX, scaled));
}

/** Translucent fill for the parcel block. */
function colorForParcel(
  props: ParcelFeature['properties'],
  mode: 'value' | 'land_use' | 'flat',
  Cesium: CesiumGlobal,
): unknown {
  const c = (hex: string, alpha: number) => Cesium.Color.fromCssColorString(hex).withAlpha(alpha);
  if (mode === 'flat') return c('#F4C97F', 0.35);
  if (mode === 'value') {
    const v = props.netValue ?? 0;
    if (v >= 2_000_000) return c('#C8553D', 0.55);
    if (v >= 1_000_000) return c('#E08A5C', 0.5);
    if (v >= 500_000) return c('#F4C97F', 0.45);
    if (v >= 200_000) return c('#A8C68F', 0.4);
    return c('#5E8FA7', 0.35);
  }
  // land_use
  const t = (props.propertyType ?? '').toLowerCase();
  if (t.includes('single')) return c('#A8C68F', 0.45);
  if (t.includes('multi')) return c('#E08A5C', 0.45);
  if (t.includes('commerc')) return c('#C8553D', 0.5);
  if (t.includes('indust')) return c('#7B5E8C', 0.45);
  if (t.includes('agric') || t.includes('farm')) return c('#D4B670', 0.4);
  if (t.includes('vacant')) return c('#5E8FA7', 0.3);
  return c('#F4C97F', 0.35);
}
