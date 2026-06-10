'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { useGamepad } from '@/lib/useGamepad';
import { clamp, type ButtonName } from '@/lib/gamepadActions';

export interface GamepadActions {
  /** A — Shoot. Fires the user's armed channel at whatever's under the
   *  reticle. Page checks for a target and dispatches; no-op if nothing
   *  is hovered. Decoupled from LT/RT so triggers can stay full-time zoom. */
  onShoot?: () => void;
  /** X — Rotate armed channel (text → mail → call → text).
   *  NOTE 2026-06-10: X is now bound to onSummonCompanion (call OT)
   *  instead. onRotateChannel is kept (still fires the rotation) but is
   *  unbound from the controller until the outreach flow + its in-flight
   *  channel-arming UI is finished. See [[project-outreach-flow-unfinished]]. */
  onRotateChannel?: () => void;
  /** X — Summon / dismiss Otanimus, the flight companion. */
  onSummonCompanion?: () => void;
  /** Y — Inspect. Open the info card for the hovered target. */
  onInspect?: () => void;
  /** B — Cancel / close popup. */
  onCancel?: () => void;
  /** D-pad up/left — fly to previous nearest target. */
  onCyclePrev?: () => void;
  /** D-pad down/right — fly to next nearest target. */
  onCycleNext?: () => void;
}

export type FlightMode = 'overhead' | 'airplane';

/** Lightweight lead shape used only for hover detection — keeps the controller
 *  decoupled from the full Lead type so we don't pull in unrelated deps. */
export interface ReticleTarget {
  id: string;
  lat: number;
  lng: number;
}

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
  /**
   * Lead pins eligible to be hovered/grabbed by the reticle in airplane
   * mode. Each frame we compute the focal-point lat/lng (forward-thrown
   * from camera by current tilt + altitude) and find the nearest lead.
   * If within ~24 screen-pixels we report it via onReticleTargetChange.
   */
  airplaneTargets?: ReticleTarget[];
  /**
   * Fires when the hovered target changes (including null → some target,
   * target → different target, target → null). Page uses this to drive
   * the reticle visual + LT-press grab decision.
   */
  onReticleTargetChange?: (target: ReticleTarget | null) => void;
  /**
   * Shared ref containing the parcel-hit-tester function (set by
   * ParcelOverlay). The controller calls it each frame at the reticle
   * pixel when the pin-DOM hit-test misses, so flying over a parcel
   * makes the reticle react even without real mouse motion. Null while
   * the parcel layer is off or before any features have loaded.
   */
  parcelHitTesterRef?: React.MutableRefObject<((x: number, y: number) => { apn: string; lat: number; lng: number } | null) | null>;
  /**
   * Fires when the parcel under the reticle changes. Drives page-side
   * reticleParcelRef + reticleHovering state so the reticle gets the
   * hand-icon over parcels (just like over pins).
   */
  onParcelHoverChange?: (apn: string | null, latLng: { lat: number; lng: number } | null) => void;
  /**
   * Reticle screen position as 0..1 viewport fractions. User-draggable
   * and persisted in localStorage; the controller samples its hit-test
   * pixel from this position and synthesizes pointermove events here
   * during flight so Google's parcel-overlay hover hit-test fires at
   * the reticle (not the OS cursor's last known position).
   */
  reticleXFraction?: number;
  reticleYFraction?: number;
  /**
   * Reports the focal-point screen-Y as a 0..1 viewport fraction so the
   * page can position the reticle visual on the actual visual center,
   * not CSS-center (which sits below the focal point under tilt).
   * Retained for potential consumers but not used while drag-to-place
   * owns the reticle position.
   */
  onFocalScreenYChange?: (fraction: number) => void;
  /** Reports controller status up to the page so it can render a toast. */
  onStatusChange?: (connected: boolean, label: string | null) => void;
  /** Debug-only: when true, the controller runs its full loop (sticks read,
   *  buttons fire, grab/orbit logic, hover-wave math computed) but the
   *  per-frame moveCamera()/setCenter() applies are SKIPPED. The camera
   *  doesn't actually move. Used to isolate whether per-frame map mutation
   *  is what breaks Google's POI hover hit-test in airplane mode. */
  debugSuspendMoveCamera?: boolean;
  /** Debug-only: when true, ALWAYS use the absolute-setter fallback path
   *  (setCenter + setHeading + setTilt + setZoom) instead of moveCamera().
   *  Tests whether the fallback path keeps POI hover alive while still
   *  delivering smooth flight feel. */
  debugForceFallbackPath?: boolean;
  /** Debug-only: when true, after each moveCamera() call also fire a no-op
   *  map.setOptions({ clickableIcons: true }) to "tickle" Google's POI
   *  pipeline. Tests whether a follow-up call can rescue hover without
   *  giving up moveCamera's smoothness. */
  debugTickleAfterMoveCamera?: boolean;
  /** Master flight-speed multiplier from user tuning (useFlightTuning).
   *  Scales pan/tilt/zoom acceleration. Yaw is broken out as its own
   *  multiplier (turnRateMultiplier). 1.0 = the default tuned-to-
   *  cessna feel; 0.6 = newcomer; 1.6 = pro. */
  flightSpeedMultiplier?: number;
  /** Turn-rate multiplier — scales yaw (right-X) acceleration only.
   *  Independent of flight speed so users can dial cinematic-slow
   *  horizon pans without slowing their pan/throttle. Default 1.0. */
  turnRateMultiplier?: number;
  /** Tilt-rate multiplier — scales tilt (right-Y look up/down)
   *  acceleration only. Independent of flight speed so slowing
   *  pan doesn't slow how fast the user can look up. Default 1.0. */
  tiltRateMultiplier?: number;
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
// Strafe — sideways pan (left-X). Same shape as throttle so they
// compose naturally when the user hand-compensates against right-X yaw.
const AIR_STRAFE_ACCEL = 600;        // px/s²
const AIR_STRAFE_DRAG = 0.96;
const AIR_STRAFE_MAX = 320;          // px/s
// Yaw — slow heavy rotation (right-X). Tuned at ~30°/s top speed so
// the user can hand-compensate against it with left-X strafe. The pivot
// fake is intentionally OFF in airplane mode (see below) — the user
// applies their own compensation in real time.
const AIR_YAW_ACCEL = 75;            // deg/s²
const AIR_YAW_DRAG = 0.94;
const AIR_YAW_MAX = 30;              // deg/s top speed

