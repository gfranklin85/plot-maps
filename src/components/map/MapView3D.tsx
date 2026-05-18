"use client";

import { useEffect, useMemo, useRef } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MAP_CENTER } from "@/lib/constants";
import { useGamepad } from "@/lib/useGamepad";
import type { ButtonName } from "@/lib/gamepadActions";
import type { MapViewProps } from "./MapView";
import type { GamepadActions } from "./GamepadFlightController";
import { AtmosphereProvider } from "@/lib/atmosphere/AtmosphereContext";
import AtmosphereOverlay from "./AtmosphereOverlay";
import SkyDome from "./SkyDome";

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
// Base physics constants — tuned 2026-05-17 so 1.0× = HELICOPTER
// cruise feel: slow enough for low-altitude weaving between
// buildings, fast enough to feel responsive. User taste-tunes from
// mid-slider in both directions.
//
// Previous "1.0×" was still too fast at the bottom; this round cuts
// throttle/strafe another ~1.5× and yaw stays where it was (turn
// rate gets its own slider anyway). Tilt is now broken out as its
// own slider so cutting its base doesn't fight pan tuning.
const AIR_THROTTLE_ACCEL = 170;
const AIR_THROTTLE_DRAG = 0.965;
const AIR_THROTTLE_MAX = 85;
const AIR_STRAFE_ACCEL = 150;
const AIR_STRAFE_DRAG = 0.96;
const AIR_STRAFE_MAX = 75;
// Yaw bumped 2026-05-18 — Greg flagged even 4× slider felt "small
// window of slow to slower." Prior MAX=11 deg/s capped a full spin
// at 8+ seconds; new MAX=45 deg/s puts a snappy spin at ~8s base /
// ~2s at the top of the turn slider. Accel scaled to match.
const AIR_YAW_ACCEL = 110;
const AIR_YAW_DRAG = 0.94;
const AIR_YAW_MAX = 45;
const TILT_ACCEL_DEG_S2 = 80;
const TILT_DRAG = 0.86;
const TILT_MAX_DEG_S = 26;
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

// LB/RB dolly zoom — moves the eye forward (LB) or backward (RB) along
// the current view direction. Rate is multiplied by current range so
// it feels equally responsive at any altitude. Triggers (LT down /
// RT up) modulate this *analog* — a light squeeze descends gently,
// a full pull descends fast. Combined with the user's climb-rate
// slider (which scales the max), this gives real flight-control feel
// instead of a button's binary "moving / not moving."
// 0.2 base — Greg flagged 0.5 was "spaceship fast" at the middle
// slider value. At 0.2: full trigger + 1.0× climb-rate slider =
// ~20% of current range traveled per second. Light-touch trigger
// + low slider = barely drifting. Fine modulation, real feel.
const ZOOM_DOLLY_RATE_PER_SEC = 0.2;


const METERS_PER_DEG_LAT = 111_320;

// pan velocity (screen px / sec) → meters at current range. Tuned to
// match the 2D path's perceived speed at typical fly altitude. The 2D
// path's vel.panX is screen pixels at a known zoom level; at range
// ~700m (default 3D seed) the perceived feel should match a typical
// zoom-17 2D session. Anchored empirically — too low felt sluggish,
// too high (the prior failed port) flew past the world.
function metersPerScreenPixel(range: number): number {
  // Anchor tuned to feel like the 2D path's screen-pan speed. Range
  // 700m default; at this divisor a full-stick push covers ground
  // at roughly the same rate as a typical zoom-17 2D fly.
  return range / 1500;
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
  // Google clamps tilt at 0-85 internally; we still clamp here only
  // because Map3DElement throws on out-of-range writes. The internal
  // value of cam.pitch is allowed to overshoot — only the WRITE is
  // bounded. This way the user's "look up" gesture doesn't get stuck
  // at a saturated pitch; releasing the stick lets pitch coast back.
  const map3dTilt = clamp(90 + cam.pitch, 0, 85);

  // Place focal point along the view ray. Key constraint Google enforces:
  // Map3D silently clamps focal-point altitude to >= 0 (ground level).
  // If we write a negative focal altitude, Google ignores our entire
  // {center, range} pair and re-derives the camera position based on
  // its own clamped focal — meaning OUR cam.altitude is no longer the
  // actual rendered eye altitude. That's why dolly-down hits an
  // invisible floor at ~30m: focal goes underground long before eye
  // does, Google clamps, camera position drifts away from what we want.
  //
  // Fix: dynamically shorten `range` so the focal lands AT ground level
  // when looking down, never below. Math: focal_altitude = eye_altitude
  // + range * sin(pitch). We want focal_altitude >= 0, so when looking
  // down (pitch < 0), max usable range = -eye_altitude / sin(pitch).
  // We pick the smaller of cam.range and that ground-distance, so the
  // focal-point sits exactly on the ground (not underneath).
  const pitchRad = (cam.pitch * Math.PI) / 180;
  const sinPitch = Math.sin(pitchRad);
  let useRange = cam.range;
  if (sinPitch < 0 && cam.altitude > 0) {
    const maxRangeBeforeGround = -cam.altitude / sinPitch;
    if (maxRangeBeforeGround < useRange) useRange = maxRangeBeforeGround;
  }
  // Floor so range can't go to zero (degenerate camera).
  if (useRange < 1) useRange = 1;

  const horizDist = useRange * Math.cos(pitchRad);
  const vertDist = useRange * sinPitch;
  const headingRad = (cam.heading * Math.PI) / 180;
  const dEast = horizDist * Math.sin(headingRad);
  const dNorth = horizDist * Math.cos(headingRad);
  const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
  // Floor focal altitude at 0 (terrain). The math above should keep
  // it >= 0, but belt-and-suspenders.
  const focalAlt = Math.max(0, cam.altitude + vertDist);
  return {
    center: {
      lat: cam.lat + dNorth / METERS_PER_DEG_LAT,
      lng: cam.lng + dEast / (METERS_PER_DEG_LAT * cosLat),
      altitude: focalAlt,
    },
    heading: cam.heading,
    tilt: map3dTilt,
    range: useRange,
  };
}

