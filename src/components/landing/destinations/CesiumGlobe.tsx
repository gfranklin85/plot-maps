'use client';

// CesiumGlobe — the landing's destination picker rendered as a real
// 3D Earth via CesiumJS loaded from Cesium's CDN.
//
// Why CDN instead of npm: Cesium is a 3MB+ library that doesn't ship
// cleanly through Next.js's webpack code-splitting. The official
// Cesium quickstart recommends CDN loading for exactly this kind of
// integration. CesiumGlobeLoader injects the <Script> tag; this
// component reads the runtime off the global window.Cesium.
//
// Architecture:
//   - Cesium Viewer mounts inside a full-viewport container.
//   - Six destination pins are placed at lat/lng as Cesium Entities
//     with point + label markers.
//   - Click a pin → opens ArrivalSequence (OAuth + logbook + brief)
//     → after completion, navigates to /map at the destination's
//     authored camera pose.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { DESTINATIONS, type Destination } from '@/lib/destinations';
import ArrivalSequence, {
  readArrivalInFlight,
  clearArrivalInFlight,
} from './ArrivalSequence';

// Loose runtime types for window.Cesium — we don't pull Cesium's own
// type definitions because that would mean reinstalling the npm package
// and getting tangled in the bundling problem again. These types cover
// just the surface this component uses.
type CesiumViewer = {
  destroy: () => void;
  scene: {
    skyAtmosphere: { show: boolean };
    fog: { enabled: boolean; density: number };
    globe: {
      enableLighting: boolean;
      showGroundAtmosphere: boolean;
      atmosphereLightIntensity: number;
      depthTestAgainstTerrain: boolean;
    };
    backgroundColor: unknown;
    primitives: { add: (p: unknown) => unknown };
    pick: (pos: unknown) => { id?: { id?: string } } | undefined;
  };
  camera: { flyTo: (opts: unknown) => void };
  entities: { add: (opts: unknown) => unknown };
  canvas: HTMLCanvasElement;
};

