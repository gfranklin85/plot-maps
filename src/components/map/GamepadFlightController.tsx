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

interface Props {
  enabled: boolean;
  view3D: boolean;
  actions: GamepadActions;
  /** Reports controller status up to the page so it can render a toast. */
  onStatusChange?: (connected: boolean, label: string | null) => void;
}

// ── Direct-input rates ────────────────────────────────────────────────
//
// No velocity, no drag, no clamps, no two-layer integration. Sticks
// translate directly to per-frame map operations. The map's own inertia
// is the inertia — we don't add a second layer that fights it.

// Pan rate at full stick deflection, in screen pixels per second. The
// effective speed is heading-aware (stick "up" moves toward the visual
// top of the screen regardless of compass heading).
const PAN_PX_PER_SEC = 540;

// Heading rotation rate at full right-stick X.
const HEAD_DEG_PER_SEC = 90;

// Tilt rate at full right-stick Y.
const TILT_DEG_PER_SEC = 55;

// Continuous zoom rate while a trigger is held.
const ZOOM_PER_SEC = 1.4;

// LB held = boost everything.
const BOOST_MULT = 2.2;

// Tilt limits. 67° is the Photorealistic 3D Tiles practical max in
// vector mode; raster maps clamp at 0.
const TILT_MIN = 0;
const TILT_MAX_3D = 67;

// Yaw "pivot fake" — when right-stick X rotates the heading by Δθ, we
// also pan the camera laterally (perpendicular to current heading) by
// R × sin(Δθ), where R is a virtual pivot radius in screen pixels. The
// math: Maps' camera always pivots around lat/lng. Compensating with a
// sideways pan keeps the visual focal point in front of the user fixed,
// so the world reads as rotating around the user's POV rather than
// swinging the rear end across town.
const YAW_PIVOT_RADIUS_PX = 140;

// Trigger tap-vs-hold threshold. Press shorter than this fires a tap
// action on release; longer becomes a continuous-zoom hold.
const TRIGGER_TAP_MS = 200;
// A trigger is considered "pressed" once it crosses this analog value.
// Xbox triggers are noisy near 0; 0.4 rejects that and confirms intent.
const TRIGGER_PRESS_THRESHOLD = 0.4;

// Dead "settling" window after a tap fires. Without this, the same tap
// can spuriously re-fire if the trigger value bounces around the press
// threshold during release.
const TRIGGER_TAP_COOLDOWN_MS = 250;

interface TriggerState {
  pressing: boolean;
  pressStartMs: number;
  cooldownUntilMs: number;
}

