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
// Admin-only renderer behind profiles.enable_3d_tiles_admin. The
// gamepad input model and physics constants are MIRRORED FROM the 2D
// airplane mode in GamepadFlightController.tsx — same accel, drag,
// max, shaping. Only the camera-write step differs: this writes
// Map3D's center/heading/tilt/range; the 2D path writes via
// moveCamera()/setCenter().

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// ── Physics constants (copied verbatim from GamepadFlightController) ─
// These are the airplane-mode tuned values that gave the 2D path its
// heavy-helicopter feel. They translate to 3D unchanged because the
// rendering surface is just a different camera-write target; the
// stick→accel→velocity→drag→position loop is identical.

const AIR_THROTTLE_ACCEL = 700;
const AIR_THROTTLE_DRAG = 0.965;
const AIR_THROTTLE_MAX = 360;
const AIR_STRAFE_ACCEL = 600;
const AIR_STRAFE_DRAG = 0.96;
const AIR_STRAFE_MAX = 320;
const AIR_YAW_ACCEL = 75;
const AIR_YAW_DRAG = 0.94;
const AIR_YAW_MAX = 30;
const TILT_ACCEL_DEG_S2 = 220;
const TILT_DRAG = 0.86;
const TILT_MAX_DEG_S = 70;
const ZOOM_ACCEL_S2 = 8;
const TRIGGER_PRESS_THRESHOLD = 0.4;
const PAN_BOOST_MULT = 2.4;

const TILT_MIN = 0;
const TILT_MAX = 85;
const RANGE_MIN = 1;
const RANGE_MAX = 40000;

const METERS_PER_DEG_LAT = 111_320;

// Stick shaping — identical to GamepadFlightController.shapeStick.
function shapeStick(v: number): number {
  return Math.sign(v) * Math.pow(Math.abs(v), 1.6);
}

function clamp(n: number, lo: number, hi: number) { return n < lo ? lo : n > hi ? hi : n; }

// Web-component element type for Map3DElement.
type Map3DElement = HTMLElement & {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
};

// Owned camera + velocity state.
interface Map3DCam {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  tilt: number;
  range: number;
}

