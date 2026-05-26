'use client';

// CesiumGlobe — the landing's destination picker.
//
// This is NOT a viewer-owning component. It's a layer over Plot's
// persistent Cesium viewer (CesiumViewerProvider). On mount it:
//   - Activates the viewer (downloads Cesium CDN, constructs viewer)
//   - Frames the camera at orbital altitude looking straight down
//   - Adds destination pin entities + a click handler
//
// On destination select, the *Cesium camera itself* starts flying
// from orbit toward the destination's authored pose, and ArrivalSequence
// mounts as a chrome overlay over the descending viewer. The form is
// the cockpit; the descending world is the view through the window.
// When the form completes, the overlay dismisses — no navigation, no
// reload, no map remount. The user is already at the destination.
//
// On unmount (route change away from /landing), the pin entities and
// click handler are cleaned up, but the viewer itself stays alive
// across the route boundary.

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  LANDING_DESTINATIONS as DESTINATIONS,
  findDestinationBySlug,
  type Destination,
} from '@/lib/destinations';
import { useCesiumViewer } from '@/lib/cesium/CesiumViewerProvider';
import ArrivalSequence, {
  readArrivalInFlight,
  clearArrivalInFlight,
} from './ArrivalSequence';

// Narrow runtime types for just the surface this component touches on
// the shared viewer.
type ViewerLite = {
  scene: {
    pick: (pos: unknown) => { id?: { id?: string } } | undefined;
  };
  camera: {
    flyTo: (opts: {
      destination: unknown;
      orientation?: { heading: number; pitch: number; roll: number };
      duration?: number;
      easingFunction?: unknown;
    }) => void;
  };
  entities: {
    add: (opts: unknown) => { id: string };
    removeById: (id: string) => unknown;
  };
  canvas: HTMLCanvasElement;
};

type CesiumLite = {
  Cartesian3: { fromDegrees: (lng: number, lat: number, h?: number) => unknown };
  Cartesian2: new (x: number, y: number) => unknown;
  Color: { fromCssColorString: (s: string) => unknown };
  Math: { toRadians: (deg: number) => number };
  HeightReference: { CLAMP_TO_GROUND: unknown };
  LabelStyle: { FILL_AND_OUTLINE: unknown };
  EasingFunction: { QUADRATIC_IN_OUT: unknown };
  ScreenSpaceEventHandler: new (canvas: HTMLCanvasElement) => {
    setInputAction: (
      cb: (event: { position?: unknown; endPosition?: unknown }) => void,
      type: unknown,
    ) => void;
    destroy: () => void;
  };
  ScreenSpaceEventType: { LEFT_CLICK: unknown; MOUSE_MOVE: unknown };
};

