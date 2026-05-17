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
// Admin-only renderer behind profiles.enable_3d_tiles_admin. Airplane
// physics mirror the 2D path's GamepadFlightController airplane branch:
// throttle/strafe/yaw with accel + drag + max; cubic stick shaping; LB
// pan boost; an idle hover wave so the camera always feels alive.
//
// Two important deviations from a naive Map3D wiring:
//
// 1. Camera is FIRST-PERSON, not orbit. Tilt rotates the view, not the
//    camera's world position. See project_first_person_camera_moat.md.
//    We maintain an apparent camera position; on every tilt/heading
//    change, we shift Map3D's focal-point so the camera stays put.
//
// 2. Zoom lives on LB (in) / RB (out), not triggers. Triggers are
//    reserved for future fire / countermeasure / radar-lock bindings
//    (dogfight mode prep). LB/RB give a gentle, paced zoom that's
//    what real "descend / ascend" feels like.

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// ── Physics constants (copied from the 2D airplane mode) ──────────
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
// PAN_BOOST_MULT lives in the 2D path on LB-hold; we use LB/RB for
// zoom in 3D so the boost is intentionally removed here.

// Hover wave (camera always feels alive even with no stick input).
// Identical values to GamepadFlightController.
const HOVER_HEADING_AMPL = 0.6;
const HOVER_HEADING_FREQ = 0.18;
const HOVER_TILT_AMPL = 0.3;
const HOVER_TILT_FREQ = 0.12;
const HOVER_PAN_AMPL_PX = 1.4;
const HOVER_PAN_FREQ_X = 0.07;
const HOVER_PAN_FREQ_Y = 0.11;

// Zoom on LB (in) / RB (out). Log-scale rate — at this value, one
// second of hold = range changes by 2^2.5 = ~5.7×. Tap-and-release
// nudges the range by ~12%; hold for a beat to make a real altitude
// change. The previous 0.7 was so slow the visual change over a few
// frames was imperceptible.
const ZOOM_RATE_PER_SEC = 2.5;

const TILT_MIN = 0;
const TILT_MAX = 85;
const RANGE_MIN = 1;
const RANGE_MAX = 40000;

const METERS_PER_DEG_LAT = 111_320;

// pan velocity (screen px / sec) → meters at current range. Tuned to
// match the 2D path's perceived speed at typical fly altitude. The 2D
// path's vel.panX is screen pixels at a known zoom level; at range
// ~700m (default 3D seed) the perceived feel should match a typical
// zoom-17 2D session. Anchored empirically — too low felt sluggish,
// too high (the prior failed port) flew past the world.
function metersPerScreenPixel(range: number): number {
  return range / 4500;
}

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

// First-person camera state. This is what the user is actually flying.
// We derive Map3D's orbit parameters (center + range + tilt + heading)
// from this on every write.
interface FpCam {
  // First-person eye position in the world.
  lat: number;
  lng: number;
  altitude: number;        // meters above ground
  // View direction.
  heading: number;         // compass bearing of look direction (degrees)
  pitch: number;           // view pitch (degrees). 0 = looking at horizon,
                           // +60 = looking down 60°, -10 = looking slightly up.
  // Virtual focal distance. Map3D needs a focal point; we keep it at a
  // fixed distance ahead-and-below so range stays consistent across
  // pitch changes (otherwise tiny pitches would explode range).
  range: number;
}

interface AirState { throttle: number; strafe: number; yaw: number; }
interface VelState { panX: number; panY: number; heading: number; tilt: number; }

