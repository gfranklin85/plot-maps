'use client';

// CesiumFlightController — gamepad-driven flight over the persistent
// Cesium viewer.
//
// Lets the user fly themselves from orbit to street level (and back) with
// a controller. Replaces the destinations-panel "click to fly here"
// shortcut as the *primary* way to navigate the planet, with pins as a
// fallback for non-controller users.
//
// Design principles:
//   - Altitude-coupled velocity. Speed scales logarithmically with
//     altitude so the controller feels right at every scale:
//       18,000 km orbit → 5,000 km/s (planet spins under you)
//       10 km cruise   → 5 km/s (Mach 15)
//       400 m city     → 50 m/s (flyover)
//       10 m street    → 5 m/s (walking pace)
//   - One axis at a time. Every input axis has a feature flag (left-X,
//     left-Y, right-X, right-Y, LT, RT). Disabling an axis isolates
//     it for tuning when something feels wrong.
//   - Camera state owned by THIS component. We seed from the Cesium
//     camera on first frame, integrate ourselves, write back. We don't
//     read-back-then-write per frame (that introduces rounding drift).
//   - Cesium-native math. Camera position is in Cartesian; we work in
//     lat/lng/altitude and convert at write time. Heading and pitch are
//     in degrees in our state, radians at Cesium's edge.
//
// Stick mapping (matches the Map3D 'airplane' controller's vocabulary so
// muscle memory carries over):
//   - Left stick X  : strafe (perpendicular to heading)
//   - Left stick Y  : throttle (forward along heading)
//   - Right stick X : yaw (rotate heading)
//   - Right stick Y : pitch (rotate look up/down)
//   - LT            : descend (altitude down)
//   - RT            : climb (altitude up)
//
// Mount once at the layout level (or per Cesium-using page). Reads the
// shared viewer from CesiumViewerProvider.

import { useEffect, useRef } from 'react';
import { useGamepad } from '@/lib/useGamepad';
import { useCesiumViewer } from '@/lib/cesium/CesiumViewerProvider';

// ── Tuning constants ─────────────────────────────────────────────────
// First-pass values. Greg flies these, we adjust live. Each constant has
// a comment with what it "feels like" at the extremes so we know which
// knob to turn when something's wrong.

// Altitude-coupled velocity scaling.
//   velocity (m/s) = ALT_COUPLE_BASE * altitudeMeters^ALT_COUPLE_EXP
// At alt=400m  → ~50 m/s     (city flyover, ~110 mph)
// At alt=10km  → ~5 km/s     (Mach 15, cruise the state in seconds)
// At alt=100km → ~50 km/s    (orbital reentry pace)
// At alt=18Mm  → ~5,000 km/s (planet spin)
const ALT_COUPLE_BASE = 0.08;
const ALT_COUPLE_EXP = 0.85;
// Hard floor on velocity so very-low-altitude (street level) flight
// doesn't go to literally zero.
const MIN_TRANSLATION_RATE_MPS = 5;

// Stick → acceleration ramps. Cubic shaping so light touches give light
// push (precision composing on landing approach), full peg gives full
// push (planet-crossing at altitude).
const STICK_SHAPE_EXP = 1.6;
function shapeStick(v: number): number {
  return Math.sign(v) * Math.pow(Math.abs(v), STICK_SHAPE_EXP);
}

// Rotation rates. Independent of altitude — yaw and pitch feel the same
// whether at orbit or street level.
const YAW_RATE_DEG_S = 60;   // deg/s at full right-stick-X
const PITCH_RATE_DEG_S = 45; // deg/s at full right-stick-Y

// Climb/descend rate, altitude-coupled (you climb faster at altitude so
// it doesn't feel like the trigger does nothing at 5km).
const CLIMB_RATE_BASE = 0.4;
const CLIMB_RATE_EXP = 0.9;

// Pitch clamp. Looking straight down (-90) and straight up (+89) are
// allowed; we just stop short of true zenith/nadir to avoid gimbal
// weirdness.
const PITCH_MIN_DEG = -89;
const PITCH_MAX_DEG = 85;

// Altitude clamp. Floor is 2m above ground (don't crash into terrain);
// ceiling is ~20,000 km (well past low-earth orbit, gives slack for
// "zoomed all the way out").
const ALT_MIN_M = 2;
const ALT_MAX_M = 20_000_000;

