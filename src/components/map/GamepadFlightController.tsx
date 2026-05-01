'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { useGamepad } from '@/lib/useGamepad';
import { idleHover, IDLE_THRESHOLD_MS, clamp, type ButtonName } from '@/lib/gamepadActions';

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

// Pan velocity expressed as map-pixels-per-second at full stick deflection.
// Scaled per-frame by stick magnitude and (optionally) boost.
const PAN_PX_PER_SEC = 480;
const HEADING_DEG_PER_SEC = 90;
const TILT_DEG_PER_SEC = 60;
const ZOOM_PER_SEC = 1.4;
const BOOST_MULTIPLIER = 3;

const TILT_MIN = 0;
const TILT_MAX_3D = 67;
const TILT_MAX_2D = 0;
const ZOOM_MIN = 3;
const ZOOM_MAX = 21;

export default function GamepadFlightController({ enabled, view3D, actions, onStatusChange }: Props) {
  const map = useMap();
  // Refs for transient state that shouldn't trigger React re-renders.
  const idleStartRef = useRef<number | null>(null);
  const intensityRef = useRef(0);
  const baseTiltRef = useRef(0);
  const baseHeadingRef = useRef(0);
  const baseZoomRef = useRef<number | null>(null);
  // Latest action callbacks pinned to a ref so the input loop doesn't tear
  // down whenever the parent re-renders.
  const actionsRef = useRef<GamepadActions>(actions);
  actionsRef.current = actions;
  const view3DRef = useRef(view3D);
  view3DRef.current = view3D;

  const status = useGamepad({
    enabled: enabled && !!map,
    onFrame: ({ dt, elapsedMs, leftStick, rightStick, triggers, pressed, justPressed, anyStickActive }) => {
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
        // D-pad: up + left = previous, down + right = next.
        if (justPressed.has('up') || justPressed.has('left')) actionsRef.current.onCyclePrev?.();
        if (justPressed.has('down') || justPressed.has('right')) actionsRef.current.onCycleNext?.();
      }

      // ── Continuous camera updates ───────────────────────────────────
      const boost = pressed.has('lb') ? BOOST_MULTIPLIER : 1;

      // Pan via panBy(deltaPx). Stick X: positive right; Y: positive down
      // (standard Gamepad convention). panBy expects pixels-east, pixels-south.
      if (leftStick.x !== 0 || leftStick.y !== 0) {
        const dxPx = leftStick.x * PAN_PX_PER_SEC * boost * dt;
        const dyPx = leftStick.y * PAN_PX_PER_SEC * boost * dt;
        // map.panBy is on the legacy js api Map; @vis.gl exposes it via instance.
        (map as unknown as google.maps.Map).panBy(dxPx, dyPx);
      }

      // Right stick → heading + tilt. Snapshot base each frame so idle hover
      // can layer on top without drifting permanently.
      const currentHeading = map.getHeading() ?? 0;
      const currentTilt = map.getTilt() ?? 0;
      const currentZoom = map.getZoom() ?? 16;
      baseHeadingRef.current = currentHeading;
      baseTiltRef.current = currentTilt;
      baseZoomRef.current = currentZoom;

      const tiltMax = view3DRef.current ? TILT_MAX_3D : TILT_MAX_2D;

      let headingTarget = currentHeading;
      let tiltTarget = currentTilt;
      let zoomTarget = currentZoom;

      if (rightStick.x !== 0) {
        headingTarget = (currentHeading + rightStick.x * HEADING_DEG_PER_SEC * boost * dt + 360) % 360;
      }
      if (rightStick.y !== 0 && tiltMax > 0) {
        // Stick up (negative y) increases tilt — feels like "look down" / pull up the nose.
        tiltTarget = clamp(currentTilt - rightStick.y * TILT_DEG_PER_SEC * boost * dt, TILT_MIN, tiltMax);
      }

      // Triggers — RT zoom in, LT zoom out.
      const zoomDelta = (triggers.right - triggers.left) * ZOOM_PER_SEC * boost * dt;
      if (zoomDelta !== 0) {
        zoomTarget = clamp(currentZoom + zoomDelta, ZOOM_MIN, ZOOM_MAX);
      }

      // ── Idle hover — kicks in after IDLE_THRESHOLD_MS of stillness ──
      if (anyStickActive) {
        idleStartRef.current = null;
        // Decay intensity quickly when the user takes control again.
        intensityRef.current = Math.max(0, intensityRef.current - dt * 4);
      } else {
        if (idleStartRef.current === null) idleStartRef.current = elapsedMs;
        const idleFor = elapsedMs - idleStartRef.current;
        if (idleFor > IDLE_THRESHOLD_MS) {
          // Ramp intensity 0→1 over 1s.
          intensityRef.current = Math.min(1, intensityRef.current + dt);
        }
      }

      if (intensityRef.current > 0) {
        const off = idleHover(elapsedMs, intensityRef.current);
        headingTarget = (headingTarget + off.headingDelta + 360) % 360;
        if (tiltMax > 0) tiltTarget = clamp(tiltTarget + off.tiltDelta, TILT_MIN, tiltMax);
        zoomTarget = clamp(zoomTarget + off.zoomDelta, ZOOM_MIN, ZOOM_MAX);
      }

      // Apply only if changed — Google complains about excessive setTilt/setHeading calls.
      if (Math.abs(headingTarget - currentHeading) > 0.05) map.setHeading(headingTarget);
      if (Math.abs(tiltTarget - currentTilt) > 0.05) map.setTilt(tiltTarget);
      if (Math.abs(zoomTarget - currentZoom) > 0.001) map.setZoom(zoomTarget);
    },
  });

  useEffect(() => {
    onStatusChange?.(status.connected, status.label);
  }, [status.connected, status.label, onStatusChange]);

  return null;
}