// ── Trigger press detection ───────────────────────────────────────────
// LT/RT are pure zoom — no grab gate, no fire-armed modifier. The shoot
// action is on A; nothing else competes for the triggers.
const TRIGGER_PRESS_THRESHOLD = 0.4;

export default function GamepadFlightController({
  enabled,
  view3D,
  actions,
  mode = 'overhead',
  airplaneTargets,
  reticleXFraction = 0.5,
  reticleYFraction = 0.42,
  parcelHitTesterRef,
  onReticleTargetChange,
  onParcelHoverChange,
  onFocalScreenYChange,
  onStatusChange,
  debugSuspendMoveCamera = false,
  debugForceFallbackPath = false,
  debugTickleAfterMoveCamera = false,
  flightSpeedMultiplier = 1.0,
  turnRateMultiplier = 1.0,
  tiltRateMultiplier = 1.0,
}: Props) {
  const map = useMap();

  // Persistent physics state. None of this lives in React state — the input
  // loop owns it and we only call into Google Maps once per frame.
  // Overhead model uses panX/panY/heading/tilt/zoom velocities. Airplane
  // model uses throttle (forward speed in screen px/s), strafe, yaw.
  const velRef = useRef({ panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 });
  const airRef = useRef({ throttle: 0, strafe: 0, yaw: 0 });
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
  const debugSuspendMoveCameraRef = useRef<boolean>(debugSuspendMoveCamera);
  debugSuspendMoveCameraRef.current = debugSuspendMoveCamera;
  const debugForceFallbackPathRef = useRef<boolean>(debugForceFallbackPath);
  debugForceFallbackPathRef.current = debugForceFallbackPath;
  const debugTickleAfterMoveCameraRef = useRef<boolean>(debugTickleAfterMoveCamera);
  debugTickleAfterMoveCameraRef.current = debugTickleAfterMoveCamera;
  // Live refs for hover detection that runs each frame.
  const airplaneTargetsRef = useRef<ReticleTarget[] | undefined>(airplaneTargets);
  airplaneTargetsRef.current = airplaneTargets;
  const onReticleTargetChangeRef = useRef(onReticleTargetChange);
  onReticleTargetChangeRef.current = onReticleTargetChange;
  const onFocalScreenYChangeRef = useRef(onFocalScreenYChange);
  onFocalScreenYChangeRef.current = onFocalScreenYChange;
  const onParcelHoverChangeRef = useRef(onParcelHoverChange);
  onParcelHoverChangeRef.current = onParcelHoverChange;
  // Last APN reported via onParcelHoverChange so we only fire the
  // callback on actual transitions, not every frame the cursor stays
  // inside the same parcel.
  const lastReportedParcelApnRef = useRef<string | null>(null);
  // User-set reticle position. Live refs so the per-frame hit-test
  // samples the up-to-date position without subscribing to re-renders.
  const reticleXFractionRef = useRef<number>(reticleXFraction);
  reticleXFractionRef.current = reticleXFraction;
  const reticleYFractionRef = useRef<number>(reticleYFraction);
  reticleYFractionRef.current = reticleYFraction;
  // User flight-speed multiplier from useFlightTuning — applied to
  // accel terms each frame so live-sliding the panel produces
  // immediate feel change without re-subscribing the RAF loop.
  const flightSpeedMultiplierRef = useRef<number>(flightSpeedMultiplier);
  flightSpeedMultiplierRef.current = flightSpeedMultiplier;
  // Turn rate is yaw-only — separate ref so the per-frame loop reads
  // the latest slider value without re-subscribing.
  const turnRateMultiplierRef = useRef<number>(turnRateMultiplier);
  turnRateMultiplierRef.current = turnRateMultiplier;
  const tiltRateMultiplierRef = useRef<number>(tiltRateMultiplier);
  tiltRateMultiplierRef.current = tiltRateMultiplier;
  // Track last reported target id to avoid firing the callback every frame.
  const lastReportedTargetIdRef = useRef<string | null>(null);
  // Live reticle-hovering flag the LT-press handler reads each frame.
  const reticleHoveringRef = useRef(false);
  // Last known mouse cursor position in viewport coords. Used to synthesize
  // pointermove events on the map container during active flight, so Google's
  // canvas-rendered POI hover hit-test (which only fires on real pointer
  // events) re-runs as the world slides under the stationary cursor.
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  // Throttle for the synthetic pointermove dispatch — ~30Hz max.
  const lastSyntheticPointerMsRef = useRef<number>(0);

  // Trigger press state. LT also tracks whether the press began over a
  // hovering reticle target — that locks LT into "grab gate" mode for
  // the duration of the hold.
  // Reset our owned camera state whenever the map instance changes (e.g.
  // walk mode toggle). Otherwise we carry stale center/heading from before.
  useEffect(() => {
    camRef.current = null;
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
    airRef.current = { throttle: 0, strafe: 0, yaw: 0 };
  }, [map]);

  // When the user toggles flight mode, zero out velocities so we don't carry
  // momentum from a different model into the new one.
  useEffect(() => {
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, zoom: 0 };
    airRef.current = { throttle: 0, strafe: 0, yaw: 0 };
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

      // ── Reticle hover detection (airplane mode only) ────────────────
      // Use the browser's native hit-testing — same machinery the mouse
      // cursor uses. Each lead pin has data-lead-id stamped on its
      // wrapper div by AdvancedLeadMarkers. We sample the pixel at the
      // user-placed reticle position (drag-to-place; persisted in
      // localStorage) and walk up the DOM until we find an element
      // with that attribute. Zero projection math; works regardless of
      // how the map renders tilt, vector vs raster, etc.
      if (modeRef.current === 'airplane') {
        // Map div = the element that wraps the gmp-map-3d / gm-style
        // root. The reticle position is a 0..1 viewport fraction set
        // by the user dragging the visual reticle; we sample the pixel
        // at exactly that fraction inside the map's rect.
        const mapDiv = (map as unknown as { getDiv?: () => HTMLElement }).getDiv?.();
        let hitId: string | null = null;
        let parcelHit: { apn: string; lat: number; lng: number } | null = null;

        if (mapDiv) {
          const rect = mapDiv.getBoundingClientRect();
          // Document-space coords for the pin DOM hit-test.
          const cxDoc = rect.left + rect.width * reticleXFractionRef.current;
          const cyDoc = rect.top + rect.height * reticleYFractionRef.current;
          // Container-space coords for the ParcelOverlay hit-tester.
          const cxLocal = rect.width * reticleXFractionRef.current;
          const cyLocal = rect.height * reticleYFractionRef.current;

          // Pin hit-test first — pins win over parcels on overlap.
          // elementsFromPoint gives us the full stack at that pixel —
          // necessary because pin DOM may have inner elements blocking
          // the data-lead-id wrapper from being the topmost node.
          if (airplaneTargetsRef.current && airplaneTargetsRef.current.length > 0) {
            const stack = typeof document.elementsFromPoint === 'function'
              ? document.elementsFromPoint(cxDoc, cyDoc)
              : (() => {
                  const el = document.elementFromPoint(cxDoc, cyDoc);
                  return el ? [el] : [];
                })();
            for (const node of stack) {
              const found = (node as HTMLElement).closest?.('[data-lead-id]') as HTMLElement | null;
              if (found && found.dataset.leadId) {
                hitId = found.dataset.leadId;
                break;
              }
            }
          }

          // Parcel hit-test only when pin missed. ParcelOverlay's
          // containsLocation-based tester works during camera motion
          // (it asks our own geometry, not Google's mouseover events
          // which only fire on real cursor motion).
          if (!hitId) {
            const tester = parcelHitTesterRef?.current;
            if (tester) parcelHit = tester(cxLocal, cyLocal);
          }
        }

        const pinHit = hitId && airplaneTargetsRef.current
          ? (airplaneTargetsRef.current.find(t => t.id === hitId) || null)
          : null;
        reticleHoveringRef.current = !!pinHit || !!parcelHit;

        if ((pinHit?.id ?? null) !== lastReportedTargetIdRef.current) {
          lastReportedTargetIdRef.current = pinHit?.id ?? null;
          onReticleTargetChangeRef.current?.(pinHit);
        }
        // Report parcel-under-reticle transitions to page-side state.
        const newParcelApn = pinHit ? null : (parcelHit?.apn ?? null);
        if (newParcelApn !== lastReportedParcelApnRef.current) {
          lastReportedParcelApnRef.current = newParcelApn;
          if (newParcelApn && parcelHit) {
            onParcelHoverChangeRef.current?.(newParcelApn, { lat: parcelHit.lat, lng: parcelHit.lng });
          } else {
            onParcelHoverChangeRef.current?.(null, null);
          }
        }
      } else {
        // Outside airplane mode, ensure no stale hover sticks around.
        if (reticleHoveringRef.current) reticleHoveringRef.current = false;
        if (lastReportedTargetIdRef.current !== null) {
          lastReportedTargetIdRef.current = null;
          onReticleTargetChangeRef.current?.(null);
        }
        if (lastReportedParcelApnRef.current !== null) {
          lastReportedParcelApnRef.current = null;
          onParcelHoverChangeRef.current?.(null, null);
        }
      }

      // ── Edge-triggered button actions ───────────────────────────────
      // Game-loop bindings: A=shoot (fire armed channel at hovered target),
      // X=rotate (cycle armed channel), Y=inspect (open info card),
      // B=cancel. Triggers are full-time zoom; there's no grab modifier.
      // Every parcel in covered counties is a target, so a grab-gate
      // would have eaten zoom across the whole map.
      if (justPressed.size > 0) {
        const fire = (name: ButtonName, fn?: () => void) => {
          if (justPressed.has(name) && fn) fn();
        };
        fire('a', actionsRef.current.onShoot);
        // X now summons OT (was onRotateChannel — see type note +
        // [[project-outreach-flow-unfinished]]).
        fire('x', actionsRef.current.onSummonCompanion);
        fire('y', actionsRef.current.onInspect);
        fire('b', actionsRef.current.onCancel);
        if (justPressed.has('up') || justPressed.has('left')) actionsRef.current.onCyclePrev?.();
        if (justPressed.has('down') || justPressed.has('right')) actionsRef.current.onCycleNext?.();
      }

      // ── Trigger handling ────────────────────────────────────────────
      // LT held = continuous zoom in. RT held = continuous zoom out.
      // Both full-time, no gameplay modifiers. The shoot action lives
      // on A; nothing else competes with the triggers anymore.
      let triggerZoomDelta = 0;

      if (triggers.right >= TRIGGER_PRESS_THRESHOLD) {
        triggerZoomDelta -= triggers.right;
      }
      if (triggers.left >= TRIGGER_PRESS_THRESHOLD) {
        triggerZoomDelta += triggers.left;
      }

      // ── Physics integration ─────────────────────────────────────────
      // `boost` = LB-hold boost × user's Flight Speed multiplier (from
      // useFlightTuning). Applied to pan / tilt / zoom accel.
      // `boostYaw` = same LB-hold × the Turn Rate multiplier (separate
      // user axis). Applied to yaw accel only. Lets users dial slow
      // cinematic turns with snappy pan (or vice versa) without one
      // slider doing both jobs.
      const lbBoost = pressed.has('lb') ? PAN_BOOST_MULT : 1;
      const boost = lbBoost * flightSpeedMultiplierRef.current;
      const boostYaw = lbBoost * turnRateMultiplierRef.current;
      const boostTilt = lbBoost * tiltRateMultiplierRef.current;
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
        vel.heading += rx * HEAD_ACCEL_DEG_S2 * boostYaw * dt;
        vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boostTilt * dt; // up = look up
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
        // ── Airplane (drone-style) ────────────────────────────────────
        //   Left X  → strafe sideways (slide, heading unchanged)
        //   Left Y  → throttle (forward/back along heading)
        //   Right X → yaw (turn the nose). NO pivot fake — the user
        //             hand-compensates with left-X strafe in the
        //             opposite direction to hold position.
        //   Right Y → tilt only (altitude is trigger-driven).
        // Triggers (LT/RT) are pure zoom; the shoot action lives on A
        // and doesn't touch flight feel.
        const air = airRef.current;

        air.throttle += -ly * AIR_THROTTLE_ACCEL * boost * dt;
        air.strafe += lx * AIR_STRAFE_ACCEL * boost * dt;
        air.yaw += rx * AIR_YAW_ACCEL * boostYaw * dt;

        air.throttle *= Math.pow(AIR_THROTTLE_DRAG, dragExp);
        air.strafe *= Math.pow(AIR_STRAFE_DRAG, dragExp);
        air.yaw *= Math.pow(AIR_YAW_DRAG, dragExp);

        air.throttle = clamp(air.throttle, -AIR_THROTTLE_MAX * 0.4, AIR_THROTTLE_MAX);
        air.strafe = clamp(air.strafe, -AIR_STRAFE_MAX, AIR_STRAFE_MAX);
        air.yaw = clamp(air.yaw, -AIR_YAW_MAX, AIR_YAW_MAX);

        if (Math.abs(air.throttle) < 0.5) air.throttle = 0;
        if (Math.abs(air.strafe) < 0.5) air.strafe = 0;
        if (Math.abs(air.yaw) < 0.05) air.yaw = 0;

        // Tilt: direct velocity-driven, always available.
        vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boostTilt * dt;
        vel.tilt *= Math.pow(TILT_DRAG, dragExp);
        vel.tilt = clamp(vel.tilt, -TILT_MAX_DEG_S, TILT_MAX_DEG_S);
        if (Math.abs(vel.tilt) < 0.05) vel.tilt = 0;

        // Translate airplane state into shared vel struct.
        vel.panX = air.strafe;
        vel.panY = -air.throttle;
        vel.heading = air.yaw;

        // Zoom is trigger-driven only.
        vel.zoom = triggerZoomDelta * ZOOM_ACCEL_S2 * boost * dt;
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

      // ── Sideways pivot fake (overhead only) ─────────────────────────
      // When heading rotates by Δθ this frame, also pan the camera laterally
      // by R × sin(Δθ) so the visual focal point stays put. Skipped in
      // airplane mode — there the user hand-compensates with left-X strafe
      // against right-X yaw (drone-pilot style), and our compensation
      // would fight theirs.
      if (modeRef.current === 'overhead' && projection && Math.abs(headingDeltaThisFrame) > 0.001) {
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
      // Debug-only: if debugSuspendMoveCamera is on, skip the entire apply.
      // The rest of the loop has already run (physics, button edges, etc.)
      // — we're only isolating whether the map-side mutation is what
      // breaks Google's POI hover hit-test.
      if (debugSuspendMoveCameraRef.current) {
        return;
      }
      type MoveCamera = (opts: {
        center: { lat: number; lng: number };
        heading: number;
        tilt: number;
        zoom: number;
      }) => void;
      const mc = (map as unknown as { moveCamera?: MoveCamera }).moveCamera;
      const headingApplied = (cam.heading + hoverHeading + 360) % 360;
      const tiltApplied = clamp(cam.tilt + hoverTilt, TILT_MIN, tiltMax || TILT_MIN);

      const useFallback = debugForceFallbackPathRef.current || typeof mc !== 'function';

      if (!useFallback && mc) {
        mc.call(map, {
          center: { lat: appliedLat, lng: appliedLng },
          heading: headingApplied,
          tilt: tiltApplied,
          zoom: cam.zoom,
        });
        // Debug-only: tickle Google's POI hit-test pipeline by writing a
        // no-op options change after moveCamera. Tests whether the tickle
        // rescues hover without giving up moveCamera's smoothness.
        if (debugTickleAfterMoveCameraRef.current) {
          (map as unknown as { setOptions?: (o: object) => void }).setOptions?.({
            clickableIcons: true,
          });
        }
      } else {
        // Fallback path: absolute setters. Used always for raster maps
        // (no moveCamera available), and in debug-only mode for testing
        // whether this path preserves POI hover.
        map.setCenter({ lat: appliedLat, lng: appliedLng });
        if (Math.abs(mapHeading - headingApplied) > 0.05) map.setHeading(headingApplied);
        if (Math.abs(mapTilt - tiltApplied) > 0.05) map.setTilt(tiltApplied);
        if (Math.abs(mapZoom - cam.zoom) > 0.001) map.setZoom(cam.zoom);
      }

      // ── Keep Google's POI hover hit-test alive while flying ─────────
      // The world slides under a stationary cursor; Google's canvas POI
      // hover only fires on real pointer events. Dispatch a synthetic
      // PointerEvent on the map container at ~30Hz so the POI hand-cursor
      // tracks what's under the cursor as we fly.
      //
      // Fire only when the user is actively driving (input or velocity).
      // When fully idle, real mouse motion handles hover normally.
      const v = velRef.current;
      const a = airRef.current;
      const isDriving =
        leftStick.magnitude > 0.02 ||
        rightStick.magnitude > 0.02 ||
        triggers.left > 0.05 ||
        triggers.right > 0.05 ||
        Math.abs(v.panX) > 0.5 ||
        Math.abs(v.panY) > 0.5 ||
        Math.abs(v.heading) > 0.05 ||
        Math.abs(v.tilt) > 0.05 ||
        Math.abs(v.zoom) > 0.001 ||
        Math.abs(a.throttle) > 0.5 ||
        Math.abs(a.strafe) > 0.5 ||
        Math.abs(a.yaw) > 0.05;

      if (isDriving) {
        const nowMs = elapsedMs;
        if (nowMs - lastSyntheticPointerMsRef.current > 33) {
          const mapDiv = (map as unknown as { getDiv?: () => HTMLElement }).getDiv?.();
          // In airplane mode the synthetic event targets the reticle
          // pixel (where the user is *aiming*, not where the OS cursor
          // happens to be). In overhead mode we fall back to the real
          // cursor's last position.
          let targetXY: { x: number; y: number } | null = null;
          if (mapDiv && modeRef.current === 'airplane') {
            const rect = mapDiv.getBoundingClientRect();
            targetXY = {
              x: rect.left + rect.width * reticleXFractionRef.current,
              y: rect.top + rect.height * reticleYFractionRef.current,
            };
          } else if (lastMousePosRef.current) {
            targetXY = { ...lastMousePosRef.current };
          }
          if (mapDiv && targetXY) {
            lastSyntheticPointerMsRef.current = nowMs;
            const { x, y } = targetXY;
            try {
              const evt = new PointerEvent('pointermove', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                pointerType: 'mouse',
                isPrimary: true,
              });
              mapDiv.dispatchEvent(evt);
            } catch {
              // Some browsers may not support PointerEvent constructor;
              // fall back to MouseEvent in that case.
              const evt = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                view: window,
              });
              mapDiv.dispatchEvent(evt);
            }
          }
        }
      }
    },
  });

  useEffect(() => {
    onStatusChange?.(status.connected, status.label);
  }, [status.connected, status.label, onStatusChange]);

  // Track the real mouse cursor so the per-frame synthetic pointermove
  // dispatch has an accurate target position.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return null;
}
