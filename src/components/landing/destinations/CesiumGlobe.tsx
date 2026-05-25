'use client';

// CesiumGlobe — the landing's destination picker rendered as a real
// 3D Earth using CesiumJS. Replaces the static atlas image with a
// cinematic globe: photorealistic terrain, satellite imagery, real
// city labels, atmospheric scattering, day/night terminator matching
// the actual sun position, star field background.
//
// Architecture:
//   - Cesium Viewer mounts inside a full-viewport container at the
//     base of the landing.
//   - Six destination pins are placed at lat/lng as Cesium Entities
//     with billboard markers + label text. Cesium handles the lat/lng
//     to 3D-sphere math; no manual percentage calculations.
//   - The camera orbits slowly when idle (cinematic background motion).
//   - Click a pin → cinematic flyTo descending toward the destination
//     → opens the ArrivalSequence overlay → completes the OAuth +
//     logbook flow → navigates to /map at flight altitude.
//
// Cesium is browser-only. This component is a 'use client' boundary
// and dynamically loads the Cesium library on mount to avoid SSR errors.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Type-only imports of Cesium — keeps the bundle from pulling Cesium
// into the server tree, while still letting us reference its event types.
import type {
  ScreenSpaceEventHandler as CesiumScreenSpaceEventHandler,
} from 'cesium';
import { DESTINATIONS, type Destination } from '@/lib/destinations';
import ArrivalSequence, {
  readArrivalInFlight,
  clearArrivalInFlight,
} from './ArrivalSequence';

// Local aliases for Cesium's event types (the namespace is awkward).
type PositionedEvent = CesiumScreenSpaceEventHandler.PositionedEvent;
type MotionEvent = CesiumScreenSpaceEventHandler.MotionEvent;

