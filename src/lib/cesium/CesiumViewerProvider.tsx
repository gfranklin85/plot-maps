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
//     is continuous. Routing should never break the camera.
//   - Cesium's startup cost is real (CDN load + token validation +
//     tileset request + initial tile decode). Paying it once, on first
//     Cesium-using page load, and never again, is what makes the
//     cinematic match-cut arrival possible.
//
// Architecture:
//   - The provider lives near the top of the React tree.
//   - The viewer's canvas lives in a fixed-position <div> rendered at
//     the provider level. The ref to that div is stable across renders.
//   - Children call useCesiumViewer({ activate: true }) to opt in.
//     Activation triggers the CDN script load and viewer construction.
//   - Layer components read viewer + Cesium namespace via useCesiumViewer()
//     and add/remove their entities on mount/unmount. They never create
//     viewers themselves.
//
// Lifecycle ordering (the bug we fixed in v2):
//   - The container div MUST exist before the script loads, so the ref
//     is non-null when the viewer constructor needs it. Earlier we
//     conditionally rendered the div inside an {activated && ...} block,
//     which meant the ref was null on the first render after activation
//     and the viewer never initialized.
//   - The Script tag uses next/script's onReady (fires both on initial
//     load and on remount of an already-loaded script), so re-mounting
//     the provider doesn't break things.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Script from 'next/script';

export type CesiumViewer = unknown;
export type CesiumGlobal = unknown;

const CESIUM_VERSION = '1.141';
const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;
const PHOTOREAL_TILES_ASSET_ID = 2275207;

interface CesiumContextValue {
  ready: boolean;
  viewer: CesiumViewer | null;
  Cesium: CesiumGlobal | null;
  containerRef: React.RefObject<HTMLDivElement>;
  /** Called by useCesiumViewer({activate:true}). Idempotent. */
  activate: () => void;
}

const CesiumContext = createContext<CesiumContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  /** When true, the provider mounts the Cesium script + viewer
   *  immediately. When false (default), it waits for a child to
   *  call useCesiumViewer({ activate: true }). Non-Cesium pages
   *  pay nothing until something needs the viewer. */
  eagerMount?: boolean;
}

export function CesiumViewerProvider({ children, eagerMount = false }: ProviderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initStartedRef = useRef(false);
  const [activated, setActivated] = useState(eagerMount);
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const [cesium, setCesium] = useState<CesiumGlobal | null>(null);
  const ready = viewer !== null && cesium !== null;

  const activate = useCallback(() => {
    setActivated((prev) => prev || true);
  }, []);

  // Initialize the viewer. Triggered after activation by either:
  //   - the Script's onReady (which fires both on initial load AND on
  //     remount if Cesium is already on window)
  //   - the activated state flipping true (covers the case where the
  //     script was already loaded before activation, e.g. fast nav back
  //     to a Cesium page)
  const tryInit = useCallback(() => {
    if (initStartedRef.current) return;
    if (typeof window === 'undefined') return;
    if (!window.Cesium) return;
    if (!containerRef.current) return;
    if (!activated) return;
    initStartedRef.current = true;

    const Cesium = window.Cesium as Record<string, unknown>;

    void (async () => {
      try {
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

        const viewer = new ViewerCtor(containerRef.current!, {
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
        const Color = Cesium.Color as { fromCssColorString: (s: string) => unknown };
        v.scene.backgroundColor = Color.fromCssColorString('#0E1626');

        // Photoreal tiles. Streams in as the camera descends; the globe
        // view still renders without them, so we don't block on this.
        try {
          const TilesetCtor = Cesium.Cesium3DTileset as {
            fromIonAssetId: (id: number) => Promise<unknown>;
          };
          const photoreal = await TilesetCtor.fromIonAssetId(PHOTOREAL_TILES_ASSET_ID);
          v.scene.primitives.add(photoreal);
        } catch (err) {
          console.error('[CesiumViewerProvider] Photoreal tiles failed:', err);
        }

        setViewer(viewer);
        setCesium(Cesium);
      } catch (err) {
        console.error('[CesiumViewerProvider] init failed:', err);
        initStartedRef.current = false;
      }
    })();
  }, [activated]);

  // Retry init whenever activation flips or the script reports ready.
  // The dependency on `activated` covers the case where Cesium was
  // already loaded on the window (e.g. SPA nav back to a Cesium page);
  // tryInit's internal guards prevent double-construction.
  useEffect(() => {
    tryInit();
  }, [tryInit, activated]);

  // Render order matters:
  //   1. Container div FIRST so containerRef is bound before Script
  //      onReady fires.
  //   2. Script SECOND, after container is in the DOM.
  //   3. Children LAST, so they can call useCesiumViewer freely.
  return (
    <CesiumContext.Provider
      value={{
        ready,
        viewer,
        Cesium: cesium,
        containerRef,
        activate,
      }}
    >
      {/* The persistent container. Always rendered (so the ref is stable),
          but display:none until activated so it doesn't take pointer
          events or render cost on non-Cesium pages. */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-0"
        aria-hidden={!ready}
        style={{
          background: '#0E1626',
          display: activated ? 'block' : 'none',
        }}
      />

      {activated && (
        <>
          {/* eslint-disable-next-line @next/next/no-css-tags */}
          <link rel="stylesheet" href={`${CESIUM_BASE}/Widgets/widgets.css`} />
          <Script
            src={`${CESIUM_BASE}/Cesium.js`}
            strategy="afterInteractive"
            onReady={tryInit}
          />
        </>
      )}

      {children}
    </CesiumContext.Provider>
  );
}

// ── Public hook ──────────────────────────────────────────────────────

interface UseCesiumOptions {
  /** Opt this page/component into the persistent viewer. Pages that
   *  need Cesium pass true; transient consumers can pass false to
   *  read-only-if-already-active. */
  activate?: boolean;
}

export function useCesiumViewer(opts: UseCesiumOptions = {}): CesiumContextValue {
  const ctx = useContext(CesiumContext);
  if (!ctx) {
    throw new Error('useCesiumViewer must be used inside CesiumViewerProvider');
  }
  const { activate } = ctx;
  useEffect(() => {
    if (opts.activate) activate();
  }, [opts.activate, activate]);
  return ctx;
}
