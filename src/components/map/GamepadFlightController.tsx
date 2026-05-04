'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { useGamepad } from '@/lib/useGamepad';
import { clamp, type ButtonName } from '@/lib/gamepadActions';

export interface GamepadActions {
  onPrimary?: () => void;          // A — open popup for selected/closest lead
  onCancel?: () => void;           // B — close popup / exit walk
  onSkiptrace?: () => void;        // X
  onDial?: () => void;             // Y
  onCyclePrev?: () => void;        // D-pad up/left
  onCycleNext?: () => void;        // D-pad down/right
  onDropProspect?: () => void;     // RB
  onRecenter?: () => void;         // Start
  onToggleWalk?: () => void;       // Back
  onAltitudeUp?: () => void;       // LT tapped — climb to next altitude band
  onAltitudeDown?: () => void;     // RT tapped — descend to next altitude band
}

export type FlightMode = 'overhead' | 'airplane';

interface Props {
  enabled: boolean;
  view3D: boolean;
  actions: GamepadActions;
  /**
   * Which flight model to use. 'overhead' is the heavy-helicopter free-axis
   * model (free pan/heading/tilt/zoom). 'airplane' is sit-in-the-craft —
   * left stick = throttle + yaw, right stick X = bank, right stick Y =
   * tilt + climb/dive (independent: tilt is direct, climb/dive drives zoom).
   */
  mode?: FlightMode;
  /** Reports controller status up to the page so it can render a toast. */
  onStatusChange?: (connected: boolean, label: string | null) => void;
}

// ── Heavy helicopter physics constants ────────────────────────────────
//
// The map is driven by velocities, not positions. Sticks change acceleration;
// drag pulls velocities back to zero when the user lets go. This gives the
// glide-to-stop behavior real aircraft have, instead of the jolt-on-release
// of position-based input.
//
// The 60fps physics layer + moveCamera once per frame writes absolute
// camera state and bypasses Maps' per-call animation queue entirely.
// Direct stick → panBy/setHeading hits that queue every call and stutters.

// PAN — units: world meters per second on the meters-per-pixel-scaled vector.
// We compute pan as pixels per frame, but the velocity itself is stored in
// pixels/sec so it composes naturally with dt.
const PAN_ACCEL_PX_S2 = 1800;       // how hard the stick pushes pan velocity
const PAN_DRAG = 0.92;               // velocity *= drag^(60*dt)  → ~0.92 at 60fps
const PAN_MAX_PX_S = 700;            // hard cap on pan speed
const PAN_BOOST_MULT = 2.4;          // LB held

// HEADING — degrees. Same shape: stick → angular acceleration → velocity → angle.
const HEAD_ACCEL_DEG_S2 = 320;
const HEAD_DRAG = 0.90;
const HEAD_MAX_DEG_S = 110;

// TILT — degrees. Slightly more responsive than heading (less inertia).
const TILT_ACCEL_DEG_S2 = 220;
const TILT_DRAG = 0.86;
const TILT_MAX_DEG_S = 70;

// ZOOM — Google's zoom levels (~0–22, log scale).
const ZOOM_ACCEL_S2 = 8;
const ZOOM_DRAG = 0.85;
const ZOOM_MAX_S = 1.6;

const TILT_MIN = 0;
const TILT_MAX_3D = 67;
const ZOOM_MIN = 3;
const ZOOM_MAX = 21;

// ── Yaw "sideways pivot fake" ─────────────────────────────────────────
// Maps' camera always pivots around lat/lng. When the heading rotates,
// the visual focal point in front of the user sweeps sideways across the
// screen — reads as "the rear end is swinging across town." The fix:
// when heading rotates by Δθ this frame, also pan the camera laterally
// (perpendicular to current heading) by R × sin(Δθ). For small Δθ this
// is approximately R × Δθ in radians. Mathematically the rotation pivot
// is still lat/lng; the lateral compensation keeps the apparent focal
// point in front of the user roughly fixed. Reads as "world rotates
// around me." Applied in both modes wherever heading changes.
const YAW_PIVOT_RADIUS_PX = 140;