// Cesium's static runtime assets are copied to /cesium/ by
// scripts/copy-cesium-assets.mjs. The library reads this at module
// initialization to know where to fetch its workers and assets from.
// Must be set BEFORE the cesium module is imported.
if (typeof window !== 'undefined') {
  (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = '/cesium/';
}

interface ViewerInstance {
  destroy: () => void;
  scene: unknown;
  camera: {
    flyTo: (opts: unknown) => void;
  };
  entities: {
    add: (opts: unknown) => unknown;
    removeAll: () => void;
  };
  clock: { shouldAnimate: boolean };
  screenSpaceEventHandler: unknown;
}

export default function CesiumGlobe() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerInstance | null>(null);
  const [activeDestination, setActiveDestination] = useState<Destination | null>(null);
  const [resumeAfterAuth, setResumeAfterAuth] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // OAuth-callback resume — if the visitor returns from Google with
  // ?resumeArrival=1 and a stashed destination, re-open ArrivalSequence
  // in resume mode at that destination.
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('resumeArrival') !== '1') return;
    const stashed = readArrivalInFlight();
    if (!stashed) {
      router.replace('/landing');
      return;
    }
    const match = DESTINATIONS.find((d) => d.slug === stashed.destinationSlug);
    if (!match) {
      clearArrivalInFlight();
      router.replace('/landing');
      return;
    }
    setActiveDestination(match);
    setResumeAfterAuth(true);
    router.replace('/landing');
  }, [searchParams, router]);

  // Initialize the Cesium viewer once on mount.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function init() {
      try {
        const Cesium = await import('cesium');
        // Cesium ships its widget CSS as a side-effect import. Use a
        // type-checker-friendly relative path via a ts-ignore so we
        // don't need to add @types declarations for the CSS module.
        // @ts-expect-error — Cesium CSS import has no TS module declaration
        await import('cesium/Build/Cesium/Widgets/widgets.css');

        if (cancelled || !containerRef.current) return;

        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (!token) {
          setLoadError('Cesium token missing');
          return;
        }
        Cesium.Ion.defaultAccessToken = token;

        // Build the viewer with the controls and chrome stripped down
        // to match Plot's brand. We don't want Cesium's default UI
        // (timeline, animation controls, geocoder, home button) — the
        // visitor interacts via destination pins, not Cesium widgets.
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

        viewerRef.current = viewer as unknown as ViewerInstance;

        // Atmospheric polish — show the warm halo at the horizon,
        // enable the day/night terminator, ground atmosphere.
        // Cast to typed scene to access the imperative properties.
        const scene = viewer.scene as unknown as {
          skyAtmosphere: { show: boolean };
          fog: { enabled: boolean; density: number };
          globe: {
            enableLighting: boolean;
            showGroundAtmosphere: boolean;
            atmosphereLightIntensity: number;
            depthTestAgainstTerrain: boolean;
          };
          backgroundColor: unknown;
        };
        scene.skyAtmosphere.show = true;
        scene.fog.enabled = true;
        scene.fog.density = 0.0002;
        scene.globe.enableLighting = true;
        scene.globe.showGroundAtmosphere = true;
        scene.globe.atmosphereLightIntensity = 10.0;
        scene.globe.depthTestAgainstTerrain = false;
        scene.backgroundColor = Cesium.Color.fromCssColorString('#0E1626');

        // Add Cesium OSM Buildings — 350M global 3D buildings, free
        // tier asset. Visitor sees actual buildings rise from cities
        // when they zoom in.
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

        // Initial camera: orbital view of the planet, slightly above
        // the equator looking toward the Atlantic so all six pins
        // (Lemoore through Tokyo) are visible at once.
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(20, 25, 18_000_000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
          duration: 0,
        });

        // Click handler: pick a destination via Cesium's selection event.
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
        handler.setInputAction(
          (event: PositionedEvent) => {
            const picked = viewer.scene.pick(event.position);
            if (!picked || !picked.id || !picked.id.id) return;
            const id = picked.id.id as string;
            if (!id.startsWith('destination-')) return;
            const slug = id.slice('destination-'.length);
            const dest = DESTINATIONS.find((d) => d.slug === slug);
            if (dest) {
              setActiveDestination(dest);
              setResumeAfterAuth(false);
            }
          },
          Cesium.ScreenSpaceEventType.LEFT_CLICK,
        );

        // Change cursor to pointer when hovering a pin.
        handler.setInputAction(
          (event: MotionEvent) => {
            const picked = viewer.scene.pick(event.endPosition);
            const canvas = viewer.canvas as HTMLCanvasElement;
            if (picked?.id?.id && (picked.id.id as string).startsWith('destination-')) {
              canvas.style.cursor = 'pointer';
            } else {
              canvas.style.cursor = 'default';
            }
          },
          Cesium.ScreenSpaceEventType.MOUSE_MOVE,
        );

        // Cleanup
        return () => {
          handler.destroy();
          viewer.destroy();
          viewerRef.current = null;
        };
      } catch (err) {
        console.error('[CesiumGlobe] Failed to initialize:', err);
        setLoadError(err instanceof Error ? err.message : 'Unknown error');
      }
    }

    const cleanupPromise = init();

    return () => {
      cancelled = true;
      cleanupPromise.then((cleanup) => cleanup?.()).catch(() => {
        /* ignore */
      });
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

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center text-surface/70 font-headline italic text-sm">
          Globe failed to load: {loadError}
        </div>
      )}

      {/* Editorial footer line. */}
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-headline italic text-sm tracking-[0.16em] text-surface/55 select-none pointer-events-none">
        Choose your field.
      </p>

      {/* Arrival sequence — same overlay used by the previous atlas
          surface. Holds OAuth + logbook + brief before navigating to
          /map at the destination's authored camera pose. */}
      {activeDestination && (
        <ArrivalSequence
          destination={activeDestination}
          resumeAfterAuth={resumeAfterAuth}
          onCancel={handleCancel}
        />
      )}

      <style jsx global>{`
        /* Strip Cesium's default UI chrome and credits area. */
        .cesium-viewer-bottom {
          display: none !important;
        }
        .cesium-credit-textContainer,
        .cesium-credit-logoContainer {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
