"use client";

import { useEffect, useRef } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MAP_CENTER } from "@/lib/constants";
import { useGamepad } from "@/lib/useGamepad";
import type { MapViewProps } from "./MapView";

// ── Photorealistic 3D Tiles surface (Map3DElement / <gmp-map-3d>) ───
//
// Admin-only renderer behind profiles.enable_3d_tiles_admin. This is a
// completely different Google API surface from the standard Maps JS
// API — billed per session against the Google Cloud project, with
// real photogrammetric buildings, terrain, and 0-90° tilt.
//
// First-cut scope (this commit): mount the element, fly it with the
// gamepad, see the world. Pins, parcels, reticle hit-test, and the
// PropertyPopup integration land in follow-up commits — getting Greg
// flying the real 3D world is what unlocks his ability to feel the
// experience and decide tier/pricing.

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Map3D camera state we own + write each gamepad frame. The element's
// own properties (center, heading, tilt, range) are read on first
// frame to seed this; we then drive all subsequent motion from this
// owned state so the gamepad input doesn't fight the element's own
// inertia.
interface Map3DCam {
  lat: number;
  lng: number;
  altitude: number;   // meters above ground; element treats this as part of center
  heading: number;    // degrees clockwise from north
  tilt: number;       // 0 = looking down, 90 = horizon
  range: number;      // meters from center; smaller = closer
}

// Web-component element type — declare loosely since the React types
// from @vis.gl/react-google-maps don't ship a wrapper for Map3DElement
// yet. We talk to it as an HTMLElement with a known property surface.
type Map3DElement = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
  flyCameraTo?: (opts: { endCamera: { center: { lat: number; lng: number; altitude: number }; heading: number; tilt: number; range: number }; durationMillis: number }) => void;
};

// Tuning. Numbers chosen to feel close to the existing airplane mode
// while taking advantage of the 3D Tiles surface (real altitude, full
// tilt). Can re-tune from there.
const RANGE_MIN = 80;          // meters from center; close-in
const RANGE_MAX = 8000;        // meters; wide flyover
const PAN_PIXELS_PER_SEC = 700;
const YAW_DEG_PER_SEC = 90;
const TILT_DEG_PER_SEC = 70;
const RANGE_FACTOR_PER_SEC = 1.8;  // multiplicative zoom rate per held trigger
const TILT_MIN = 0;
const TILT_MAX = 85;

// Approximate meters-per-degree at the seed latitude. Good enough for
// continuous-input gamepad panning — the visual feedback drowns out
// any latitude-dependent error at small steps.
const METERS_PER_DEG_LAT = 111_320;

function clamp(n: number, lo: number, hi: number) { return n < lo ? lo : n > hi ? hi : n; }

