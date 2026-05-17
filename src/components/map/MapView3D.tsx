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
// Admin-only renderer behind profiles.enable_3d_tiles_admin. Same
// gameplay vocabulary as the 2D path (A/X/Y/B/D-pad) and same heavy-
// helicopter airplane physics — velocity + drag + cubic stick
// shaping, glide-to-stop on stick release. Only the camera-write
// step is renderer-specific (Map3D's center/heading/tilt/range vs
// the 2D path's moveCamera()).

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Camera state we own + write each gamepad frame.
interface Map3DCam {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  tilt: number;
  range: number;
}

// Velocity state — heavy-helicopter physics. Throttle/strafe drive
// camera position in heading-rotated space (forward/sideways); yaw
// rotates heading; tilt rotates tilt; zoom adjusts range. Each has
// its own accel + drag + max so the feel can be tuned independently.
interface AirVel {
  throttle: number;   // meters/sec forward/back along heading
  strafe: number;     // meters/sec sideways
  yaw: number;        // deg/sec heading
  tilt: number;       // deg/sec tilt
  zoom: number;       // log-range/sec (multiplicative)
}

// Web-component element type for Map3DElement.
type Map3DElement = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
};

// ── Physics tuning (mirror of the 2D airplane mode, in 3D units) ───
// Throttle/strafe are meters/sec (3D world has real distances) instead
// of the 2D path's screen-pixels/sec. We compute the meters-per-pixel
// equivalent from current range so the perceived feel matches.

// Throttle — forward/back (left-Y). Slow cruise-y decay so a brief
// press carries you forward smoothly.
const THROTTLE_ACCEL_M_S2 = 600;     // m/s² per unit stick at base scale
const THROTTLE_DRAG = 0.965;
const THROTTLE_MAX_M_S = 300;

// Strafe — sideways (left-X). Same shape as throttle so they compose
// when the user hand-compensates yaw with strafe (drone-pilot style).
const STRAFE_ACCEL_M_S2 = 500;
const STRAFE_DRAG = 0.96;
const STRAFE_MAX_M_S = 260;

// Yaw — heading rotation (right-X). Heavy and slow so the world
// turns deliberately.
const YAW_ACCEL_DEG_S2 = 75;
const YAW_DRAG = 0.94;
const YAW_MAX_DEG_S = 30;

// Tilt — camera-pitch (right-Y). More responsive than yaw, less
// inertia. Velocity-driven with drag like everything else.
const TILT_ACCEL_DEG_S2 = 220;
const TILT_DRAG = 0.86;
const TILT_MAX_DEG_S = 70;

// Zoom — log-range/sec. The trigger drives a velocity that decays;
// this gives a satisfying "lean in to swoop, release to coast in"
// feel instead of the hard-stop of pure direct input.
const ZOOM_ACCEL_S2 = 6;
const ZOOM_DRAG = 0.85;
const ZOOM_MAX_S = 2.5;

const TRIGGER_PRESS_THRESHOLD = 0.4;
const TILT_MIN = 0;
const TILT_MAX = 90;
const RANGE_MIN = 1;
const RANGE_MAX = 40000;

// Earth scale.
const METERS_PER_DEG_LAT = 111_320;