// Convert first-person eye position + view direction → Map3D's
// {center, range, tilt, heading}. Map3D's center is the focal point
// on the ground that the camera orbits at distance `range`; tilt is
// the angle of the camera-to-focal vector from vertical.
function fpToMap3D(cam: FpCam): {
  center: { lat: number; lng: number; altitude: number };
  heading: number;
  tilt: number;
  range: number;
} {
  // Pitch convention in our model:
  //   pitch =  0  → looking at the horizon
  //   pitch = -45 → looking 45° below horizon (toward ground)
  //   pitch = +5  → looking 5° above horizon (toward sky)
  //
  // Map3D's tilt convention:
  //   tilt =  0  → camera looking straight down at ground (top-down)
  //   tilt = 85  → camera nearly horizontal (Google's hard ceiling)
  //
  // Conversion: map3dTilt = 90 + pitch (since pitch=0 corresponds to
  // tilt=90 = horizon, and pitch<0 corresponds to tilt<90 = look down).
  // Looking up (pitch>0) maps to tilt>90 which Google rejects; we clamp.
  const map3dTilt = clamp(90 + cam.pitch, TILT_MIN, TILT_MAX);

  // Place focal point along the view ray at `range` meters ahead.
  // pitch>0 (looking up) → vertDist positive → focal ABOVE eye.
  // pitch<0 (looking down) → vertDist negative → focal BELOW eye.
  const horizDist = cam.range * Math.cos((cam.pitch * Math.PI) / 180);
  const vertDist = cam.range * Math.sin((cam.pitch * Math.PI) / 180);
  const headingRad = (cam.heading * Math.PI) / 180;
  const dEast = horizDist * Math.sin(headingRad);
  const dNorth = horizDist * Math.cos(headingRad);
  const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
  return {
    center: {
      lat: cam.lat + dNorth / METERS_PER_DEG_LAT,
      lng: cam.lng + dEast / (METERS_PER_DEG_LAT * cosLat),
      altitude: cam.altitude + vertDist,
    },
    heading: cam.heading,
    tilt: map3dTilt,
    range: cam.range,
  };
}

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
  const camRef = useRef<FpCam | null>(null);
  const airRef = useRef<AirState>({ throttle: 0, strafe: 0, yaw: 0 });
  const velRef = useRef<VelState>({ panX: 0, panY: 0, heading: 0, tilt: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elapsedMsRef = useRef<number>(0);

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
    containerRef.current.appendChild(el);
    elRef.current = el;
    // Seed first-person camera at the seed location, ~300m altitude,
    // looking forward + slightly down (pitch -30, so map3d tilt = 60).
    camRef.current = {
      lat: seed.lat, lng: seed.lng, altitude: 300,
      heading: 0, pitch: -30, range: 700,
    };
    airRef.current = { throttle: 0, strafe: 0, yaw: 0 };
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0 };
    // Initial write to Map3D.
    const m3d = fpToMap3D(camRef.current);
    el.center = m3d.center;
    el.heading = m3d.heading;
    el.tilt = m3d.tilt;
    el.range = m3d.range;
    return () => {
      el.remove();
      elRef.current = null;
      camRef.current = null;
    };
  }, [maps3d, center]);

  useGamepad({
    enabled: gamepadEnabled && !!elRef.current,
    onFrame: ({ dt, elapsedMs, leftStick, rightStick, pressed, justPressed }) => {
      const el = elRef.current;
      const cam = camRef.current;
      const air = airRef.current;
      const vel = velRef.current;
      if (!el || !cam) return;

      elapsedMsRef.current = elapsedMs;

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

      // ── LB/RB → zoom (range adjust) ───────────────────────────────
      // LB = zoom in (range shrinks), RB = zoom out (range grows).
      // Log-scale rate so each second of hold roughly halves/doubles.
      if (pressed.has('lb') && !pressed.has('rb')) {
        cam.range = clamp(cam.range * Math.pow(2, -ZOOM_RATE_PER_SEC * dt), RANGE_MIN, RANGE_MAX);
      } else if (pressed.has('rb') && !pressed.has('lb')) {
        cam.range = clamp(cam.range * Math.pow(2,  ZOOM_RATE_PER_SEC * dt), RANGE_MIN, RANGE_MAX);
      }

      // ── Physics integration — same as 2D airplane branch ──────────
      // No LB boost on pan since LB now means zoom. (The 2D path's
      // PAN_BOOST_MULT is preserved as a constant for future use but
      // not applied here.)
      const boost = 1;
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

      // Tilt (right-Y): direct velocity-driven (same as 2D airplane).
      // Stick up (ry < 0) raises view; stick down (ry > 0) lowers view.
      vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boost * dt;
      vel.tilt *= Math.pow(TILT_DRAG, dragExp);
      vel.tilt = clamp(vel.tilt, -TILT_MAX_DEG_S, TILT_MAX_DEG_S);
      if (Math.abs(vel.tilt) < 0.05) vel.tilt = 0;

      // Translate airplane state into pan vel.
      vel.panX = air.strafe;
      vel.panY = -air.throttle;
      vel.heading = air.yaw;

      // ── Idle hover wave (camera always feels alive) ───────────────
      // Identical math to the 2D path. Tiny constant sinusoids on
      // heading, tilt, and screen-pan so even with no stick input the
      // camera breathes. Drowned out during active piloting.
      const tSec = elapsedMs / 1000;
      const hoverHeading = Math.sin(tSec * 2 * Math.PI * HOVER_HEADING_FREQ) * HOVER_HEADING_AMPL;
      const hoverTilt    = Math.sin(tSec * 2 * Math.PI * HOVER_TILT_FREQ)    * HOVER_TILT_AMPL;
      const hoverPanX    = Math.sin(tSec * 2 * Math.PI * HOVER_PAN_FREQ_X)   * HOVER_PAN_AMPL_PX;
      const hoverPanY    = Math.sin(tSec * 2 * Math.PI * HOVER_PAN_FREQ_Y)   * HOVER_PAN_AMPL_PX;

      // ── Apply velocities → first-person camera state ──────────────
      // Pan in screen-pixels/sec → meters in heading-rotated frame.
      const m_per_px = metersPerScreenPixel(cam.range);
      const dxScreenPx = (vel.panX + hoverPanX) * dt;
      const dyScreenPx = (vel.panY + hoverPanY) * dt;
      const dxMeters = dxScreenPx * m_per_px;
      const dyMeters = dyScreenPx * m_per_px;
      const headingRad = (cam.heading * Math.PI) / 180;
      const cosH = Math.cos(headingRad);
      const sinH = Math.sin(headingRad);
      // screen-X (right) → east-component rotated by heading;
      // screen-Y (down) → south, i.e. negative-north.
      const eastMeters  =  dxMeters * cosH - dyMeters * sinH;
      const northMeters = -dxMeters * sinH - dyMeters * cosH;
      const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
      cam.lat += northMeters / METERS_PER_DEG_LAT;
      cam.lng += eastMeters  / (METERS_PER_DEG_LAT * cosLat);

      // Heading + pitch (first-person rotation — camera position stays
      // put, view direction changes). For Map3D this is naturally
      // first-person because we re-derive focal point from current
      // eye position + view direction every frame in fpToMap3D.
      cam.heading = (cam.heading + vel.heading * dt + 360) % 360;
      // Pitch convention: stick-up (ry<0) pitches view UP toward sky;
      // negative pitch = looking down, positive = looking up. Range
      // intentionally wide so we can experiment with low-altitude
      // horizon framing; clamps below come from Map3D's own tilt
      // ceiling, not from us.
      cam.pitch = clamp(cam.pitch + vel.tilt * dt, -89, 89);

      // Apply hover wave as a brief modulation, not accumulating drift.
      const map3d = fpToMap3D({
        ...cam,
        heading: (cam.heading + hoverHeading + 360) % 360,
        pitch: clamp(cam.pitch + hoverTilt, -89, 89),
      });

      // ── Write to element ──────────────────────────────────────────
      el.center  = map3d.center;
      el.heading = map3d.heading;
      el.tilt    = map3d.tilt;
      el.range   = map3d.range;
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