interface AirState { throttle: number; strafe: number; yaw: number; }
interface VelState { panX: number; panY: number; heading: number; tilt: number; zoom: number; }

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
  const airRef = useRef<AirState>({ throttle: 0, strafe: 0, yaw: 0 });
  const velRef = useRef<VelState>({ panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 });
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
    airRef.current = { throttle: 0, strafe: 0, yaw: 0 };
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
    return () => {
      el.remove();
      elRef.current = null;
      camRef.current = null;
    };
  }, [maps3d, center]);

  useGamepad({
    enabled: gamepadEnabled && !!elRef.current,
    onFrame: ({ dt, leftStick, rightStick, triggers, pressed, justPressed }) => {
      const el = elRef.current;
      const cam = camRef.current;
      const air = airRef.current;
      const vel = velRef.current;
      if (!el || !cam) return;

      // ── Edge-triggered button actions (same as 2D) ────────────────
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

      // ── Triggers → zoom delta (same as 2D) ────────────────────────
      let triggerZoomDelta = 0;
      if (triggers.right >= TRIGGER_PRESS_THRESHOLD) triggerZoomDelta -= triggers.right;
      if (triggers.left >= TRIGGER_PRESS_THRESHOLD)  triggerZoomDelta += triggers.left;

      // ── Physics integration — line-for-line mirror of the 2D
      //    airplane branch in GamepadFlightController.tsx ────────────
      const boost = pressed.has('lb') ? PAN_BOOST_MULT : 1;
      const dragExp = 60 * dt;

      const lx = shapeStick(leftStick.x);
      const ly = shapeStick(leftStick.y);
      const rx = shapeStick(rightStick.x);
      const ry = shapeStick(rightStick.y);

      // Airplane state: throttle/strafe/yaw with accel + drag + max.
      air.throttle += -ly * AIR_THROTTLE_ACCEL * boost * dt;
      air.strafe   +=  lx * AIR_STRAFE_ACCEL   * boost * dt;
      air.yaw      +=  rx * AIR_YAW_ACCEL      * boost * dt;
      air.throttle *= Math.pow(AIR_THROTTLE_DRAG, dragExp);
      air.strafe   *= Math.pow(AIR_STRAFE_DRAG,   dragExp);
      air.yaw      *= Math.pow(AIR_YAW_DRAG,      dragExp);
      air.throttle = clamp(air.throttle, -AIR_THROTTLE_MAX * 0.4, AIR_THROTTLE_MAX);
      air.strafe   = clamp(air.strafe,   -AIR_STRAFE_MAX, AIR_STRAFE_MAX);
      air.yaw      = clamp(air.yaw,      -AIR_YAW_MAX, AIR_YAW_MAX);
      if (Math.abs(air.throttle) < 0.5) air.throttle = 0;
      if (Math.abs(air.strafe)   < 0.5) air.strafe = 0;
      if (Math.abs(air.yaw)      < 0.05) air.yaw = 0;

      // Tilt: direct velocity-driven (same as 2D airplane: vel.tilt -= ry).
      vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boost * dt;
      vel.tilt *= Math.pow(TILT_DRAG, dragExp);
      vel.tilt = clamp(vel.tilt, -TILT_MAX_DEG_S, TILT_MAX_DEG_S);
      if (Math.abs(vel.tilt) < 0.05) vel.tilt = 0;

      // Translate airplane state into the shared vel struct (same as 2D).
      vel.panX = air.strafe;
      vel.panY = -air.throttle;
      vel.heading = air.yaw;

      // Zoom is trigger-driven, with its own velocity + drag (same as 2D).
      vel.zoom = triggerZoomDelta * ZOOM_ACCEL_S2 * boost * dt;
      // Note: 2D path uses moveCamera with absolute zoom delta this frame
      // rather than a persistent zoom velocity; we mirror exactly.

      // ── Apply velocity → camera state ─────────────────────────────
      // 2D path converts vel.panX/panY (screen pixels/sec) to lat/lng
      // using meters-per-pixel = 1 / (2 ^ zoom) via projection math. We
      // do the equivalent for Map3D: at range R and a typical 35° FOV,
      // visible-width ≈ 2 * R * tan(17.5°) ≈ 0.63 * R meters. For an
      // 800-pixel-wide viewport, metersPerPx ≈ R / 1270. So a screen-
      // pixel velocity translates 1:1 to a meters velocity scaled by
      // current range. Same screen feel at any altitude.
      const metersPerPx = cam.range / 1270;

      const dxScreenPx = vel.panX * dt;  // screen pixels this frame
      const dyScreenPx = vel.panY * dt;
      const dxMeters = dxScreenPx * metersPerPx;
      const dyMeters = dyScreenPx * metersPerPx;

      // Rotate by heading: pan-X is screen-right, pan-Y is screen-down.
      // In 3D world, that's a vector in heading-rotated meters.
      const headingRad = (cam.heading * Math.PI) / 180;
      const cosH = Math.cos(headingRad);
      const sinH = Math.sin(headingRad);
      // screen-right ≈ heading + 90°. screen-up (-dy) ≈ heading.
      const eastMeters  =  dxMeters * cosH - dyMeters * sinH;
      const northMeters =  dxMeters * sinH + dyMeters * cosH;
      const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
      cam.lat -= northMeters / METERS_PER_DEG_LAT;
      cam.lng += eastMeters  / (METERS_PER_DEG_LAT * cosLat);

      // Heading + tilt (same accumulation as 2D).
      cam.heading = (cam.heading + vel.heading * dt + 360) % 360;
      cam.tilt = clamp(cam.tilt + vel.tilt * dt, TILT_MIN, TILT_MAX);
      if ((cam.tilt === TILT_MIN && vel.tilt < 0) || (cam.tilt === TILT_MAX && vel.tilt > 0)) {
        vel.tilt = 0;
      }

      // Zoom maps to range. 2D path uses zoom levels (log scale, ~3-21);
      // a positive vel.zoom delta means zoom in (lower zoom number? no,
      // 2D vel.zoom positive = zoom in = closer = higher zoom number).
      // For Map3D, zoom in = range shrinks. So a positive vel.zoom this
      // frame should DECREASE range. Match the 2D path's clamp behavior.
      // Scale: 2D vel.zoom is at most ZOOM_MAX_S * dt ≈ 0.027 zoom-
      // levels per frame; one zoom level ~= 2x range. Mirror by treating
      // vel.zoom as a log2-range velocity: range *= 2^(-vel.zoom * dt).
      if (vel.zoom !== 0) {
        const factor = Math.pow(2, -vel.zoom);
        cam.range = clamp(cam.range * factor, RANGE_MIN, RANGE_MAX);
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
