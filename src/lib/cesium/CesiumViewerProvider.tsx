'use client';

// CesiumViewerProvider — the persistent Cesium viewer for all of Plot.
//
// Plot has ONE Cesium viewer. It mounts once at the layout level and
// stays alive across route changes. Every Cesium-using surface in the
// app — the landing globe, the in-map work view, the arrival flight,
// future dogfight and commerce overlays — is just chrome over this
// one viewer.
//
// Why this exists:
//   - "Map is the application" — the user's relationship to the world
//     is continuous. Routing should never break the camera. A click
//     from the landing globe down into a city is a single Cesium
//     camera flight, not a navigation between two pages with two
//     separate viewers, two separate tile streams, two separate
//     atmospheric setups.
//   - Cesium's startup cost is real (CDN load + token validation +
//     tileset request + initial tile decode). Paying it once, on
//     first Cesium-using page load, and never again, is what makes
//     the cinematic match-cut arrival possible.
//   - Tile cache stays warm. The destination flight from globe to
//     Acapulco streams tiles in during descent; arriving at the work
//     map afterward, those same tiles are still in memory.
//
// Architecture:
//   - The provider lives near the top of the React tree (in
//     ClientProviders / RootLayout). It manages viewer lifecycle.
//   - The viewer's canvas lives in a fixed-position <div> that sits
//     behind page chrome. Pointer events pass through to the canvas
//     except where chrome wants to capture them.
//   - Children call useCesiumViewer() to get the viewer + Cesium
//     namespace. Hook returns null until the viewer is ready, so
//     callers must guard.
//   - Layer components (CesiumGlobe pin layer, work-map parcel layer,
//     etc.) take a viewer ref and add/remove entities on mount/unmount.
//     They don't create viewers; they read this one.
//
// Mounting policy:
//   - The provider lazy-loads Cesium from CDN. The first time any child
//     calls useCesiumViewer(), the load kicks off. Until then we pay
//     nothing — non-Cesium pages don't incur Cesium's cost.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Script from 'next/script';

// Loose typing for the surface this provider exposes. Layer components
// import the full CesiumGlobal type from their own narrow declarations
// when they need specific subnamespaces.
//
// We intentionally don't pull in @types/cesium — Cesium is loaded at
// runtime from CDN, not from npm. Component-level narrow types are
// the contract.
export type CesiumViewer = unknown;
export type CesiumGlobal = unknown;

const CESIUM_VERSION = '1.141';
const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

// Cesium ion asset IDs.
const PHOTOREAL_TILES_ASSET_ID = 2275207; // Google Photorealistic 3D Tiles

interface CesiumContextValue {
  /** True once the CDN script has loaded and the viewer is constructed. */
  ready: boolean;
  /** The viewer instance, or null until ready. */
  viewer: CesiumViewer | null;
  /** The Cesium namespace (window.Cesium), or null until ready. */
  Cesium: CesiumGlobal | null;
  /** Container div for the viewer's canvas — for chrome that needs to
   *  position itself relative to the rendering surface. */
  containerRef: React.RefObject<HTMLDivElement>;
}

const CesiumContext = createContext<CesiumContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  /** When true, the provider mounts the Cesium script + viewer immediately
   *  on first render. When false (default), it waits for a child to opt
   *  in by calling useCesiumViewer({ activate: true }). Non-Cesium pages
   *  pay nothing. */
  eagerMount?: boolean;
}