// Camera invariant: heading 0 = north, 90 = east. We store heading as
// 0..360 wrapped.
function wrapHeading(h: number): number {
  return ((h % 360) + 360) % 360;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Component ────────────────────────────────────────────────────────

interface AxisFlags {
  leftStick?: boolean;   // translation (strafe + throttle)
  rightStick?: boolean;  // rotation (yaw + pitch)
  triggers?: boolean;    // altitude (climb/descend)
}

interface Props {
  /** Pause the controller (e.g. when an overlay form has focus). */
  enabled?: boolean;
  /** Enable/disable individual axes for tuning. Defaults: all on. */
  axes?: AxisFlags;
  /** User-facing speed multiplier (slider). 1.0 = baseline. */
  speedMultiplier?: number;
  /** User-facing turn-rate multiplier. 1.0 = baseline. */
  turnRateMultiplier?: number;
}

// Cesium runtime types we touch.
type ViewerLite = {
  camera: {
    position: unknown;
    /** Heading in radians (Cesium native). 0 = north, π/2 = east. */
    heading: number;
    /** Pitch in radians (Cesium native). 0 = horizon, -π/2 = nadir. */
    pitch: number;
    flyTo: (opts: unknown) => void;
    setView: (opts: {
      destination: unknown;
      orientation: { heading: number; pitch: number; roll: number };
    }) => void;
  };
};

type CesiumLite = {
  Cartesian3: {
    fromDegrees: (lng: number, lat: number, h: number) => unknown;
  };
  Cartographic: {
    fromCartesian: (c: unknown) => { latitude: number; longitude: number; height: number };
  };
  Math: { toRadians: (deg: number) => number; toDegrees: (rad: number) => number };
};

export default function CesiumFlightController({
  enabled = true,
  axes = { leftStick: true, rightStick: true, triggers: true },
  speedMultiplier = 1.0,
  turnRateMultiplier = 1.0,
}: Props) {
  const { ready, viewer, Cesium } = useCesiumViewer();

  // Our owned camera state. Seeded from the viewer on the first frame
  // we have a viewer; cleared whenever the viewer instance changes
  // (shouldn't happen during normal use — the viewer is persistent —
  // but the seed-on-first-frame pattern is the safe one).
  const camRef = useRef<{
    lat: number;
    lng: number;
    alt: number;
    heading: number;
    pitch: number;
  } | null>(null);

  // Latest-prop refs so the input loop reads current values without
  // tearing down on every parent re-render.
  const axesRef = useRef(axes);
  axesRef.current = axes;
  const speedMulRef = useRef(speedMultiplier);
  speedMulRef.current = speedMultiplier;
  const turnRateMulRef = useRef(turnRateMultiplier);
  turnRateMulRef.current = turnRateMultiplier;

  // Reset seed when viewer changes (e.g. provider re-init).
  useEffect(() => {
    camRef.current = null;
  }, [viewer]);

  useGamepad({
    enabled: enabled && ready && !!viewer && !!Cesium,
    onFrame: ({ dt, leftStick, rightStick, triggers, anyStickActive }) => {
      if (!viewer || !Cesium) return;
      const v = viewer as ViewerLite;
      const C = Cesium as CesiumLite;

      // When the user isn't touching the controller, let Cesium's
      // built-in mouse/touch interaction own the camera. We re-seed our
      // owned camera state from the viewer so that the moment they pick
      // up the controller again we continue from wherever they dragged
      // to with the mouse — no snap-back.
      if (!anyStickActive) {
        if (camRef.current) {
          try {
            const carto = C.Cartographic.fromCartesian(v.camera.position);
            camRef.current.lat = C.Math.toDegrees(carto.latitude);
            camRef.current.lng = C.Math.toDegrees(carto.longitude);
            camRef.current.alt = carto.height;
            camRef.current.heading = C.Math.toDegrees(v.camera.heading);
            camRef.current.pitch = C.Math.toDegrees(v.camera.pitch);
          } catch {
            /* swallow — next frame retries */
          }
        }
        return;
      }

      // Seed camera state from the viewer on first frame. Cesium exposes
      // camera.heading and camera.pitch directly (in radians) so we can
      // pick up whatever orientation the globe / arrival flight left
      // the camera in without losing it on the first input.
      if (!camRef.current) {
        try {
          const carto = C.Cartographic.fromCartesian(v.camera.position);
          camRef.current = {
            lat: C.Math.toDegrees(carto.latitude),
            lng: C.Math.toDegrees(carto.longitude),
            alt: carto.height,
            heading: C.Math.toDegrees(v.camera.heading),
            pitch: C.Math.toDegrees(v.camera.pitch),
          };
        } catch {
          return; // viewer not ready in some weird way
        }
      }
      const cam = camRef.current;

      // ── Altitude-coupled translation rate ──────────────────────────
      const baseRate =
        ALT_COUPLE_BASE * Math.pow(Math.max(cam.alt, 1), ALT_COUPLE_EXP);
      const translationRate = Math.max(MIN_TRANSLATION_RATE_MPS, baseRate) *
        speedMulRef.current;

      // ── Left stick: strafe (X) + throttle (Y) ──────────────────────
      if (axesRef.current.leftStick) {
        const lx = shapeStick(leftStick.x);
        const ly = shapeStick(leftStick.y); // up on stick is negative

        // Throttle: forward along current heading.
        // Strafe: perpendicular to current heading (heading + 90°).
        // Heading 0 = north. North in degrees of latitude is +lat;
        // east is +lng. Distance per second in meters; converted to
        // lat/lng deltas via simple equirectangular approximation
        // (good enough for one frame, no accumulating error since we
        // re-base from absolute lat/lng each frame).

        // Forward stick is -Y on most gamepads (push up → -1). Convert
        // to "forward = +1".
        const forwardMag = -ly;
        const strafeMag = lx;

        // Distance to move this frame, in meters.
        const fwdM = forwardMag * translationRate * dt;
        const sideM = strafeMag * translationRate * dt;

        // Decompose into north/east components based on heading.
        // heading=0 → forward = +north
        // heading=90 → forward = +east
        const headingRad = (cam.heading * Math.PI) / 180;
        const dNorthM = fwdM * Math.cos(headingRad) + sideM * Math.cos(headingRad + Math.PI / 2);
        const dEastM = fwdM * Math.sin(headingRad) + sideM * Math.sin(headingRad + Math.PI / 2);

        // Meters → degrees. 1° lat ≈ 111,320 m everywhere.
        // 1° lng ≈ 111,320 * cos(lat) m.
        const dLat = dNorthM / 111_320;
        const cosLat = Math.cos((cam.lat * Math.PI) / 180);
        const dLng = dEastM / (111_320 * Math.max(0.001, cosLat));

        cam.lat = clamp(cam.lat + dLat, -85, 85);
        cam.lng = ((cam.lng + dLng + 540) % 360) - 180;
      }

      // ── Right stick: yaw (X) + pitch (Y) ───────────────────────────
      if (axesRef.current.rightStick) {
        const rx = shapeStick(rightStick.x);
        const ry = shapeStick(rightStick.y);

        cam.heading = wrapHeading(
          cam.heading + rx * YAW_RATE_DEG_S * turnRateMulRef.current * dt,
        );
        cam.pitch = clamp(
          cam.pitch - ry * PITCH_RATE_DEG_S * turnRateMulRef.current * dt,
          PITCH_MIN_DEG,
          PITCH_MAX_DEG,
        );
      }

      // ── Triggers: climb (RT) + descend (LT) ────────────────────────
      if (axesRef.current.triggers) {
        const climbStick = triggers.right - triggers.left;
        // Altitude-coupled climb rate so trigger feels consistent at
        // every scale.
        const climbRate =
          CLIMB_RATE_BASE * Math.pow(Math.max(cam.alt, 1), CLIMB_RATE_EXP);
        cam.alt = clamp(
          cam.alt + climbStick * climbRate * dt * speedMulRef.current,
          ALT_MIN_M,
          ALT_MAX_M,
        );
      }

      // ── Commit to Cesium ──────────────────────────────────────────
      v.camera.setView({
        destination: C.Cartesian3.fromDegrees(cam.lng, cam.lat, cam.alt),
        orientation: {
          heading: C.Math.toRadians(cam.heading),
          pitch: C.Math.toRadians(cam.pitch),
          roll: 0,
        },
      });
    },
  });

  return null;
}
