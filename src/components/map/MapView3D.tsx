"use client";

import { useEffect, useMemo, useRef } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MAP_CENTER } from "@/lib/constants";
import { useGamepad } from "@/lib/useGamepad";
import type { ButtonName } from "@/lib/gamepadActions";
import type { MapViewProps } from "./MapView";
import type { GamepadActions } from "./GamepadFlightController";

// ── Photorealistic 3D Tiles surface (Map3DElement / <gmp-map-3d>) ───
//
// Admin-only renderer behind profiles.enable_3d_tiles_admin. This is a
// completely different Google API surface from the standard Maps JS
// API — billed per session against the Google Cloud project, with
// real photogrammetric buildings, terrain, and 0-90° tilt.
//
// Control parity with the 2D path: A/X/Y/B/D-pad bindings are the
// same as GamepadFlightController. Page never has to know which
// surface is rendering — same actions object flows through. Only the
// camera-write step differs (Map3DElement camera properties instead
// of map.moveCamera()).

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Map3D camera state we own + write each gamepad frame. Mirrors the
// camRef shape inside GamepadFlightController so the input handling
// can stay structurally similar.
interface Map3DCam {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  tilt: number;
  range: number;
}

// Web-component element type. The React types from
// @vis.gl/react-google-maps don't ship a wrapper for Map3DElement
// yet; we talk to it as an HTMLElement with known property surface.
type Map3DElement = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
};

// Tuning matched to the 2D-path airplane mode in spirit (heavy
// helicopter, decay-driven), translated to Map3DElement's units.
// Range (meters from center) replaces zoom-level; pan-meters replaces
// pan-pixels at a scale anchored on the current range.
const RANGE_MIN = 80;
const RANGE_MAX = 8000;
const PAN_BASE_PIXELS_PER_SEC = 700;
const YAW_DEG_PER_SEC = 90;
const TILT_DEG_PER_SEC = 70;
const RANGE_FACTOR_PER_SEC = 1.8;
const TILT_MIN = 0;
const TILT_MAX = 85;
const METERS_PER_DEG_LAT = 111_320;
const TRIGGER_PRESS_THRESHOLD = 0.4;

function clamp(n: number, lo: number, hi: number) { return n < lo ? lo : n > hi ? hi : n; }

// Inner component — mounted under APIProvider so useMapsLibrary works.
function Inner({
  center,
  gamepadEnabled,
  gamepadActions,
}: {
  center?: { lat: number; lng: number } | null;
  gamepadEnabled: boolean;
  gamepadActions?: GamepadActions;
}) {
  const maps3d = useMapsLibrary('maps3d');
  const elRef = useRef<Map3DElement | null>(null);
  const camRef = useRef<Map3DCam | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pin latest actions through a ref so the gamepad loop can read them
  // without re-subscribing every render. Same pattern as the 2D path.
  const actionsRef = useRef<GamepadActions | undefined>(gamepadActions);
  actionsRef.current = gamepadActions;

  // Mount the gmp-map-3d element once the maps3d library is loaded.
  useEffect(() => {
    if (!maps3d || !containerRef.current) return;
    if (elRef.current) return;
    const seed = center ?? MAP_CENTER;
    const el = document.createElement('gmp-map-3d') as Map3DElement;
    el.style.width = '100%';
    el.style.height = '100%';
    el.setAttribute('mode', 'hybrid');
    el.setAttribute('default-labels-disabled', 'false');
    el.center = { lat: seed.lat, lng: seed.lng, altitude: 250 };
    el.heading = 0;
    el.tilt = 60;
    el.range = 700;
    containerRef.current.appendChild(el);
    elRef.current = el;
    camRef.current = {
      lat: seed.lat, lng: seed.lng, altitude: 250,
      heading: 0, tilt: 60, range: 700,
    };
    return () => {
      el.remove();
      elRef.current = null;
      camRef.current = null;
    };
  }, [maps3d, center]);

  useGamepad({
    enabled: gamepadEnabled && !!elRef.current,
    onFrame: ({ dt, leftStick, rightStick, triggers, justPressed }) => {
      const el = elRef.current;
      const cam = camRef.current;
      if (!el || !cam) return;

      // ── Edge-triggered button actions ─────────────────────────────
      // Identical bindings to the 2D-path controller. A=shoot,
      // X=rotate channel, Y=inspect, B=cancel, D-pad cycles.
      // Same actions object the page builds and passes through.
      if (justPressed.size > 0) {
        const fire = (name: ButtonName, fn?: () => void) => {
          if (justPressed.has(name) && fn) fn();
        };
        fire('a', actionsRef.current?.onShoot);
        fire('x', actionsRef.current?.onRotateChannel);
        fire('y', actionsRef.current?.onInspect);
        fire('b', actionsRef.current?.onCancel);
        if (justPressed.has('up') || justPressed.has('left')) actionsRef.current?.onCyclePrev?.();
        if (justPressed.has('down') || justPressed.has('right')) actionsRef.current?.onCycleNext?.();
      }

      // ── Pan (left stick) — meters in heading-rotated frame ─────────
      const lx = leftStick.x;
      const ly = leftStick.y;
      const metersPerPx = cam.range / 1000;
      const dxMeters = lx * PAN_BASE_PIXELS_PER_SEC * metersPerPx * dt;
      const dyMeters = -ly * PAN_BASE_PIXELS_PER_SEC * metersPerPx * dt;
      const headingRad = (cam.heading * Math.PI) / 180;
      const cosH = Math.cos(headingRad);
      const sinH = Math.sin(headingRad);
      const eastMeters = dxMeters * cosH + dyMeters * sinH;
      const northMeters = -dxMeters * sinH + dyMeters * cosH;
      const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
      cam.lat += northMeters / METERS_PER_DEG_LAT;
      cam.lng += eastMeters / (METERS_PER_DEG_LAT * cosLat);

      // ── Yaw (right-X) + Tilt (right-Y) ─────────────────────────────
      cam.heading = (cam.heading + rightStick.x * YAW_DEG_PER_SEC * dt + 360) % 360;
      cam.tilt = clamp(cam.tilt - rightStick.y * TILT_DEG_PER_SEC * dt, TILT_MIN, TILT_MAX);

      // ── Range (LT zoom in / RT zoom out) ───────────────────────────
      if (triggers.left >= TRIGGER_PRESS_THRESHOLD || triggers.right >= TRIGGER_PRESS_THRESHOLD) {
        const inRate = triggers.left * RANGE_FACTOR_PER_SEC;
        const outRate = triggers.right * RANGE_FACTOR_PER_SEC;
        const factor = Math.pow(1 / (1 + inRate), dt) * Math.pow(1 + outRate, dt);
        cam.range = clamp(cam.range * factor, RANGE_MIN, RANGE_MAX);
      }

      // ── Write to element ──────────────────────────────────────────
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
      style={{ background: '#0a1020' }}
    />
  );
}

// Public component — APIProvider boundary with maps3d in the loaded
// libraries. Same shape as MapView so MapDynamic can swap between
// them by reading the admin flag.
export default function MapView3D(props: MapViewProps) {
  // Avoid re-mounting <Inner> every render — the element creation
  // effect should fire only once per session.
  const memoCenter = useMemo(() => props.center ?? null, [props.center]);
  return (
    <APIProvider apiKey={API_KEY} libraries={['places', 'marker', 'maps3d']}>
      <Inner
        center={memoCenter}
        gamepadEnabled={!!props.gamepadEnabled}
        gamepadActions={props.gamepadActions}
      />
    </APIProvider>
  );
}