// ── Hover wave ────────────────────────────────────────────────────────
// A constant low-frequency sine wave is added to position/heading/tilt so
// the camera always feels alive — even when you're "hovering still." The
// amplitude is tiny enough that it's subliminal during active piloting,
// but obvious when you let go. Deterministic (time-driven) so successive
// frames don't drift.
const HOVER_HEADING_AMPL = 0.6;     // degrees
const HOVER_HEADING_FREQ = 0.18;    // Hz — one cycle every ~5.5s
const HOVER_TILT_AMPL = 0.3;
const HOVER_TILT_FREQ = 0.12;
const HOVER_PAN_AMPL_PX = 1.4;       // pixels — visible only at high zoom
const HOVER_PAN_FREQ_X = 0.07;
const HOVER_PAN_FREQ_Y = 0.11;

// Stick → acceleration ramp. With a fully-pegged stick we don't snap to
// max acceleration; we curve it cubically so light touches give light push,
// hard pushes give hard push. That asymmetry is what makes flight feel
// "weighted" rather than digital.
function shapeStick(v: number): number {
  // v in [-1, 1]. Output in [-1, 1] but cubic.
  return Math.sign(v) * Math.pow(Math.abs(v), 1.6);
}

// ── Airplane flight model ─────────────────────────────────────────────
//
// Sit-in-the-craft perspective. Left stick is throttle + yaw; right stick
// X = bank, right stick Y = tilt + climb/dive (independent). Tilt is
// direct velocity-driven (NOT target-driven by climb-state — that fought
// the user). Climb/dive drives zoom only.
//
// Tuned for "slow + cinematic" — at full throttle you cross a typical
// neighborhood (~500m at zoom 18) in ~12-15 seconds. Cessna feel.

const AIR_THROTTLE_ACCEL = 700;     // px/s²
const AIR_THROTTLE_DRAG = 0.965;     // very slow decay — cruise-y
const AIR_THROTTLE_MAX = 360;        // px/s
const AIR_YAW_ACCEL = 90;            // deg/s²
const AIR_YAW_DRAG = 0.93;
const AIR_YAW_MAX = 35;
const AIR_BANK_ACCEL = 50;
const AIR_BANK_DRAG = 0.95;
const AIR_BANK_MAX = 18;
const AIR_PITCH_ACCEL = 4;           // zoom units/s²
const AIR_PITCH_DRAG = 0.92;
const AIR_PITCH_MAX = 0.7;           // zoom units/s

// ── Trigger tap-vs-hold ───────────────────────────────────────────────
const TRIGGER_TAP_MS = 200;
const TRIGGER_PRESS_THRESHOLD = 0.4;
const TRIGGER_TAP_COOLDOWN_MS = 250;

interface TriggerState {
  pressing: boolean;
  pressStartMs: number;
  cooldownUntilMs: number;
}