// Inner component — mounted under APIProvider so useMapsLibrary works.
function Inner({
  center,
  gamepadEnabled,
}: {
  center?: { lat: number; lng: number } | null;
  gamepadEnabled: boolean;
}) {
  const maps3d = useMapsLibrary('maps3d');
  const elRef = useRef<Map3DElement | null>(null);
  const camRef = useRef<Map3DCam | null>(null);

  // Seed the element once the maps3d library has loaded. We create it
  // imperatively (the web component is `<gmp-map-3d>`) and mount it
  // into our container div so we don't have to wrestle with React
  // typing for an alpha web component.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!maps3d || !containerRef.current) return;
    if (elRef.current) return;
    const seed = center ?? MAP_CENTER;
    // Create the element. The custom-element registration happens
    // inside the maps3d library load; by the time useMapsLibrary
    // returns non-null, `gmp-map-3d` is defined.
    const el = document.createElement('gmp-map-3d') as Map3DElement;
    el.style.width = '100%';
    el.style.height = '100%';
    el.setAttribute('mode', 'hybrid');                       // photoreal + labels
    el.setAttribute('default-labels-disabled', 'false');
    el.center = { lat: seed.lat, lng: seed.lng, altitude: 250 };
    el.heading = 0;
    el.tilt = 60;
    el.range = 700;
    containerRef.current.appendChild(el);
    elRef.current = el;
    camRef.current = {
      lat: seed.lat,
      lng: seed.lng,
      altitude: 250,
      heading: 0,
      tilt: 60,
      range: 700,
    };
    return () => {
      el.remove();
      elRef.current = null;
      camRef.current = null;
    };
  }, [maps3d, center]);

  // Gamepad → Map3D camera. We own the cam state and write it each
  // frame; element reads its visible state from our writes. Sticks
  // pan/yaw, right stick tilts, triggers adjust range.
  useGamepad({
    enabled: gamepadEnabled && !!elRef.current,
    onFrame: ({ dt, leftStick, rightStick, triggers }) => {
      const el = elRef.current;
      const cam = camRef.current;
      if (!el || !cam) return;

      // Left stick: pan in screen-space. X = strafe, Y = throttle along
      // heading. Convert pixel velocity to meters by anchoring on the
      // current range (range ~ approximately the "altitude" the camera
      // is reading from; wider range = each pixel covers more ground).
      const lx = leftStick.x;
      const ly = leftStick.y;
      const rx = rightStick.x;
      const ry = rightStick.y;

      const metersPerPx = cam.range / 1000;
      const dxMeters = lx * PAN_PIXELS_PER_SEC * metersPerPx * dt;
      const dyMeters = -ly * PAN_PIXELS_PER_SEC * metersPerPx * dt;

      // Rotate strafe/throttle by heading so "forward" is the camera's
      // forward direction, not absolute north.
      const headingRad = (cam.heading * Math.PI) / 180;
      const cosH = Math.cos(headingRad);
      const sinH = Math.sin(headingRad);
      const eastMeters = dxMeters * cosH + dyMeters * sinH;
      const northMeters = -dxMeters * sinH + dyMeters * cosH;

      // Apply meters-per-degree at this latitude.
      const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
      const dLat = northMeters / METERS_PER_DEG_LAT;
      const dLng = eastMeters / (METERS_PER_DEG_LAT * cosLat);
      cam.lat += dLat;
      cam.lng += dLng;

      // Right stick X = yaw, Y = tilt.
      cam.heading = (cam.heading + rx * YAW_DEG_PER_SEC * dt + 360) % 360;
      cam.tilt = clamp(cam.tilt - ry * TILT_DEG_PER_SEC * dt, TILT_MIN, TILT_MAX);

      // Triggers: LT zooms in (range shrinks), RT zooms out.
      if (triggers.left > 0.05 || triggers.right > 0.05) {
        const inRate = triggers.left * RANGE_FACTOR_PER_SEC;
        const outRate = triggers.right * RANGE_FACTOR_PER_SEC;
        const factor = Math.pow(1 / (1 + inRate), dt) * Math.pow(1 + outRate, dt);
        cam.range = clamp(cam.range * factor, RANGE_MIN, RANGE_MAX);
      }

      // Write to the element. Map3DElement reads these as live
      // properties; setting them moves the camera that frame.
      el.center = { lat: cam.lat, lng: cam.lng, altitude: cam.altitude };
      el.heading = cam.heading;
      el.tilt = cam.tilt;
      el.range = cam.range;
    },
  });

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      // gmp-map-3d is positioned absolutely once mounted; the container
      // gives it a sized parent. Background while the library loads so
      // we don't see a flash of unstyled void.
      style={{ background: '#0a1020' }}
    />
  );
}

// Public component — APIProvider boundary with maps3d in the loaded
// libraries. Same shape as MapView so MapDynamic can swap between
// them by reading the admin flag.
export default function MapView3D(props: MapViewProps) {
  return (
    <APIProvider apiKey={API_KEY} libraries={['places', 'marker', 'maps3d']}>
      <Inner
        center={props.center}
        gamepadEnabled={!!props.gamepadEnabled}
      />
    </APIProvider>
  );
}