export default function GamepadFlightController({ enabled, view3D, actions, onStatusChange }: Props) {
  const map = useMap();

  // Latest action callbacks pinned to a ref so the input loop doesn't tear
  // down whenever the parent re-renders.
  const actionsRef = useRef<GamepadActions>(actions);
  actionsRef.current = actions;
  const view3DRef = useRef(view3D);
  view3DRef.current = view3D;

  // Per-trigger press tracking so we can distinguish tap vs hold.
  const ltStateRef = useRef<TriggerState>({ pressing: false, pressStartMs: 0, cooldownUntilMs: 0 });
  const rtStateRef = useRef<TriggerState>({ pressing: false, pressStartMs: 0, cooldownUntilMs: 0 });

  const status = useGamepad({
    enabled: enabled && !!map,
    onFrame: ({ dt, elapsedMs, leftStick, rightStick, triggers, pressed, justPressed }) => {
      if (!map) return;

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

      const boost = pressed.has('lb') ? BOOST_MULT : 1;

      // ── Pan (left stick) ────────────────────────────────────────────
      // panBy moves the map by screen-pixel offsets, pre-rotated by the
      // map's current heading. Stick X positive = pan right; stick Y
      // positive = pan down (standard Gamepad convention; Y is inverted
      // from world coordinates by design).
      if (leftStick.x !== 0 || leftStick.y !== 0) {
        const dxPx = leftStick.x * PAN_PX_PER_SEC * boost * dt;
        const dyPx = leftStick.y * PAN_PX_PER_SEC * boost * dt;
        (map as unknown as google.maps.Map).panBy(dxPx, dyPx);
      }

      // ── Heading (right stick X) + sideways yaw fake ─────────────────
      // The fake: when heading rotates by Δθ, we also pan laterally by
      // R × sin(Δθ) so the visual focal point in front of the user stays
      // put. Lateral direction = +90° from current heading. For small
      // Δθ this is almost linear, so we just use Δθ in radians directly.
      if (rightStick.x !== 0) {
        const currentHeading = map.getHeading() ?? 0;
        const headingDelta = rightStick.x * HEAD_DEG_PER_SEC * boost * dt;
        const newHeading = (currentHeading + headingDelta + 360) % 360;
        map.setHeading(newHeading);

        // Lateral pan compensation. headingDelta is in degrees; convert
        // to radians for the arc-length approximation.
        if (Math.abs(headingDelta) > 0.001) {
          const compPx = YAW_PIVOT_RADIUS_PX * (headingDelta * Math.PI) / 180;
          // panBy arguments are in screen-pixel coordinates of the map's
          // current orientation, so a positive X moves the camera to the
          // right relative to the user's view. Sign-match: rotating right
          // (positive headingDelta) drifts laterally to the right.
          (map as unknown as google.maps.Map).panBy(compPx, 0);
        }
      }

      // ── Tilt (right stick Y) ────────────────────────────────────────
      // Up on the stick (negative Y) increases tilt — feels like
      // "pulling the nose up" (looking more forward, less down). 2D
      // mode pins tilt at 0.
      if (rightStick.y !== 0 && view3DRef.current) {
        const currentTilt = map.getTilt() ?? 0;
        const tiltDelta = -rightStick.y * TILT_DEG_PER_SEC * boost * dt;
        const newTilt = clamp(currentTilt + tiltDelta, TILT_MIN, TILT_MAX_3D);
        map.setTilt(newTilt);
      }

      // ── Triggers — tap vs hold ──────────────────────────────────────
      // Tap (short press, < TRIGGER_TAP_MS) fires the altitude-band
      // action on release. Hold (longer) applies continuous zoom every
      // frame the trigger is held past the threshold.
      const handleTrigger = (
        value: number,
        state: TriggerState,
        onTap: (() => void) | undefined,
        zoomDirection: 1 | -1,
      ) => {
        const isPressed = value >= TRIGGER_PRESS_THRESHOLD;

        if (isPressed && !state.pressing) {
          // Press onset.
          state.pressing = true;
          state.pressStartMs = elapsedMs;
        } else if (!isPressed && state.pressing) {
          // Release. If short, fire the tap. Cooldown prevents re-fire
          // from analog noise during the release transition.
          state.pressing = false;
          const heldFor = elapsedMs - state.pressStartMs;
          if (heldFor < TRIGGER_TAP_MS && elapsedMs > state.cooldownUntilMs) {
            onTap?.();
            state.cooldownUntilMs = elapsedMs + TRIGGER_TAP_COOLDOWN_MS;
          }
        } else if (isPressed && elapsedMs - state.pressStartMs >= TRIGGER_TAP_MS) {
          // Hold past the threshold → continuous zoom this frame.
          const currentZoom = map.getZoom() ?? 16;
          const zoomDelta = zoomDirection * value * ZOOM_PER_SEC * boost * dt;
          map.setZoom(clamp(currentZoom + zoomDelta, 3, 21));
        }
      };

      // RT — tap descends an altitude band; hold zooms in.
      handleTrigger(triggers.right, rtStateRef.current, actionsRef.current.onAltitudeDown, 1);
      // LT — tap ascends an altitude band; hold zooms out.
      handleTrigger(triggers.left, ltStateRef.current, actionsRef.current.onAltitudeUp, -1);
    },
  });

  useEffect(() => {
    onStatusChange?.(status.connected, status.label);
  }, [status.connected, status.label, onStatusChange]);

  return null;
}