export function CesiumViewerProvider({ children, eagerMount = false }: ProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumViewer | null>(null);
  const cesiumRef = useRef<CesiumGlobal | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [activated, setActivated] = useState(eagerMount);
  const [ready, setReady] = useState(false);

  // Initialize the viewer once the CDN script reports loaded AND
  // someone has activated the viewer (eagerly or via a child opt-in).
  useEffect(() => {
    if (!scriptLoaded || !activated) return;
    if (!containerRef.current) return;
    if (viewerRef.current) return; // already constructed

    let cancelled = false;

    function tryInit() {
      if (cancelled) return;
      if (typeof window === 'undefined' || !window.Cesium) {
        setTimeout(tryInit, 100);
        return;
      }
      void init(window.Cesium as Record<string, unknown>);
    }

    async function init(Cesium: Record<string, unknown>) {
      try {
        if (!containerRef.current) return;
        const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
        if (!token) {
          console.error('[CesiumViewerProvider] NEXT_PUBLIC_CESIUM_ION_TOKEN missing');
          return;
        }
        const ion = Cesium.Ion as { defaultAccessToken: string };
        ion.defaultAccessToken = token;

        const ViewerCtor = Cesium.Viewer as new (
          container: HTMLElement,
          options: Record<string, unknown>,
        ) => unknown;

        const viewer = new ViewerCtor(containerRef.current, {
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
          baseLayer: false,
        });

        if (cancelled) {
          (viewer as { destroy: () => void }).destroy();
          return;
        }

        // Atmospheric polish — same settings the standalone work map
        // used, applied once here so every layer renders against the
        // same lighting.
        const v = viewer as {
          scene: {
            skyAtmosphere: { show: boolean };
            fog: { enabled: boolean; density: number; minimumBrightness: number };
            globe: {
              enableLighting: boolean;
              showGroundAtmosphere: boolean;
              atmosphereLightIntensity: number;
              depthTestAgainstTerrain: boolean;
            };
            backgroundColor: unknown;
            primitives: { add: (p: unknown) => unknown };
          };
        };

        v.scene.skyAtmosphere.show = true;
        v.scene.fog.enabled = true;
        v.scene.fog.density = 0.0001;
        v.scene.fog.minimumBrightness = 0.03;
        v.scene.globe.enableLighting = true;
        v.scene.globe.showGroundAtmosphere = true;
        v.scene.globe.atmosphereLightIntensity = 10.0;
        v.scene.globe.depthTestAgainstTerrain = true;
        const Color = Cesium.Color as {
          fromCssColorString: (s: string) => unknown;
        };
        v.scene.backgroundColor = Color.fromCssColorString('#0E1626');

        // Google Photorealistic 3D Tiles. Streams in as the camera
        // descends; orbital view still works without tiles loaded.
        try {
          const TilesetCtor = Cesium.Cesium3DTileset as {
            fromIonAssetId: (id: number) => Promise<unknown>;
          };
          const photoreal = await TilesetCtor.fromIonAssetId(PHOTOREAL_TILES_ASSET_ID);
          if (!cancelled) {
            v.scene.primitives.add(photoreal);
          }
        } catch (err) {
          console.error('[CesiumViewerProvider] Photoreal tiles failed:', err);
        }

        if (cancelled) {
          (viewer as { destroy: () => void }).destroy();
          return;
        }

        viewerRef.current = viewer;
        cesiumRef.current = Cesium;
        setReady(true);
      } catch (err) {
        console.error('[CesiumViewerProvider] init failed:', err);
      }
    }

    tryInit();

    return () => {
      cancelled = true;
      // We deliberately do NOT destroy the viewer here. The provider's
      // whole point is that the viewer survives unmount/remount cycles
      // of the children. Destruction only happens on full page tear-down,
      // which the browser handles for us.
    };
  }, [scriptLoaded, activated]);

  return (
    <CesiumContext.Provider
      value={{
        ready,
        viewer: viewerRef.current,
        Cesium: cesiumRef.current,
        containerRef,
      }}
    >
      {/* Only render the Cesium runtime script + container when at least
          one child has activated the viewer. Non-Cesium pages pay no
          download cost. */}
      {activated && (
        <>
          <link rel="stylesheet" href={`${CESIUM_BASE}/Widgets/widgets.css`} />
          <Script
            src={`${CESIUM_BASE}/Cesium.js`}
            strategy="afterInteractive"
            onLoad={() => setScriptLoaded(true)}
          />
          {/* The persistent viewer container. Sits behind chrome at z-0.
              Pages that don't want the viewer visible (auth screens, etc)
              cover it with their own chrome at z-10+. */}
          <div
            ref={containerRef}
            className="fixed inset-0 z-0"
            aria-hidden={!ready}
            style={{ background: '#0E1626' }}
          />
        </>
      )}

      {/* Activator: any child that calls useCesiumViewer({ activate: true })
          will trigger setActivated(true) via the consumer below. */}
      <ActivationBridge onActivate={() => setActivated(true)} />

      {children}
    </CesiumContext.Provider>
  );
}

// ── Internal: lets useCesiumViewer({activate:true}) flip the activated
// state without making every child write to a setter directly. ──────
const ActivationContext = createContext<(() => void) | null>(null);

function ActivationBridge({ onActivate }: { onActivate: () => void }) {
  return <ActivationContext.Provider value={onActivate}>{null}</ActivationContext.Provider>;
}

// ── Public hooks ──────────────────────────────────────────────────────

interface UseCesiumOptions {
  /** When true, activates the viewer if not already active. Pages that
   *  need Cesium pass true; layers that are just decorating a viewer
   *  that's already there can pass false (or omit). */
  activate?: boolean;
}

/** Subscribe to the persistent Cesium viewer.
 *  Returns null fields until the viewer is ready. */
export function useCesiumViewer(opts: UseCesiumOptions = {}): CesiumContextValue {
  const ctx = useContext(CesiumContext);
  const activate = useContext(ActivationContext);

  useEffect(() => {
    if (opts.activate && activate) {
      activate();
    }
  }, [opts.activate, activate]);

  if (!ctx) {
    throw new Error('useCesiumViewer must be used inside CesiumViewerProvider');
  }
  return ctx;
}