// Cinematic flight target — when the page sets a new value (new
// object identity per trigger), MapView3D animates the camera from
// current pose to this pose over ~2.5s. After arrival, normal
// gamepad flight resumes from the new pose.
export interface FlyToTarget {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  pitch: number;
  range: number;
  /** Optional override duration. Default ~2500ms. */
  durationMs?: number;
}

function Inner({
  center,
  gamepadEnabled,
  gamepadActions,
  flightSpeedMultiplier = 1.0,
  climbRateMultiplier = 1.0,
  turnRateMultiplier = 1.0,
  tiltRateMultiplier = 1.0,
  flyToTarget,
  onAltitudeChange,
  isIdle = false,
  poisVisible = false,
}: {
  center?: { lat: number; lng: number } | null;
  gamepadEnabled: boolean;
  gamepadActions?: GamepadActions;
  flightSpeedMultiplier?: number;
  climbRateMultiplier?: number;
  turnRateMultiplier?: number;
  tiltRateMultiplier?: number;
  flyToTarget?: FlyToTarget | null;
  onAltitudeChange?: (meters: number) => void;
  /** True when no input for >threshold. Stops camera writes + hover
   *  wave + altitude reporting until next input. Pure GPU savings;
   *  resumes instantly on input. */
  isIdle?: boolean;
  /** Google POI labels + business icons visible? Default false for
   *  the immersive map framing. Wired to gmp-map-3d's
   *  default-labels-disabled attribute. */
  poisVisible?: boolean;
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
  // Live multiplier ref so per-frame loop reads the latest value
  // without re-subscribing — moving the slider changes flight
  // feel immediately while panel is open.
  const speedMultRef = useRef<number>(flightSpeedMultiplier);
  speedMultRef.current = flightSpeedMultiplier;
  // Separate ref for climb rate so dolly speed can scale independently
  // of pan/yaw/tilt. Some users want fast pan + cinematic descent.
  const climbMultRef = useRef<number>(climbRateMultiplier);
  climbMultRef.current = climbRateMultiplier;
  // Separate ref for turn rate (yaw / right-X). Independent of pan
  // speed so users can dial slow horizon pans + snappy throttle (or
  // vice versa).
  const turnMultRef = useRef<number>(turnRateMultiplier);
  turnMultRef.current = turnRateMultiplier;
  // Separate ref for tilt rate (pitch / right-Y look up/down). Greg
  // flagged that bundling tilt with flight speed felt wrong — slowing
  // pan also slowed tilt, making the camera barely able to look up.
  // Independent so tilt always feels right regardless of pan slider.
  const tiltMultRef = useRef<number>(tiltRateMultiplier);
  tiltMultRef.current = tiltRateMultiplier;
  // Idle flag — read each frame to skip the writes entirely when the
  // user isn't watching.
  const isIdleRef = useRef<boolean>(isIdle);
  isIdleRef.current = isIdle;
  // Altitude reporting throttle — the per-frame loop pings the page's
  // AltitudeGauge via onAltitudeChange, but only ~5×/sec to avoid
  // React state churn at 60Hz.
  const onAltitudeChangeRef = useRef(onAltitudeChange);
  onAltitudeChangeRef.current = onAltitudeChange;
  const lastAltitudeReportMsRef = useRef<number>(0);
  const lastReportedAltitudeRef = useRef<number>(-1);
  // Cinematic flight animation state. When non-null, the per-frame
  // gamepad input is suppressed and we interpolate from `from` to
  // `to` over `durationMs`. After arrival, returns to normal flight.
  const flyAnimRef = useRef<{
    from: FpCam;
    to: { lat: number; lng: number; altitude: number; heading: number; pitch: number; range: number };
    startMs: number;
    durationMs: number;
  } | null>(null);

  // Trigger cinematic flight when flyToTarget changes (new object
  // identity from the page). Snapshots current eye pose as the
  // animation's `from`; a dedicated RAF loop interpolates from →
  // to over durationMs with eased lat/lng/altitude/heading/pitch
  // PLUS an arc-altitude lift so intercontinental hops swoop up
  // and over instead of skimming flat at low altitude.
  useEffect(() => {
    if (!flyToTarget || !camRef.current || !elRef.current) return;
    flyAnimRef.current = {
      from: { ...camRef.current },
      to: {
        lat: flyToTarget.lat,
        lng: flyToTarget.lng,
        altitude: flyToTarget.altitude,
        heading: flyToTarget.heading,
        pitch: flyToTarget.pitch,
        range: flyToTarget.range,
      },
      startMs: performance.now(),
      durationMs: flyToTarget.durationMs ?? 2500,
    };
    // Zero out gamepad velocity state so input doesn't fight the
    // animation when it lands.
    airRef.current = { throttle: 0, strafe: 0, yaw: 0 };
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0 };

    // RAF loop for the animation. Self-cancels when the animation
    // finishes. Runs independent of the gamepad loop so destinations
    // work whether or not a controller is connected.
    let rafId: number;
    function tick() {
      const anim = flyAnimRef.current;
      const el = elRef.current;
      const cam = camRef.current;
      if (!anim || !el || !cam) return;
      const now = performance.now();
      const t = Math.min(1, (now - anim.startMs) / anim.durationMs);
      // Cubic ease-in-out — slow start, fast middle, slow end.
      const eased = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Lerp the simple scalars.
      // Heading uses shortest-path interpolation (avoid going the long
      // way around when from=350° and to=10°).
      const dHeading = ((anim.to.heading - anim.from.heading + 540) % 360) - 180;
      cam.lat      = anim.from.lat      + (anim.to.lat      - anim.from.lat)      * eased;
      cam.lng      = anim.from.lng      + (anim.to.lng      - anim.from.lng)      * eased;
      cam.heading  = (anim.from.heading + dHeading * eased + 360) % 360;
      cam.pitch    = anim.from.pitch    + (anim.to.pitch    - anim.from.pitch)    * eased;
      cam.range    = anim.from.range    + (anim.to.range    - anim.from.range)    * eased;
      // Altitude gets an arc lift on top of the base interpolation —
      // peaks at the midpoint, scaled by hop distance so short hops
      // barely rise and intercontinental hops climb dramatically.
      const baseAlt = anim.from.altitude + (anim.to.altitude - anim.from.altitude) * eased;
      const hopDistDeg = Math.hypot(anim.to.lat - anim.from.lat, anim.to.lng - anim.from.lng);
      const arcHeight = Math.min(50_000, hopDistDeg * 400);  // meters; capped sane
      const archParabola = 4 * t * (1 - t);                  // 0..1..0
      cam.altitude = baseAlt + arcHeight * archParabola;
      // Write to element via the same fpToMap3D conversion.
      const m3d = fpToMap3D(cam);
      el.center = m3d.center;
      el.heading = m3d.heading;
      el.tilt = m3d.tilt;
      el.range = m3d.range;
      // Throttled altitude report during the cinematic flight too,
      // so the altimeter sweeps through during the arc.
      if (now - lastAltitudeReportMsRef.current > 100) {
        if (Math.abs(cam.altitude - lastReportedAltitudeRef.current) > 0.5) {
          lastReportedAltitudeRef.current = cam.altitude;
          onAltitudeChangeRef.current?.(cam.altitude);
        }
        lastAltitudeReportMsRef.current = now;
      }
      if (t >= 1) {
        flyAnimRef.current = null;  // done
        return;
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [flyToTarget]);

  // Mount the gmp-map-3d element once the maps3d library is loaded.
  useEffect(() => {
    if (!maps3d || !containerRef.current) return;
    if (elRef.current) return;
    const seed = center ?? MAP_CENTER;
    const el = document.createElement('gmp-map-3d') as Map3DElement;
    el.style.width = '100%';
    el.style.height = '100%';
    el.setAttribute('mode', 'hybrid');
    // POI labels: default-labels-disabled inverts our prop.
    // poisVisible=true → labels visible → attribute = 'false'.
    el.setAttribute('default-labels-disabled', poisVisible ? 'false' : 'true');
    containerRef.current.appendChild(el);
    elRef.current = el;
    // Seed at ~80m altitude — comfortable cruise over residential
    // (well above rooftops, below low-altitude clouds), looking
    // forward + slightly down (pitch -25). Previous 300m put the
    // user in a "satellite-view" mindset instead of "flying around
    // the neighborhood." Lower seed gets them straight to the
    // useful zone.
    camRef.current = {
      lat: seed.lat, lng: seed.lng, altitude: 80,
      heading: 0, pitch: -25, range: 700,
    };
    airRef.current = { throttle: 0, strafe: 0, yaw: 0 };
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0 };
    // Initial write to Map3D.
    const m3d = fpToMap3D(camRef.current);
    el.center = m3d.center;
    el.heading = m3d.heading;
    el.tilt = m3d.tilt;
    el.range = m3d.range;
    // Initial altitude report so the gauge shows a value immediately
    // (don't wait for the first gamepad frame).
    onAltitudeChangeRef.current?.(camRef.current.altitude);
    return () => {
      el.remove();
      elRef.current = null;
      camRef.current = null;
    };
    // poisVisible is intentionally excluded — seeding the initial
    // attribute on mount is the only thing it does here; the reactive
    // effect just below handles subsequent toggles without remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maps3d, center]);

  // React to POI visibility prop changes (after mount). The user
  // toggling the POI button on the toolbar should reflect immediately
  // — no need to remount the map.
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.setAttribute('default-labels-disabled', poisVisible ? 'false' : 'true');
  }, [poisVisible]);

  useGamepad({
    enabled: gamepadEnabled && !!elRef.current,
    onFrame: ({ dt, elapsedMs, leftStick, rightStick, triggers, justPressed }) => {
      const el = elRef.current;
      const cam = camRef.current;
      const air = airRef.current;
      const vel = velRef.current;
      if (!el || !cam) return;

      elapsedMsRef.current = elapsedMs;

      // Idle: user walked away (no input >8s). Skip the entire per-
      // frame work — no camera writes, no hover wave math, no
      // altitude reports. Map3D stops re-rendering because nothing
      // is mutating its properties. Returns instantly to normal
      // flight on the next input (useIdleDetection flips isIdle
      // back to false before the next frame runs).
      if (isIdleRef.current) return;

      // Cinematic flight in progress — the destination-fly RAF loop
      // owns the camera writes this frame. Skip gamepad input so it
      // doesn't fight the animation. Resumes naturally on next frame
      // after flyAnimRef clears.
      if (flyAnimRef.current) return;

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

      // ── LT/RT → analog descent / ascent (dolly along view ray) ──
      // Triggers give pressure-modulated control instead of binary
      // hold. Light squeeze = gentle drift; full pull = aggressive
      // climb or descent. Real flight-control feel. LT = descend,
      // RT = ascend. LB/RB are intentionally unbound for now.
      //
      // In first-person, "descent" can't just shrink cam.range — that
      // moves the focal point closer to a stationary eye, which is
      // visually invisible (no perspective change). We translate the
      // eye position along the current view direction. Magnitude is
      // (LT - RT) so opposing trigger presses cancel naturally.
      const dollyInput = triggers.left - triggers.right;
      // Small dead-zone on the trigger so resting fingers don't drift.
      const DOLLY_DEAD = 0.04;
      const dollyEffective = Math.abs(dollyInput) < DOLLY_DEAD ? 0 : dollyInput;
      if (dollyEffective !== 0) {
        // Sign convention: LT positive → zoomSign -1 (descend / forward
        // along view ray). RT positive → zoomSign +1 (ascend / back).
        const moveMeters = -dollyEffective * cam.range * ZOOM_DOLLY_RATE_PER_SEC * climbMultRef.current * dt;
        const pitchRad = (cam.pitch * Math.PI) / 180;
        const headingRad = (cam.heading * Math.PI) / 180;
        const horizMove = moveMeters * Math.cos(pitchRad);
        const vertMove  = moveMeters * Math.sin(pitchRad);
        const dEast  = horizMove * Math.sin(headingRad);
        const dNorth = horizMove * Math.cos(headingRad);
        const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
        cam.lat += dNorth / METERS_PER_DEG_LAT;
        cam.lng += dEast  / (METERS_PER_DEG_LAT * cosLat);
        cam.altitude += vertMove;
      }

      // ── Physics integration — same as 2D airplane branch ──────────
      // No LB boost on pan since LB now means zoom. (The 2D path's
      // PAN_BOOST_MULT is preserved as a constant for future use but
      // not applied here.) The flight-speed multiplier from
      // useFlightTuning rolls into `boost` for pan / tilt. Yaw uses
      // its own `boostYaw` driven by the independent Turn Rate slider
      // so cinematic-slow rotation + snappy pan (or vice versa) is
      // possible without one slider doing both jobs.
      const boost = speedMultRef.current;
      const boostYaw = turnMultRef.current;
      const boostTilt = tiltMultRef.current;
      const dragExp = 60 * dt;

      const lx = shapeStick(leftStick.x);
      const ly = shapeStick(leftStick.y);
      const rx = shapeStick(rightStick.x);
      const ry = shapeStick(rightStick.y);

      // Airplane state: throttle/strafe/yaw with accel + drag + max.
      air.throttle += -ly * AIR_THROTTLE_ACCEL * boost * dt;
      air.strafe   +=  lx * AIR_STRAFE_ACCEL   * boost * dt;
      air.yaw      +=  rx * AIR_YAW_ACCEL      * boostYaw * dt;
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
      vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boostTilt * dt;
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
      // negative pitch = looking down, positive = looking up. No
      // app-side clamp — Map3D's own tilt ceiling will do whatever
      // it does. Tilt into the ground if you want to, let's learn
      // what happens.
      cam.pitch += vel.tilt * dt;

      // Apply hover wave as a brief modulation, not accumulating drift.
      const map3d = fpToMap3D({
        ...cam,
        heading: (cam.heading + hoverHeading + 360) % 360,
        pitch: cam.pitch + hoverTilt,
      });

      // ── Write to element ──────────────────────────────────────────
      el.center  = map3d.center;
      el.heading = map3d.heading;
      el.tilt    = map3d.tilt;
      el.range   = map3d.range;

      // ── Altitude reporting (throttled ~5×/sec) ─────────────────────
      // Pings the page's AltitudeGauge with the live eye altitude.
      // Throttled to avoid React state churn at 60Hz, and gated on
      // a meaningful change (>0.5m) so resting flight doesn't fire
      // an update every report window.
      const now = elapsedMs;
      if (now - lastAltitudeReportMsRef.current > 200) {
        const alt = cam.altitude;
        if (Math.abs(alt - lastReportedAltitudeRef.current) > 0.5) {
          lastReportedAltitudeRef.current = alt;
          onAltitudeChangeRef.current?.(alt);
        }
        lastAltitudeReportMsRef.current = now;
      }
    },
  });

  // Atmosphere center: prefer the explicit `center` prop (the user's
  // chosen hometown), fall back to MAP_CENTER. Sun position barely
  // shifts over typical Plot session travel (~12 mi yields 0.15°
  // azimuth delta), so we anchor to the framing center rather than
  // tracking the live camera position. Cheaper, identical-looking.
  const atmosCenter = center ?? MAP_CENTER;

  return (
    <AtmosphereProvider lat={atmosCenter.lat} lng={atmosCenter.lng}>
      <div
        ref={containerRef}
        className="h-full w-full relative"
        style={{ background: '#0a1020' }}
      >
        {/* SkyDome — the painted sky overhead. Mounts only when Greg's
            crafted assets exist (see docs/asset-roadmap.md > Sky
            Paintings). Until then, returns null and the demoted
            AtmosphereOverlay alone carries the surface. */}
        <SkyDome
          mapElRef={elRef}
          cameraRef={camRef as React.RefObject<{ lat: number; lng: number; altitude: number; heading: number } | null>}
          maps3dReady={!!maps3d}
        />
        <AtmosphereOverlay />
      </div>
    </AtmosphereProvider>
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
        flightSpeedMultiplier={props.flightSpeedMultiplier}
        climbRateMultiplier={props.climbRateMultiplier}
        turnRateMultiplier={props.turnRateMultiplier}
        tiltRateMultiplier={props.tiltRateMultiplier}
        flyToTarget={props.flyToTarget}
        onAltitudeChange={props.onAltitudeChange}
        isIdle={props.isIdle}
        poisVisible={props.poisVisible}
      />
    </APIProvider>
  );
}