// Stick shaping — cubic-ish curve so light touches give light push
// and hard pushes give hard push. This asymmetry is what makes flight
// feel "weighted." Identical to the 2D path.
function shapeStick(v: number): number {
  return Math.sign(v) * Math.pow(Math.abs(v), 1.6);
}

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
  const velRef = useRef<AirVel>({ throttle: 0, strafe: 0, yaw: 0, tilt: 0, zoom: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    el.center = { lat: seed.lat, lng: seed.lng, altitude: 0 };
    el.heading = 0;
    el.tilt = 60;
    el.range = 700;
    containerRef.current.appendChild(el);
    elRef.current = el;
    camRef.current = {
      lat: seed.lat, lng: seed.lng, altitude: 0,
      heading: 0, tilt: 60, range: 700,
    };
    velRef.current = { throttle: 0, strafe: 0, yaw: 0, tilt: 0, zoom: 0 };
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
      const vel = velRef.current;
      if (!el || !cam) return;

      // Drag is computed as drag^(60*dt) so it's frame-rate independent.
      // At 60fps and dt=1/60, drag^1 = drag (its raw value).
      const dragExp = 60 * dt;

      // ── Edge-triggered button actions ─────────────────────────────
      // Identical bindings to the 2D-path controller.
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

      // ── Stick → acceleration (cubic-shaped) ────────────────────────
      const lx = shapeStick(leftStick.x);
      const ly = shapeStick(leftStick.y);
      const rx = shapeStick(rightStick.x);
      const ry = shapeStick(rightStick.y);

      // Throttle (left-Y inverted: stick up = forward). Strafe (left-X).
      vel.throttle += -ly * THROTTLE_ACCEL_M_S2 * dt;
      vel.strafe   +=  lx * STRAFE_ACCEL_M_S2 * dt;
      vel.yaw      +=  rx * YAW_ACCEL_DEG_S2 * dt;
      vel.tilt     += -ry * TILT_ACCEL_DEG_S2 * dt;

      // Drag.
      vel.throttle *= Math.pow(THROTTLE_DRAG, dragExp);
      vel.strafe   *= Math.pow(STRAFE_DRAG, dragExp);
      vel.yaw      *= Math.pow(YAW_DRAG, dragExp);
      vel.tilt     *= Math.pow(TILT_DRAG, dragExp);

      // Caps.
      vel.throttle = clamp(vel.throttle, -THROTTLE_MAX_M_S * 0.4, THROTTLE_MAX_M_S);
      vel.strafe   = clamp(vel.strafe,   -STRAFE_MAX_M_S, STRAFE_MAX_M_S);
      vel.yaw      = clamp(vel.yaw,      -YAW_MAX_DEG_S, YAW_MAX_DEG_S);
      vel.tilt     = clamp(vel.tilt,     -TILT_MAX_DEG_S, TILT_MAX_DEG_S);

      // Dead-zone for residuals — without this, drift can creep when
      // velocities are tiny but non-zero.
      if (Math.abs(vel.throttle) < 0.5) vel.throttle = 0;
      if (Math.abs(vel.strafe)   < 0.5) vel.strafe = 0;
      if (Math.abs(vel.yaw)      < 0.05) vel.yaw = 0;
      if (Math.abs(vel.tilt)     < 0.05) vel.tilt = 0;

      // ── Zoom (triggers → velocity with drag) ───────────────────────
      // LT zooms in (range shrinks → negative log-range delta).
      // RT zooms out (range grows → positive).
      const lt = triggers.left  >= TRIGGER_PRESS_THRESHOLD ? triggers.left  : 0;
      const rt = triggers.right >= TRIGGER_PRESS_THRESHOLD ? triggers.right : 0;
      vel.zoom += (rt - lt) * ZOOM_ACCEL_S2 * dt;
      vel.zoom *= Math.pow(ZOOM_DRAG, dragExp);
      vel.zoom  = clamp(vel.zoom, -ZOOM_MAX_S, ZOOM_MAX_S);
      if (Math.abs(vel.zoom) < 0.005) vel.zoom = 0;

      // ── Apply velocities → camera state ───────────────────────────
      // Throttle + strafe pan the camera in heading-rotated meters.
      // Scale by range so flying at high altitude feels faster than
      // crawling at street level (same screen-pixel feel either way).
      const scale = cam.range / 700;  // anchored at seed range
      const forwardMeters = vel.throttle * dt * scale;
      const sideMeters    = vel.strafe   * dt * scale;
      const headingRad = (cam.heading * Math.PI) / 180;
      const cosH = Math.cos(headingRad);
      const sinH = Math.sin(headingRad);
      const eastMeters  =  sideMeters * cosH + forwardMeters * sinH;
      const northMeters = -sideMeters * sinH + forwardMeters * cosH;
      const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
      cam.lat += northMeters / METERS_PER_DEG_LAT;
      cam.lng += eastMeters / (METERS_PER_DEG_LAT * cosLat);

      // Heading + tilt advance by their velocities.
      cam.heading = (cam.heading + vel.yaw * dt + 360) % 360;
      cam.tilt    = clamp(cam.tilt + vel.tilt * dt, TILT_MIN, TILT_MAX);
      if ((cam.tilt === TILT_MIN && vel.tilt < 0) || (cam.tilt === TILT_MAX && vel.tilt > 0)) {
        vel.tilt = 0;
      }

      // Range advances multiplicatively from zoom velocity.
      // vel.zoom is a log-range/sec — apply as exp() per dt.
      cam.range = clamp(cam.range * Math.exp(vel.zoom * dt), RANGE_MIN, RANGE_MAX);
      if ((cam.range === RANGE_MIN && vel.zoom < 0) || (cam.range === RANGE_MAX && vel.zoom > 0)) {
        vel.zoom = 0;
      }

      // ── Write to element ──────────────────────────────────────────
      el.center  = { lat: cam.lat, lng: cam.lng, altitude: cam.altitude };
      el.heading = cam.heading;
      el.tilt    = cam.tilt;
      el.range   = cam.range;
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