export default function GamepadFlightController({ enabled, view3D, actions, mode = 'overhead', onStatusChange }: Props) {
  const map = useMap();

  // Persistent physics state. None of this lives in React state — the input
  // loop owns it and we only call into Google Maps once per frame.
  // Overhead model uses panX/panY/heading/tilt/zoom velocities. Airplane
  // model uses throttle (forward speed in screen px/s), yaw, bank, pitch.
  const velRef = useRef({ panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 });
  const airRef = useRef({ throttle: 0, yaw: 0, bank: 0, pitch: 0 });
  // Camera state we own (so we don't read back rounded values from Google
  // every frame, which causes drift). We seed from the map on first frame.
  const camRef = useRef<{ lat: number; lng: number; heading: number; tilt: number; zoom: number } | null>(null);

  // Latest action callbacks pinned to a ref so the input loop doesn't tear
  // down whenever the parent re-renders.
  const actionsRef = useRef<GamepadActions>(actions);
  actionsRef.current = actions;
  const view3DRef = useRef(view3D);
  view3DRef.current = view3D;
  const modeRef = useRef<FlightMode>(mode);
  modeRef.current = mode;

  // Per-trigger press tracking so we can distinguish tap vs hold.
  const ltStateRef = useRef<TriggerState>({ pressing: false, pressStartMs: 0, cooldownUntilMs: 0 });
  const rtStateRef = useRef<TriggerState>({ pressing: false, pressStartMs: 0, cooldownUntilMs: 0 });

  // Reset our owned camera state whenever the map instance changes (e.g.
  // walk mode toggle). Otherwise we carry stale center/heading from before.
  useEffect(() => {
    camRef.current = null;
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
    airRef.current = { throttle: 0, yaw: 0, bank: 0, pitch: 0 };
  }, [map]);

  // When the user toggles flight mode, zero out velocities so we don't carry
  // momentum from a different model into the new one.
  useEffect(() => {
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
    airRef.current = { throttle: 0, yaw: 0, bank: 0, pitch: 0 };
  }, [mode]);

  const status = useGamepad({
    enabled: enabled && !!map,
    onFrame: ({ dt, elapsedMs, leftStick, rightStick, triggers, pressed, justPressed }) => {
      if (!map) return;

      // Seed our owned camera state from the map on first frame, or whenever
      // we've drifted (user dragged the map manually).
      const mapCenter = map.getCenter();
      const mapHeading = map.getHeading() ?? 0;
      const mapTilt = map.getTilt() ?? 0;
      const mapZoom = map.getZoom() ?? 16;

      if (!camRef.current || !mapCenter) {
        if (!mapCenter) return; // map not ready
        camRef.current = {
          lat: mapCenter.lat(),
          lng: mapCenter.lng(),
          heading: mapHeading,
          tilt: mapTilt,
          zoom: mapZoom,
        };
      }
      const cam = camRef.current;

      // If the user dragged the map between our frames, snap our owned
      // state forward so we don't fight them. Detect drift > ~1 pixel.
      // We approximate by comparing zoom-aware lat/lng deltas.
      const driftLat = Math.abs((mapCenter?.lat() ?? cam.lat) - cam.lat);
      const driftLng = Math.abs((mapCenter?.lng() ?? cam.lng) - cam.lng);
      const driftThreshold = 0.0001; // ~10m at the equator
      if (driftLat > driftThreshold || driftLng > driftThreshold) {
        cam.lat = mapCenter!.lat();
        cam.lng = mapCenter!.lng();
      }
      // Always sync heading/tilt/zoom from map at frame start so external
      // changes (e.g. choreographer flights) don't fight us.
      if (Math.abs(mapHeading - cam.heading) > 1) cam.heading = mapHeading;
      if (Math.abs(mapTilt - cam.tilt) > 1) cam.tilt = mapTilt;
      if (Math.abs(mapZoom - cam.zoom) > 0.05) cam.zoom = mapZoom;

      // ── Edge-triggered button actions ───────────────────────────────
      if (justPressed.size > 0) {
        const fire = (name: ButtonName, fn?: () => void) => {
          if (justPressed.has(name) && fn) fn();
        };
        fire('a', actionsRef.current.onPrimary);
        fire('b', actionsRef.current.onCancel);
        fire('x', actionsRef.current.onSkiptrace);
        fire('y', actionsRef.current.onDial);
        fire('rb', actionsRef.current.onDropProspect);
        fire('start', actionsRef.current.onRecenter);
        fire('back', actionsRef.current.onToggleWalk);
        if (justPressed.has('up') || justPressed.has('left')) actionsRef.current.onCyclePrev?.();
        if (justPressed.has('down') || justPressed.has('right')) actionsRef.current.onCycleNext?.();
      }

      // ── Trigger tap vs hold ─────────────────────────────────────────
      // Tap (<200ms) fires altitude-band action on release. Hold (>=200ms)
      // applies continuous zoom every frame past the threshold.
      let triggerZoomDelta = 0;
      const handleTrigger = (
        value: number,
        state: TriggerState,
        onTap: (() => void) | undefined,
        zoomSign: 1 | -1,
      ) => {
        const isPressed = value >= TRIGGER_PRESS_THRESHOLD;
        if (isPressed && !state.pressing) {
          state.pressing = true;
          state.pressStartMs = elapsedMs;
        } else if (!isPressed && state.pressing) {
          state.pressing = false;
          const heldFor = elapsedMs - state.pressStartMs;
          if (heldFor < TRIGGER_TAP_MS && elapsedMs > state.cooldownUntilMs) {
            onTap?.();
            state.cooldownUntilMs = elapsedMs + TRIGGER_TAP_COOLDOWN_MS;
          }
        } else if (isPressed && elapsedMs - state.pressStartMs >= TRIGGER_TAP_MS) {
          // Hold — accumulate zoom delta to apply through the physics
          // velocity below, so it composes with everything else.
          triggerZoomDelta += zoomSign * value;
        }
      };
      handleTrigger(triggers.right, rtStateRef.current, actionsRef.current.onAltitudeDown, 1);
      handleTrigger(triggers.left, ltStateRef.current, actionsRef.current.onAltitudeUp, -1);

      // ── Physics integration ─────────────────────────────────────────
      const boost = pressed.has('lb') ? PAN_BOOST_MULT : 1;
      const vel = velRef.current;
      const dragExp = 60 * dt;

      const lx = shapeStick(leftStick.x);
      const ly = shapeStick(leftStick.y);
      const rx = shapeStick(rightStick.x);
      const ry = shapeStick(rightStick.y);

      if (modeRef.current === 'overhead') {
        // ── Overhead model — heavy helicopter, free axes ──────────────
        // Stick directions: positive X = right, positive Y = down.
        vel.panX += lx * PAN_ACCEL_PX_S2 * boost * dt;
        vel.panY += ly * PAN_ACCEL_PX_S2 * boost * dt;
        vel.heading += rx * HEAD_ACCEL_DEG_S2 * boost * dt;
        vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boost * dt; // up = look up
        vel.zoom += triggerZoomDelta * ZOOM_ACCEL_S2 * boost * dt;

        vel.panX *= Math.pow(PAN_DRAG, dragExp);
        vel.panY *= Math.pow(PAN_DRAG, dragExp);
        vel.heading *= Math.pow(HEAD_DRAG, dragExp);
        vel.tilt *= Math.pow(TILT_DRAG, dragExp);
        vel.zoom *= Math.pow(ZOOM_DRAG, dragExp);

        vel.panX = clamp(vel.panX, -PAN_MAX_PX_S, PAN_MAX_PX_S);
        vel.panY = clamp(vel.panY, -PAN_MAX_PX_S, PAN_MAX_PX_S);
        vel.heading = clamp(vel.heading, -HEAD_MAX_DEG_S, HEAD_MAX_DEG_S);
        vel.tilt = clamp(vel.tilt, -TILT_MAX_DEG_S, TILT_MAX_DEG_S);
        vel.zoom = clamp(vel.zoom, -ZOOM_MAX_S, ZOOM_MAX_S);

        if (Math.abs(vel.panX) < 0.5) vel.panX = 0;
        if (Math.abs(vel.panY) < 0.5) vel.panY = 0;
        if (Math.abs(vel.heading) < 0.05) vel.heading = 0;
        if (Math.abs(vel.tilt) < 0.05) vel.tilt = 0;
        if (Math.abs(vel.zoom) < 0.001) vel.zoom = 0;
      } else {
        // ── Airplane model — sit-in-the-craft, throttle + yaw + bank ──
        // Right Y drives BOTH tilt (direct, like overhead) AND climb/dive
        // (zoom). They're independent — tilt is no longer target-driven
        // by climb-state. That's the user-requested decoupling.
        const air = airRef.current;

        air.throttle += -ly * AIR_THROTTLE_ACCEL * boost * dt;
        air.yaw += lx * AIR_YAW_ACCEL * boost * dt;
        air.bank += rx * AIR_BANK_ACCEL * boost * dt;
        air.pitch += -ry * AIR_PITCH_ACCEL * boost * dt;

        air.throttle *= Math.pow(AIR_THROTTLE_DRAG, dragExp);
        air.yaw *= Math.pow(AIR_YAW_DRAG, dragExp);
        air.bank *= Math.pow(AIR_BANK_DRAG, dragExp);
        air.pitch *= Math.pow(AIR_PITCH_DRAG, dragExp);

        air.throttle = clamp(air.throttle, -AIR_THROTTLE_MAX * 0.4, AIR_THROTTLE_MAX);
        air.yaw = clamp(air.yaw, -AIR_YAW_MAX, AIR_YAW_MAX);
        air.bank = clamp(air.bank, -AIR_BANK_MAX, AIR_BANK_MAX);
        air.pitch = clamp(air.pitch, -AIR_PITCH_MAX, AIR_PITCH_MAX);

        if (Math.abs(air.throttle) < 0.5) air.throttle = 0;
        if (Math.abs(air.yaw) < 0.05) air.yaw = 0;
        if (Math.abs(air.bank) < 0.05) air.bank = 0;
        if (Math.abs(air.pitch) < 0.005) air.pitch = 0;

        // Tilt: direct velocity-driven, same as overhead. Decoupled from
        // climb-state. Use the same TILT_ACCEL/DRAG constants so tilt
        // responsiveness is consistent across modes.
        vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boost * dt;
        vel.tilt *= Math.pow(TILT_DRAG, dragExp);
        vel.tilt = clamp(vel.tilt, -TILT_MAX_DEG_S, TILT_MAX_DEG_S);
        if (Math.abs(vel.tilt) < 0.05) vel.tilt = 0;

        // Translate airplane velocities into the shared overhead vel struct
        // for the application phase below. Forward velocity = panY =
        // -throttle (negative panY moves the screen up = camera moves
        // forward). Yaw + bank both contribute to heading. Trigger holds
        // can also nudge zoom on top of climb/dive.
        vel.panX = 0; // strafe doesn't exist in airplane model
        vel.panY = -air.throttle;
        vel.heading = air.yaw + air.bank;
        vel.zoom = -air.pitch + triggerZoomDelta * ZOOM_ACCEL_S2 * boost * dt;
      }

      // ── Apply velocity → camera state ───────────────────────────────
      // Pan: convert pixel velocity to lat/lng using the current zoom's
      // meters-per-pixel and a heading-aware rotation. Velocity is in
      // screen-space pixels, so a pan-X stick push moves the screen to
      // the right regardless of map heading.
      const projection = (map as unknown as google.maps.Map).getProjection?.();
      let panLat = 0, panLng = 0;
      if (projection) {
        const scale = Math.pow(2, cam.zoom);
        const worldPx = projection.fromLatLngToPoint(new google.maps.LatLng(cam.lat, cam.lng));
        if (worldPx) {
          const rad = (cam.heading * Math.PI) / 180;
          const cos = Math.cos(rad), sin = Math.sin(rad);
          const dxScreen = vel.panX * dt;
          const dyScreen = vel.panY * dt;
          const dxWorld = (dxScreen * cos - dyScreen * sin) / scale;
          const dyWorld = (dxScreen * sin + dyScreen * cos) / scale;
          worldPx.x += dxWorld;
          worldPx.y += dyWorld;
          const newLatLng = projection.fromPointToLatLng(worldPx);
          if (newLatLng) {
            panLat = newLatLng.lat() - cam.lat;
            panLng = newLatLng.lng() - cam.lng;
          }
        }
      }
      cam.lat += panLat;
      cam.lng += panLng;

      const headingDeltaThisFrame = vel.heading * dt;
      cam.heading = (cam.heading + headingDeltaThisFrame + 360) % 360;

      // ── Sideways pivot fake (both modes) ────────────────────────────
      // When heading rotates by Δθ this frame, also pan the camera laterally
      // (perpendicular to current heading) by R × sin(Δθ). For small Δθ
      // this is approximately R × Δθ in radians. The lateral direction is
      // +90° from current heading; sign matches rotation direction so
      // rotating right drifts the camera right relative to user view.
      if (projection && Math.abs(headingDeltaThisFrame) > 0.001) {
        const compPx = YAW_PIVOT_RADIUS_PX * (headingDeltaThisFrame * Math.PI) / 180;
        const scale = Math.pow(2, cam.zoom);
        const radH = (cam.heading * Math.PI) / 180;
        const cosH = Math.cos(radH), sinH = Math.sin(radH);
        const w = projection.fromLatLngToPoint(new google.maps.LatLng(cam.lat, cam.lng));
        if (w) {
          // Sideways = +X in screen space (perpendicular to forward/-Y).
          const dxScreen = compPx;
          const dyScreen = 0;
          const dxW = (dxScreen * cosH - dyScreen * sinH) / scale;
          const dyW = (dxScreen * sinH + dyScreen * cosH) / scale;
          w.x += dxW;
          w.y += dyW;
          const out = projection.fromPointToLatLng(w);
          if (out) {
            cam.lat = out.lat();
            cam.lng = out.lng();
          }
        }
      }

      const tiltMax = view3DRef.current ? TILT_MAX_3D : 0;

      // Tilt: direct velocity-driven in BOTH modes (decoupled from
      // climb-state per Phase A spec).
      cam.tilt = clamp(cam.tilt + vel.tilt * dt, TILT_MIN, tiltMax);
      if ((cam.tilt === TILT_MIN && vel.tilt < 0) || (cam.tilt === tiltMax && vel.tilt > 0)) {
        vel.tilt = 0;
      }

      cam.zoom = clamp(cam.zoom + vel.zoom * dt, ZOOM_MIN, ZOOM_MAX);
      if ((cam.zoom === ZOOM_MIN && vel.zoom < 0) || (cam.zoom === ZOOM_MAX && vel.zoom > 0)) {
        vel.zoom = 0;
        if (modeRef.current === 'airplane') airRef.current.pitch = 0;
      }

      // ── Hover wave (always on, very subtle) ─────────────────────────
      // Don't add to cam state — add to the *applied* values so the wave
      // doesn't drift the underlying camera over time.
      const t = elapsedMs / 1000;
      const hoverHeading = Math.sin(2 * Math.PI * HOVER_HEADING_FREQ * t) * HOVER_HEADING_AMPL;
      const hoverTilt = tiltMax > 0
        ? Math.sin(2 * Math.PI * HOVER_TILT_FREQ * t) * HOVER_TILT_AMPL
        : 0;
      const hoverPanX = Math.sin(2 * Math.PI * HOVER_PAN_FREQ_X * t) * HOVER_PAN_AMPL_PX;
      const hoverPanY = Math.cos(2 * Math.PI * HOVER_PAN_FREQ_Y * t) * HOVER_PAN_AMPL_PX;

      let appliedLat = cam.lat;
      let appliedLng = cam.lng;
      if (projection) {
        const worldPx = projection.fromLatLngToPoint(new google.maps.LatLng(cam.lat, cam.lng));
        if (worldPx) {
          const scale = Math.pow(2, cam.zoom);
          worldPx.x += hoverPanX / scale;
          worldPx.y += hoverPanY / scale;
          const out = projection.fromPointToLatLng(worldPx);
          if (out) {
            appliedLat = out.lat();
            appliedLng = out.lng();
          }
        }
      }

      // ── Apply to map (single moveCamera call per frame) ─────────────
      // moveCamera bypasses Google's per-call ease-out. Vector mode only.
      type MoveCamera = (opts: {
        center: { lat: number; lng: number };
        heading: number;
        tilt: number;
        zoom: number;
      }) => void;
      const mc = (map as unknown as { moveCamera?: MoveCamera }).moveCamera;
      if (typeof mc === 'function') {
        mc.call(map, {
          center: { lat: appliedLat, lng: appliedLng },
          heading: (cam.heading + hoverHeading + 360) % 360,
          tilt: clamp(cam.tilt + hoverTilt, TILT_MIN, tiltMax || TILT_MIN),
          zoom: cam.zoom,
        });
      } else {
        // Fallback for raster maps (no Map ID) — still better than panBy
        // because we're applying once-per-frame absolute state.
        map.setCenter({ lat: appliedLat, lng: appliedLng });
        if (Math.abs(mapHeading - cam.heading) > 0.05) map.setHeading(cam.heading);
        if (Math.abs(mapTilt - cam.tilt) > 0.05) map.setTilt(cam.tilt);
        if (Math.abs(mapZoom - cam.zoom) > 0.001) map.setZoom(cam.zoom);
      }
    },
  });

  useEffect(() => {
    onStatusChange?.(status.connected, status.label);
  }, [status.connected, status.label, onStatusChange]);

  return null;
}