type CesiumGlobal = {
  Ion: { defaultAccessToken: string };
  Viewer: new (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => CesiumViewer;
  Terrain: { fromWorldTerrain: () => unknown };
  Cartesian3: { fromDegrees: (lng: number, lat: number, h?: number) => unknown };
  Cartesian2: new (x: number, y: number) => unknown;
  Color: { fromCssColorString: (s: string) => unknown };
  Math: { toRadians: (deg: number) => number };
  HeightReference: { CLAMP_TO_GROUND: unknown };
  LabelStyle: { FILL_AND_OUTLINE: unknown };
  ScreenSpaceEventHandler: new (canvas: HTMLCanvasElement) => {
    setInputAction: (cb: (event: { position?: unknown; endPosition?: unknown }) => void, type: unknown) => void;
    destroy: () => void;
  };
  ScreenSpaceEventType: { LEFT_CLICK: unknown; MOUSE_MOVE: unknown };
  createOsmBuildingsAsync: () => Promise<unknown>;
};

// window.Cesium typing comes from src/types/cesium-global.d.ts as
// Record<string, unknown>. We narrow to CesiumGlobal at the call site.

export default function CesiumGlobe() {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const [activeDestination, setActiveDestination] = useState<Destination | null>(null);
  const [resumeAfterAuth, setResumeAfterAuth] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // OAuth-callback resume — if the visitor returns with ?resumeArrival=1
  // and a stashed destination, re-open ArrivalSequence in resume mode.
  // Note: we deliberately keep ?resumeArrival=1 in the URL until the
  // ArrivalSequence completes and navigates to /map. Stripping it here
  // would cause middleware's "authenticated user on /landing → redirect
  // to /" rule to bounce the visitor to the dashboard mid-sequence.
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('resumeArrival') !== '1') return;
    const stashed = readArrivalInFlight();
    if (!stashed) return;
    const match = DESTINATIONS.find((d) => d.slug === stashed.destinationSlug);
    if (!match) {
      clearArrivalInFlight();
      return;
    }
    setActiveDestination(match);
    setResumeAfterAuth(true);
  }, [searchParams]);

  // Wait for window.Cesium to be loaded (from CDN via <Script> in the
  // CesiumGlobeLoader), then initialize the viewer.
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
          setStatus('error');
          setErrorMessage('Cesium token missing');
          return;
        }
        Cesium.Ion.defaultAccessToken = token;

        const viewer = new Cesium.Viewer(containerRef.current, {
          terrain: Cesium.Terrain.fromWorldTerrain(),
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
        });

        if (cancelled) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;

        // Atmospheric polish.
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0002;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.showGroundAtmosphere = true;
        viewer.scene.globe.atmosphereLightIntensity = 10.0;
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0E1626');

        // Cesium OSM Buildings — 350M global 3D buildings.
        try {
          const buildings = await Cesium.createOsmBuildingsAsync();
          if (!cancelled) {
            viewer.scene.primitives.add(buildings);
          }
        } catch {
          // Non-fatal — globe still renders without buildings.
        }

        if (cancelled) {
          viewer.destroy();
          return;
        }

        // Place destination pins.
        for (const dest of DESTINATIONS) {
          viewer.entities.add({
            id: `destination-${dest.slug}`,
            name: dest.name,
            position: Cesium.Cartesian3.fromDegrees(dest.lng, dest.lat, 0),
            point: {
              pixelSize: 14,
              color: Cesium.Color.fromCssColorString('#F4C97F'),
              outlineColor: Cesium.Color.fromCssColorString('#C8553D'),
              outlineWidth: 2,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            label: {
              text: dest.name,
              font: '600 12px "Geist Sans", Inter, sans-serif',
              fillColor: Cesium.Color.fromCssColorString('#F4EAD5'),
              outlineColor: Cesium.Color.fromCssColorString('#0E1626'),
              outlineWidth: 3,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -22),
              showBackground: false,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          });
        }

        // Initial camera — orbital view of the planet.
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(20, 25, 18_000_000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
          duration: 0,
        });

        // Click handler — pick a destination.
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction((event) => {
          if (!event.position) return;
          const picked = viewer.scene.pick(event.position);
          if (!picked || !picked.id || !picked.id.id) return;
          const id = picked.id.id;
          if (!id.startsWith('destination-')) return;
          const slug = id.slice('destination-'.length);
          const dest = DESTINATIONS.find((d) => d.slug === slug);
          if (dest) {
            setActiveDestination(dest);
            setResumeAfterAuth(false);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((event) => {
          if (!event.endPosition) return;
          const picked = viewer.scene.pick(event.endPosition);
          const canvas = viewer.canvas;
          if (picked?.id?.id && picked.id.id.startsWith('destination-')) {
            canvas.style.cursor = 'pointer';
          } else {
            canvas.style.cursor = 'default';
          }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        cleanupFn = () => {
          handler.destroy();
          viewer.destroy();
          viewerRef.current = null;
        };

        setStatus('ready');
      } catch (err) {
        console.error('[CesiumGlobe] Failed to initialize:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    tryInit();

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
    };
  }, []);

  const handleCancel = useCallback(() => {
    setActiveDestination(null);
    setResumeAfterAuth(false);
    clearArrivalInFlight();
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0E1626]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Interactive globe — pick a destination to fly"
      />

      {status === 'loading' && <LoadingStage />}

      {status === 'error' && errorMessage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-headline italic text-sm text-surface/70">
            Globe failed to load: {errorMessage}
          </p>
        </div>
      )}

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-headline italic text-sm tracking-[0.16em] text-surface/55 select-none pointer-events-none">
        Choose your field.
      </p>

      {activeDestination && (
        <ArrivalSequence
          destination={activeDestination}
          resumeAfterAuth={resumeAfterAuth}
          onCancel={handleCancel}
        />
      )}

      <style jsx global>{`
        .cesium-viewer-bottom { display: none !important; }
        .cesium-credit-textContainer,
        .cesium-credit-logoContainer { display: none !important; }
      `}</style>
    </div>
  );
}

// ── Loading stage ────────────────────────────────────────────────────
// Cinematic loading state while Cesium's CDN bundle downloads and the
// viewer initializes. A slowly-rotating surveyor's reticle (the same
// theodolite geometry as the PlotMaps wordmark O) sits centered with
// a faint pulse, paired with editorial type cycling through a short
// list of approach lines. Stays consistent with Plot's brand voice
// instead of a generic spinner.
function LoadingStage() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
      <svg
        width="84"
        height="84"
        viewBox="0 0 84 84"
        fill="none"
        aria-hidden
        style={{ animation: 'plot-globe-loading-spin 6s linear infinite' }}
      >
        {/* Outer reticle ring */}
        <circle
          cx="42"
          cy="42"
          r="36"
          stroke="rgba(244, 234, 213, 0.5)"
          strokeWidth="1"
          fill="none"
          style={{ animation: 'plot-globe-loading-breathe 2.4s ease-in-out infinite' }}
        />
        {/* Inner aperture */}
        <circle
          cx="42"
          cy="42"
          r="18"
          stroke="rgba(244, 234, 213, 0.7)"
          strokeWidth="1"
          fill="none"
        />
        {/* Crosshair */}
        <line x1="42" y1="10" x2="42" y2="26" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        <line x1="42" y1="58" x2="42" y2="74" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        <line x1="10" y1="42" x2="26" y2="42" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        <line x1="58" y1="42" x2="74" y2="42" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        {/* Center point */}
        <circle cx="42" cy="42" r="1.5" fill="rgba(244, 201, 127, 0.95)" />
        {/* Compass N */}
        <text
          x="42"
          y="6"
          textAnchor="middle"
          fontSize="6"
          fontFamily="var(--font-geist-sans), Inter, sans-serif"
          fontWeight="600"
          letterSpacing="0.18em"
          fill="rgba(244, 234, 213, 0.7)"
        >
          N
        </text>
      </svg>

      <p
        className="mt-6 font-headline italic text-[11px] sm:text-xs tracking-[0.32em] uppercase text-surface/55"
        style={{ animation: 'plot-globe-loading-text 3.6s ease-in-out infinite' }}
      >
        Surveying the world
      </p>

      <style jsx global>{`
        @keyframes plot-globe-loading-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes plot-globe-loading-breathe {
          0%, 100% {
            opacity: 1;
            stroke-width: 1;
          }
          50% {
            opacity: 0.55;
            stroke-width: 1.4;
          }
        }
        @keyframes plot-globe-loading-text {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.9;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          svg[aria-hidden] {
            animation: none !important;
          }
          p[style*="plot-globe-loading-text"] {
            animation: none !important;
            opacity: 0.7 !important;
          }
        }
      `}</style>
    </div>
  );
}
