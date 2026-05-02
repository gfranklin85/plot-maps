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
}

interface Props {
  enabled: boolean;
  view3D: boolean;
  actions: GamepadActions;
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
// Tuned for "Banshee in Halo" — heavy, slightly floaty, cinematic. Sticks
// ramp up over ~400ms; release glides for ~800ms before fully settling.

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

export default function GamepadFlightController({ enabled, view3D, actions, onStatusChange }: Props) {
  const map = useMap();

  // Persistent physics state. None of this lives in React state — the input
  // loop owns it and we only call into Google Maps once per frame.
  const velRef = useRef({ panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 });
  // Camera state we own (so we don't read back rounded values from Google
  // every frame, which causes drift). We seed from the map on first frame.
  const camRef = useRef<{ lat: number; lng: number; heading: number; tilt: number; zoom: number } | null>(null);

  // Latest action callbacks pinned to a ref so the input loop doesn't tear
  // down whenever the parent re-renders.
  const actionsRef = useRef<GamepadActions>(actions);
  actionsRef.current = actions;
  const view3DRef = useRef(view3D);
  view3DRef.current = view3D;

  // Reset our owned camera state whenever the map instance changes (e.g.
  // walk mode toggle). Otherwise we carry stale center/heading from before.
  useEffect(() => {
    camRef.current = null;
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
  }, [map]);

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

      // ── Physics integration ─────────────────────────────────────────
      const boost = pressed.has('lb') ? PAN_BOOST_MULT : 1;
      const vel = velRef.current;

      // Apply stick → acceleration → velocity. Stick directions:
      // positive X = right, positive Y = down (standard Gamepad).
      const lx = shapeStick(leftStick.x);
      const ly = shapeStick(leftStick.y);
      const rx = shapeStick(rightStick.x);
      const ry = shapeStick(rightStick.y);

      vel.panX += lx * PAN_ACCEL_PX_S2 * boost * dt;
      vel.panY += ly * PAN_ACCEL_PX_S2 * boost * dt;
      vel.heading += rx * HEAD_ACCEL_DEG_S2 * boost * dt;
      vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boost * dt; // up = look up
      vel.zoom += (triggers.right - triggers.left) * ZOOM_ACCEL_S2 * boost * dt;

      // Drag — apply each frame, framerate-independent. The base constants
      // are the per-frame coefficient at 60fps, so we exponent by (60*dt).
      const dragExp = 60 * dt;
      vel.panX *= Math.pow(PAN_DRAG, dragExp);
      vel.panY *= Math.pow(PAN_DRAG, dragExp);
      vel.heading *= Math.pow(HEAD_DRAG, dragExp);
      vel.tilt *= Math.pow(TILT_DRAG, dragExp);
      vel.zoom *= Math.pow(ZOOM_DRAG, dragExp);

      // Clamp velocities so the stick can't accumulate to runaway speed.
      vel.panX = clamp(vel.panX, -PAN_MAX_PX_S, PAN_MAX_PX_S);
      vel.panY = clamp(vel.panY, -PAN_MAX_PX_S, PAN_MAX_PX_S);
      vel.heading = clamp(vel.heading, -HEAD_MAX_DEG_S, HEAD_MAX_DEG_S);
      vel.tilt = clamp(vel.tilt, -TILT_MAX_DEG_S, TILT_MAX_DEG_S);
      vel.zoom = clamp(vel.zoom, -ZOOM_MAX_S, ZOOM_MAX_S);

      // Numerical zero — avoid sub-pixel drift forever.
      if (Math.abs(vel.panX) < 0.5) vel.panX = 0;
      if (Math.abs(vel.panY) < 0.5) vel.panY = 0;
      if (Math.abs(vel.heading) < 0.05) vel.heading = 0;
      if (Math.abs(vel.tilt) < 0.05) vel.tilt = 0;
      if (Math.abs(vel.zoom) < 0.001) vel.zoom = 0;

      // ── Apply velocity → camera state ───────────────────────────────
      // Pan: convert pixel velocity to lat/lng using the current zoom's
      // meters-per-pixel and a heading-aware rotation. Velocity is in
      // screen-space pixels, so a pan-X stick push moves the screen to
      // the right regardless of map heading.
      const projection = (map as unknown as google.maps.Map).getProjection?.();
      let panLat = 0, panLng = 0;
      if (projection) {
        const scale = Math.pow(2, cam.zoom);
        // Get current center as world coords (256-tile space).
        const worldPx = projection.fromLatLngToPoint(new google.maps.LatLng(cam.lat, cam.lng));
        if (worldPx) {
          // Apply pan velocity (rotate by heading so "stick up" matches
          // the visual top of the screen, not absolute north).
          const rad = (cam.heading * Math.PI) / 180;
          const cos = Math.cos(rad), sin = Math.sin(rad);
          // dx_screen = panX * dt; dy_screen = panY * dt; convert to world px.
          const dxScreen = vel.panX * dt;
          const dyScreen = vel.panY * dt;
          // Inverse-rotate screen delta into world-aligned delta.
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
      cam.heading = (cam.heading + vel.heading * dt + 360) % 360;
      const tiltMax = view3DRef.current ? TILT_MAX_3D : 0;
      cam.tilt = clamp(cam.tilt + vel.tilt * dt, TILT_MIN, tiltMax);
      // Zero tilt velocity if we hit a clamp wall, otherwise the user
      // can pre-charge a velocity that snaps free the moment they re-tilt.
      if ((cam.tilt === TILT_MIN && vel.tilt < 0) || (cam.tilt === tiltMax && vel.tilt > 0)) {
        vel.tilt = 0;
      }
      cam.zoom = clamp(cam.zoom + vel.zoom * dt, ZOOM_MIN, ZOOM_MAX);
      if ((cam.zoom === ZOOM_MIN && vel.zoom < 0) || (cam.zoom === ZOOM_MAX && vel.zoom > 0)) {
        vel.zoom = 0;
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
        if (Math.abs((mapHeading) - cam.heading) > 0.05) map.setHeading(cam.heading);
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