export default function CesiumGlobe() {
  const searchParams = useSearchParams();
  const { ready, viewer, Cesium } = useCesiumViewer({ activate: true });
  const [activeDestination, setActiveDestination] = useState<Destination | null>(null);
  const [resumeAfterAuth, setResumeAfterAuth] = useState(false);

  // OAuth-callback resume — if the visitor returns with ?resumeArrival=1
  // and we have a destination slug (URL ?dest= preferred, localStorage
  // fallback), re-open ArrivalSequence in resume mode.
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('resumeArrival') !== '1') return;
    const slugFromUrl = searchParams.get('dest');
    const stashed = !slugFromUrl ? readArrivalInFlight() : null;
    const slug = slugFromUrl ?? stashed?.destinationSlug ?? null;
    if (!slug) return;
    const match = findDestinationBySlug(slug);
    if (!match) {
      clearArrivalInFlight();
      return;
    }
    setActiveDestination(match);
    setResumeAfterAuth(true);
  }, [searchParams]);

  // Once the viewer is ready, add pin entities, set orbital camera,
  // attach click handler. On unmount, tear them down.
  useEffect(() => {
    if (!ready || !viewer || !Cesium) return;

    const v = viewer as ViewerLite;
    const C = Cesium as CesiumLite;

    // Frame the camera at orbital altitude looking straight down.
    // 18,000 km altitude gives a planet-from-space view; pitch -90 is
    // top-down so the visible hemisphere is the world map.
    v.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(20, 25, 18_000_000),
      orientation: {
        heading: 0,
        pitch: C.Math.toRadians(-90),
        roll: 0,
      },
      duration: 0,
    });

    // Place destination pins.
    const addedIds: string[] = [];
    for (const dest of DESTINATIONS) {
      const entity = v.entities.add({
        id: `destination-${dest.slug}`,
        name: dest.name,
        position: C.Cartesian3.fromDegrees(dest.pose.lng, dest.pose.lat, 0),
        point: {
          pixelSize: 14,
          color: C.Color.fromCssColorString('#F4C97F'),
          outlineColor: C.Color.fromCssColorString('#C8553D'),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: dest.name,
          font: '600 12px "Geist Sans", Inter, sans-serif',
          fillColor: C.Color.fromCssColorString('#F4EAD5'),
          outlineColor: C.Color.fromCssColorString('#0E1626'),
          outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, -22),
          showBackground: false,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
        },
      });
      addedIds.push(entity.id);
    }

    // Click handler on the shared canvas. Picks a destination pin and
    // (a) sets activeDestination so the ArrivalSequence overlay mounts,
    // (b) kicks off the cinematic Cesium camera flight from orbit toward
    // the destination's authored pose. Both happen in parallel — the
    // descent runs underneath the form.
    const handler = new C.ScreenSpaceEventHandler(v.canvas);
    handler.setInputAction((event) => {
      if (!event.position) return;
      const picked = v.scene.pick(event.position);
      if (!picked || !picked.id || !picked.id.id) return;
      const id = picked.id.id;
      if (!id.startsWith('destination-')) return;
      const slug = id.slice('destination-'.length);
      const dest = findDestinationBySlug(slug);
      if (!dest) return;

      setActiveDestination(dest);
      setResumeAfterAuth(false);

      // Begin the cinematic descent. ~8 seconds from orbit through the
      // atmosphere into the destination's authored pose. Cesium streams
      // photoreal tiles in as the camera descends; by the time the
      // visitor finishes the questions form, the city is fully resolved
      // and the camera is at the authored framing.
      v.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(
          dest.pose.lng,
          dest.pose.lat,
          dest.pose.altitude,
        ),
        orientation: {
          heading: C.Math.toRadians(dest.pose.heading),
          pitch: C.Math.toRadians(dest.pose.pitch),
          roll: 0,
        },
        duration: 8.0,
        easingFunction: C.EasingFunction.QUADRATIC_IN_OUT,
      });
    }, C.ScreenSpaceEventType.LEFT_CLICK);

    // Cursor feedback on pin hover.
    handler.setInputAction((event) => {
      if (!event.endPosition) return;
      const picked = v.scene.pick(event.endPosition);
      const canvas = v.canvas;
      if (picked?.id?.id && picked.id.id.startsWith('destination-')) {
        canvas.style.cursor = 'pointer';
      } else {
        canvas.style.cursor = 'default';
      }
    }, C.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
      for (const id of addedIds) {
        v.entities.removeById(id);
      }
    };
  }, [ready, viewer, Cesium]);

  // Resume-after-auth flight — same as a fresh click, but triggered by
  // the post-OAuth resume effect having set activeDestination.
  useEffect(() => {
    if (!ready || !viewer || !Cesium) return;
    if (!activeDestination || !resumeAfterAuth) return;

    const v = viewer as ViewerLite;
    const C = Cesium as CesiumLite;
    v.camera.flyTo({
      destination: C.Cartesian3.fromDegrees(
        activeDestination.pose.lng,
        activeDestination.pose.lat,
        activeDestination.pose.altitude,
      ),
      orientation: {
        heading: C.Math.toRadians(activeDestination.pose.heading),
        pitch: C.Math.toRadians(activeDestination.pose.pitch),
        roll: 0,
      },
      duration: 8.0,
      easingFunction: C.EasingFunction.QUADRATIC_IN_OUT,
    });
  }, [ready, viewer, Cesium, activeDestination, resumeAfterAuth]);

  const handleCancel = useCallback(() => {
    setActiveDestination(null);
    setResumeAfterAuth(false);
    clearArrivalInFlight();
    // Return the camera to orbit.
    if (ready && viewer && Cesium) {
      const v = viewer as ViewerLite;
      const C = Cesium as CesiumLite;
      v.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(20, 25, 18_000_000),
        orientation: {
          heading: 0,
          pitch: C.Math.toRadians(-90),
          roll: 0,
        },
        duration: 2.5,
      });
    }
  }, [ready, viewer, Cesium]);

  return (
    <>
      {!ready && <LoadingStage />}

      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-headline italic text-sm tracking-[0.16em] text-surface/55 select-none pointer-events-none z-10">
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
    </>
  );
}

// ── Loading stage ────────────────────────────────────────────────────
// Shown while Cesium's CDN bundle downloads and the persistent viewer
// initializes. Once the viewer is ready (which on subsequent /landing
// visits is instant because the viewer never unmounted), this hides.
function LoadingStage() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-10">
      <svg
        width="84"
        height="84"
        viewBox="0 0 84 84"
        fill="none"
        aria-hidden
        style={{ animation: 'plot-globe-loading-spin 6s linear infinite' }}
      >
        <circle
          cx="42"
          cy="42"
          r="36"
          stroke="rgba(244, 234, 213, 0.5)"
          strokeWidth="1"
          fill="none"
          style={{ animation: 'plot-globe-loading-breathe 2.4s ease-in-out infinite' }}
        />
        <circle cx="42" cy="42" r="18" stroke="rgba(244, 234, 213, 0.7)" strokeWidth="1" fill="none" />
        <line x1="42" y1="10" x2="42" y2="26" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        <line x1="42" y1="58" x2="42" y2="74" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        <line x1="10" y1="42" x2="26" y2="42" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        <line x1="58" y1="42" x2="74" y2="42" stroke="rgba(244, 234, 213, 0.65)" strokeWidth="1" />
        <circle cx="42" cy="42" r="1.5" fill="rgba(244, 201, 127, 0.95)" />
        <text
          x="42"
          y="6"
          fontFamily="Geist Mono, monospace"
          fontSize="6"
          fill="rgba(244, 234, 213, 0.5)"
          textAnchor="middle"
        >
          N
        </text>
      </svg>
      <p className="mt-6 font-headline italic text-xs tracking-[0.18em] text-surface/55">
        Loading the world…
      </p>
      <style jsx global>{`
        @keyframes plot-globe-loading-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes plot-globe-loading-breathe {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
