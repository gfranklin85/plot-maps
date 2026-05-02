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

export type FlightMode = 'overhead' | 'cockpit';

interface Props {
  enabled: boolean;
  view3D: boolean;
  actions: GamepadActions;
  /**
   * Which flight model to use. 'overhead' is the heavy-helicopter free-axis
   * model (free pan/heading/tilt/zoom). 'cockpit' is sit-in-the-craft —
   * left stick = throttle + yaw, right stick = climb/dive + bank, zoom is
   * altitude-derived only.
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

// ── Cockpit flight model ──────────────────────────────────────────────
//
// Sit-in-the-craft perspective. Left stick is throttle + yaw; right stick
// is climb/dive + bank. There is no discrete zoom — altitude (zoom)
// changes only via climb/dive. Tilt stays steep so you're looking forward
// out the window, not down on a webpage.
//
// Tuned for "slow + cinematic" — at full throttle you cross a typical
// neighborhood (~500m at zoom 18) in ~12-15 seconds. Cessna feel.

// Throttle accelerates forward velocity (in screen pixels/sec along the
// current heading). Lower than overhead pan accel so it doesn't feel
// like a sports car.
const COCKPIT_THROTTLE_ACCEL = 700;     // px/s²
const COCKPIT_THROTTLE_DRAG = 0.965;     // very slow decay — cruise-y
const COCKPIT_THROTTLE_MAX = 360;        // px/s
// Yaw — slow continuous turn rate. Heavy aircraft, not a fighter jet.
const COCKPIT_YAW_ACCEL = 90;            // deg/s²
const COCKPIT_YAW_DRAG = 0.93;
const COCKPIT_YAW_MAX = 35;              // deg/s
// Strafe — sideways pan when right stick is idle. Same velocity scale
// as throttle so strafe + throttle compose into a comfortable diagonal.
const COCKPIT_STRAFE_ACCEL = 600;        // px/s²
const COCKPIT_STRAFE_DRAG = 0.93;
const COCKPIT_STRAFE_MAX = 280;          // px/s
// Bank (right stick X) — applies a *secondary* heading drift like a wide
// banking turn. Even slower than yaw so it feels like a different control.
const COCKPIT_BANK_ACCEL = 50;
const COCKPIT_BANK_DRAG = 0.95;
const COCKPIT_BANK_MAX = 18;
// Climb/dive — alters altitude (zoom) and tilt simultaneously. Climbing
// flattens the camera (look more forward, less down); diving steepens it.
// Climbing also bleeds throttle — lifting up costs energy.
const COCKPIT_PITCH_ACCEL = 4;           // zoom units/s²
const COCKPIT_PITCH_DRAG = 0.92;
const COCKPIT_PITCH_MAX = 0.7;           // zoom units/s
const COCKPIT_TILT_TARGET_LEVEL = 67;    // tilt when neutral (looking forward+down)
const COCKPIT_TILT_TARGET_CLIMB = 50;    // tilt when climbing (more forward)
const COCKPIT_TILT_TARGET_DIVE = 75;     // tilt when diving (more down)
const COCKPIT_TILT_FOLLOW_RATE = 1.4;    // how fast tilt eases toward target

export default function GamepadFlightController({ enabled, view3D, actions, mode = 'overhead', onStatusChange }: Props) {
  const map = useMap();

  // Persistent physics state. None of this lives in React state — the input
  // loop owns it and we only call into Google Maps once per frame.
  // Overhead model uses panX/panY/heading/tilt/zoom velocities. Cockpit
  // model uses throttle (forward speed in screen px/s), yaw, bank, pitch.
  const velRef = useRef({ panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 });
  const cockpitRef = useRef({ throttle: 0, strafe: 0, yaw: 0, bank: 0, pitch: 0 });
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

  // Reset our owned camera state whenever the map instance changes (e.g.
  // walk mode toggle). Otherwise we carry stale center/heading from before.
  useEffect(() => {
    camRef.current = null;
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
    cockpitRef.current = { throttle: 0, strafe: 0, yaw: 0, bank: 0, pitch: 0 };
  }, [map]);

  // When the user toggles flight mode, zero out velocities so we don't carry
  // momentum from a different model into the new one.
  useEffect(() => {
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
    cockpitRef.current = { throttle: 0, strafe: 0, yaw: 0, bank: 0, pitch: 0 };
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
        vel.zoom += (triggers.right - triggers.left) * ZOOM_ACCEL_S2 * boost * dt;

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
        // ── Cockpit model — sit-in-the-craft ──────────────────────────
        //
        // Inputs (cockpit semantics):
        //   Left stick Y   → throttle (forward/back along heading)
        //   Left stick X   → MODAL: strafe sideways alone, OR yaw in place
        //                    if the right stick is also active (any axis).
        //                    The modifier means "I'm using both hands; I
        //                    want to rotate, not slide."
        //   Right stick Y  → ascend/descend (pure vertical, zoom-only)
        //   Right stick X  → bank (slow secondary heading drift)
        //
        // Combined-stick gestures override defaults:
        //   Left up + Right down  → ASCEND (negative pitch)
        //   Left down + Right up  → DIVE   (positive pitch + nose-dip nudge)
        const ck = cockpitRef.current;

        // Detect combined-stick gestures (use raw stick magnitudes, not
        // shaped, so the threshold is predictable).
        const leftUp = leftStick.y < -0.5;
        const leftDown = leftStick.y > 0.5;
        const rightUp = rightStick.y < -0.5;
        const rightDown = rightStick.y > 0.5;

        const ascendGesture = leftUp && rightDown;     // climb hard
        const diveGesture = leftDown && rightUp;       // dive hard

        // "Right stick active" → any movement on either right axis past a
        // small threshold. This is the modifier that flips left X from
        // strafe → yaw in place.
        const rightStickActive = rightStick.magnitude > 0.12;

        // Throttle accumulates from left stick Y, but combined gestures
        // suppress it — when ascending/diving you don't want forward drift.
        if (!ascendGesture && !diveGesture) {
          ck.throttle += -ly * COCKPIT_THROTTLE_ACCEL * boost * dt;
        } else {
          ck.throttle *= Math.pow(0.85, dragExp);
        }

        // Left X — modal. Strafe sideways when the right stick is idle;
        // yaw in place when the right stick is active. Each branch bleeds
        // the other so a quick mode swap doesn't carry stale velocity.
        if (rightStickActive) {
          ck.yaw += lx * COCKPIT_YAW_ACCEL * boost * dt;
          ck.strafe *= Math.pow(0.82, dragExp);
        } else {
          ck.strafe += lx * COCKPIT_STRAFE_ACCEL * boost * dt;
          ck.yaw *= Math.pow(0.82, dragExp);
        }

        // Bank — right stick X. Suspended during combined-vertical gestures.
        if (!ascendGesture && !diveGesture) {
          ck.bank += rx * COCKPIT_BANK_ACCEL * boost * dt;
        } else {
          ck.bank *= Math.pow(0.85, dragExp);
        }

        // Pitch — ascend/descend.
        if (ascendGesture) {
          ck.pitch += COCKPIT_PITCH_ACCEL * 1.4 * boost * dt;
        } else if (diveGesture) {
          ck.pitch -= COCKPIT_PITCH_ACCEL * 1.4 * boost * dt;
        } else {
          ck.pitch += -ry * COCKPIT_PITCH_ACCEL * boost * dt;
        }

        // Drag — applied each frame to all five state vectors.
        ck.throttle *= Math.pow(COCKPIT_THROTTLE_DRAG, dragExp);
        ck.strafe *= Math.pow(COCKPIT_STRAFE_DRAG, dragExp);
        ck.yaw *= Math.pow(COCKPIT_YAW_DRAG, dragExp);
        ck.bank *= Math.pow(COCKPIT_BANK_DRAG, dragExp);
        ck.pitch *= Math.pow(COCKPIT_PITCH_DRAG, dragExp);

        ck.throttle = clamp(ck.throttle, -COCKPIT_THROTTLE_MAX * 0.4, COCKPIT_THROTTLE_MAX);
        ck.strafe = clamp(ck.strafe, -COCKPIT_STRAFE_MAX, COCKPIT_STRAFE_MAX);
        ck.yaw = clamp(ck.yaw, -COCKPIT_YAW_MAX, COCKPIT_YAW_MAX);
        ck.bank = clamp(ck.bank, -COCKPIT_BANK_MAX, COCKPIT_BANK_MAX);
        ck.pitch = clamp(ck.pitch, -COCKPIT_PITCH_MAX, COCKPIT_PITCH_MAX);

        if (Math.abs(ck.throttle) < 0.5) ck.throttle = 0;
        if (Math.abs(ck.strafe) < 0.5) ck.strafe = 0;
        if (Math.abs(ck.yaw) < 0.05) ck.yaw = 0;
        if (Math.abs(ck.bank) < 0.05) ck.bank = 0;
        if (Math.abs(ck.pitch) < 0.005) ck.pitch = 0;

        // Translate cockpit state → application-phase vel struct.
        // - panX: strafe (sideways)
        // - panY: throttle (forward/back along heading)
        //   When pitch is non-zero (ascending/descending), suppress all
        //   pan so the gesture reads as pure vertical.
        // - Heading: yaw + bank.
        // - Tilt: target-driven later (not velocity-driven).
        // - Zoom: pitch * negative (climb = zoom out, dive = zoom in).
        const verticalActive = Math.abs(ck.pitch) > 0.02;
        vel.panX = verticalActive ? 0 : ck.strafe;
        vel.panY = verticalActive ? 0 : -ck.throttle;
        vel.heading = ck.yaw + ck.bank;
        vel.tilt = 0;
        vel.zoom = -ck.pitch;
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
      const headingDeltaThisFrame = vel.heading * dt;
      cam.heading = (cam.heading + headingDeltaThisFrame + 360) % 360;

      // ── Yaw "pivot behind head" fake (cockpit only) ─────────────────
      // Maps' camera always pivots around lat/lng. When you yaw, the
      // visual focal point in front of you sweeps sideways — reads as
      // "world swings around me" instead of "I rotate in place."
      // To fake the rotational center being behind the user's head, we
      // pan forward by a small amount calibrated to the heading delta.
      // The magnitude is tuned by feel: too much and yawing feels like
      // boost-cruising; too little and the swing is still obvious.
      if (modeRef.current === 'cockpit' && projection && Math.abs(headingDeltaThisFrame) > 0.001) {
        const scale = Math.pow(2, cam.zoom);
        // Pivot offset: how far behind the screen we pretend the rotation
        // axis sits, in world pixels. Larger = more "fixed focal point"
        // illusion but also more forward translation per degree of yaw.
        const PIVOT_OFFSET_PX = 280;
        // arc length ≈ radius * angle (rad). Sign: positive heading
        // (yaw right) should drift forward to compensate.
        const compPx = PIVOT_OFFSET_PX * (headingDeltaThisFrame * Math.PI / 180);
        const radH = (cam.heading * Math.PI) / 180;
        const cosH = Math.cos(radH), sinH = Math.sin(radH);
        const w = projection.fromLatLngToPoint(new google.maps.LatLng(cam.lat, cam.lng));
        if (w) {
          // Forward direction in world coords (heading-aligned).
          // Stick "up" / forward = negative panY in our screen frame.
          const dxScreen = 0;
          const dyScreen = -Math.abs(compPx);
          // Inverse-rotate to world.
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

      if (modeRef.current === 'cockpit') {
        // Cockpit: tilt eases toward a target driven by pitch state, not
        // by direct stick velocity. Climb → flatten (look more forward),
        // dive → steepen (look more down), neutral → COCKPIT_TILT_TARGET_LEVEL.
        const ck = cockpitRef.current;
        let targetTilt = COCKPIT_TILT_TARGET_LEVEL;
        if (ck.pitch > 0.05) {
          // climbing — interpolate toward COCKPIT_TILT_TARGET_CLIMB
          const t = clamp(ck.pitch / COCKPIT_PITCH_MAX, 0, 1);
          targetTilt = COCKPIT_TILT_TARGET_LEVEL + (COCKPIT_TILT_TARGET_CLIMB - COCKPIT_TILT_TARGET_LEVEL) * t;
        } else if (ck.pitch < -0.05) {
          const t = clamp(-ck.pitch / COCKPIT_PITCH_MAX, 0, 1);
          targetTilt = COCKPIT_TILT_TARGET_LEVEL + (COCKPIT_TILT_TARGET_DIVE - COCKPIT_TILT_TARGET_LEVEL) * t;
        }
        // Cockpit only makes sense in 3D — clamp target to the available range.
        const cockpitTiltMax = view3DRef.current ? TILT_MAX_3D : 0;
        targetTilt = clamp(targetTilt, TILT_MIN, cockpitTiltMax);
        // Ease tilt toward target. Critically-damped enough that it doesn't
        // overshoot but visible enough that you feel the nose lift/drop.
        const tiltDelta = (targetTilt - cam.tilt) * COCKPIT_TILT_FOLLOW_RATE * dt;
        cam.tilt = clamp(cam.tilt + tiltDelta, TILT_MIN, cockpitTiltMax);
      } else {
        // Overhead: tilt is direct velocity-driven.
        cam.tilt = clamp(cam.tilt + vel.tilt * dt, TILT_MIN, tiltMax);
        if ((cam.tilt === TILT_MIN && vel.tilt < 0) || (cam.tilt === tiltMax && vel.tilt > 0)) {
          vel.tilt = 0;
        }
      }

      cam.zoom = clamp(cam.zoom + vel.zoom * dt, ZOOM_MIN, ZOOM_MAX);
      if ((cam.zoom === ZOOM_MIN && vel.zoom < 0) || (cam.zoom === ZOOM_MAX && vel.zoom > 0)) {
        vel.zoom = 0;
        if (modeRef.current === 'cockpit') cockpitRef.current.pitch = 0;
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
