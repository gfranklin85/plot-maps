"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { MAP_CENTER } from "@/lib/constants";
import { useGamepad } from "@/lib/useGamepad";
import type { ButtonName } from "@/lib/gamepadActions";
import type { MapViewProps } from "./MapView";
import type { GamepadActions } from "./GamepadFlightController";
import { AtmosphereProvider } from "@/lib/atmosphere/AtmosphereContext";
import AtmosphereOverlay from "./AtmosphereOverlay";
import SkyDome from "./SkyDome";
import Parcel3DOverlay from "./Parcel3DOverlay";
import type { ParcelColorMode, ParcelHitTester } from "./ParcelOverlay";
import FireBeam, { type FireBeamShot } from "./FireBeam";

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
// Base physics constants live in flightBaseConstants.ts as the
// single source of truth so the FlightTuningPanel's live readouts
// can never drift from what the engine actually applies. Pull them
// in with the legacy names so the rest of this file reads the same.
import { FLIGHT_BASE } from "@/lib/flightBaseConstants";

const AIR_THROTTLE_ACCEL = FLIGHT_BASE.THROTTLE_ACCEL;
const AIR_THROTTLE_DRAG  = FLIGHT_BASE.THROTTLE_DRAG;
const AIR_THROTTLE_MAX   = FLIGHT_BASE.THROTTLE_MAX;
const AIR_STRAFE_ACCEL = FLIGHT_BASE.STRAFE_ACCEL;
const AIR_STRAFE_DRAG  = FLIGHT_BASE.STRAFE_DRAG;
const AIR_STRAFE_MAX   = FLIGHT_BASE.STRAFE_MAX;
const AIR_YAW_ACCEL = FLIGHT_BASE.YAW_ACCEL;
const AIR_YAW_DRAG  = FLIGHT_BASE.YAW_DRAG;
const AIR_YAW_MAX   = FLIGHT_BASE.YAW_MAX;
const TILT_ACCEL_DEG_S2 = FLIGHT_BASE.TILT_ACCEL;
const TILT_DRAG         = FLIGHT_BASE.TILT_DRAG;
const TILT_MAX_DEG_S    = FLIGHT_BASE.TILT_MAX;
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
interface VelState { panX: number; panY: number; heading: number; tilt: number; climb: number; }

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

  // ── Decouple eye altitude from look-pitch ─────────────────────────
  // Map3D positions the camera at: eyeAlt = focalAlt + range * cos(tilt)
  // where tilt is from-nadir (0 = straight down, 90 = horizontal).
  //
  // Previously we placed the focal point ALONG the view ray from the
  // eye, which meant changing pitch moved the focal up/down → Map3D
  // moved the eye too. Result: pushing the look-up stick made the
  // camera actually rise.
  //
  // Fix: invert the formula. Given the eye altitude we want
  // (cam.altitude) and the tilt we want (map3dTilt), compute the
  // focal altitude that produces that eye height. Look-pitch then
  // rotates the view without affecting eye position. Climb (RY)
  // becomes the only thing that changes altitude.
  const tiltRad = (map3dTilt * Math.PI) / 180;
  const cosTilt = Math.cos(tiltRad);  // 0 at horizon, 1 at nadir
  const sinTilt = Math.sin(tiltRad);  // 1 at horizon, 0 at nadir

  // Use a stable focal-projection distance: horizontal component of
  // the user-chosen range. This keeps the focal point ahead of the
  // camera in the direction of view, scaled by how tilted it is.
  let useRange = cam.range;
  // We want focalAlt >= 0 (ground). focalAlt = cam.altitude - range * cosTilt.
  // If that goes negative (when looking down with a long range), shorten
  // range until focal sits exactly on the ground.
  if (cosTilt > 0.0001 && cam.altitude > 0) {
    const maxRangeBeforeGround = cam.altitude / cosTilt;
    if (maxRangeBeforeGround < useRange) useRange = maxRangeBeforeGround;
  }
  if (useRange < 1) useRange = 1;

  const focalAlt = Math.max(0, cam.altitude - useRange * cosTilt);

  // Horizontal offset of focal from eye (in heading direction).
  const horizDist = useRange * sinTilt;
  const headingRad = (cam.heading * Math.PI) / 180;
  const dEast = horizDist * Math.sin(headingRad);
  const dNorth = horizDist * Math.cos(headingRad);
  const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;

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
  showParcelOverlay = false,
  parcelColorMode = 'land_use',
  onParcelClick,
  onParcelHoverChange,
  parcelHitTesterRef,
  onGooglePoiClick,
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
  /** Parcel overlay: same prop contract as the 2D path. Page.tsx
   *  passes these unchanged via MapDynamic; the 3D path now actually
   *  consumes them. Reticle hover + A-press dispatch happens IN this
   *  component (the gamepad loop calls the hit-tester); the page
   *  side just renders Property­Popup on the click callback. */
  showParcelOverlay?: boolean;
  parcelColorMode?: ParcelColorMode;
  onParcelClick?: (apn: string, latLng: { lat: number; lng: number }) => void;
  onParcelHoverChange?: (apn: string | null, latLng: { lat: number; lng: number } | null) => void;
  parcelHitTesterRef?: React.MutableRefObject<ParcelHitTester | null>;
  /** Google POI selection (Breakthrough 1 — 2026-05-26). Fires when a
   *  mouse click OR a synthesized A-press click lands on one of
   *  Google's native POI labels (address numbers, business icons).
   *  Page wires this to open PropertyPopup with id `gpoi:<placeId>`. */
  onGooglePoiClick?: (placeId: string, latLng: { lat: number; lng: number }) => void;
}) {
  const maps3d = useMapsLibrary('maps3d');
  const elRef = useRef<Map3DElement | null>(null);
  const camRef = useRef<FpCam | null>(null);
  const airRef = useRef<AirState>({ throttle: 0, strafe: 0, yaw: 0 });
  const velRef = useRef<VelState>({ panX: 0, panY: 0, heading: 0, tilt: 0, climb: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const elapsedMsRef = useRef<number>(0);

  // ── Parcel reticle wiring ──────────────────────────────────────────
  // Parcel3DOverlay writes a hit-tester into the parent's ref (or our
  // local fallback ref if the parent didn't provide one); the gamepad
  // loop calls it each frame at the on-screen reticle pixel to discover
  // which parcel (if any) is under the crosshair. We forward to:
  //   - onParcelHoverChange (page renders reticle hover state)
  //   - onParcelClick (on A-press; page opens PropertyPopup)
  const fallbackParcelHitTesterRef = useRef<ParcelHitTester | null>(null);
  const effectiveHitTesterRef: React.MutableRefObject<ParcelHitTester | null> =
    parcelHitTesterRef ?? fallbackParcelHitTesterRef;
  // Lat/lng finder — written by Parcel3DOverlay; currently unused now
  // that gmp-click + reticle both resolve via /api/parcels/at-point,
  // but kept on the prop contract so the overlay can still expose it
  // for future client-side fast-paths if needed.
  const latLngParcelFinderRef = useRef<((lat: number, lng: number) => { apn: string; lat: number; lng: number } | null) | null>(null);
  // Latest onParcelClick — read by both the gmp-click listener and
  // the gamepad RAF loop without re-binding on every render.
  const onParcelClickRef = useRef(onParcelClick);
  onParcelClickRef.current = onParcelClick;
  // Same pattern for Google POI clicks.
  const onGooglePoiClickRef = useRef(onGooglePoiClick);
  onGooglePoiClickRef.current = onGooglePoiClick;
  // Hover-change is no longer driven by 3D — reticle hover state was
  // removed when selection moved server-side. Prop still accepted so
  // the 2D path's contract is preserved unchanged.
  void onParcelHoverChange;
  // Cancel-token for /api/parcels/at-point lookups so a fast second
  // click supersedes a still-in-flight first click.
  const lastParcelLookupAcRef = useRef<AbortController | null>(null);
  // Timestamp (performance.now ms) of the last gmp-click that resolved
  // to a Google POI. The gamepad A-press dispatches a synthetic click
  // first; if Google's hit-test produces a POI within ~150ms after
  // the dispatch, this ref gets stamped and the follow-up parcel
  // ray-cast suppresses itself to avoid double-firing.
  const lastPoiClickAtRef = useRef<number>(0);

  // ── FireBeam shots state (Breakthrough 2 proof) ────────────────────
  // Each A-press appends a shot. Sweep shots self-prune via
  // onShotComplete; tether shots persist until manually cleared.
  // Render position is reticle (start) → approximated ground-target
  // pixel (end). The end-Y approximation is a function of camera pitch
  // — see fireBeam() below.
  const [fireBeamShots, setFireBeamShots] = useState<FireBeamShot[]>([]);
  const shotIdRef = useRef<number>(0);
  const handleShotComplete = useCallback((id: number) => {
    setFireBeamShots((prev) => prev.filter((s) => s.id !== id));
  }, []);
  const fireBeam = useCallback((mode: 'sweep' | 'tether') => {
    const el = elRef.current;
    const cam = camRef.current;
    if (!el || !cam) return;
    const rect = el.getBoundingClientRect();
    // Reticle is centered on the 3D path today.
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    // Approximate the on-screen Y of the ground target.
    //   pitch ~ -90 (looking straight down) → target IS the reticle pixel
    //   pitch ~  -5 (near horizon)          → target is way below reticle
    // factor = 1 - |pitch|/90; endY = reticleY + factor * (40% of viewport height).
    const pitchAbs = Math.min(90, Math.abs(cam.pitch));
    const factor = 1 - pitchAbs / 90;
    const endX = startX;
    const endY = startY + factor * rect.height * 0.42;
    shotIdRef.current += 1;
    setFireBeamShots((prev) => [
      ...prev,
      { id: shotIdRef.current, startX, startY, endX, endY, mode },
    ]);
  }, []);
  // Stable ref for the gamepad RAF loop to fire without re-binding.
  const fireBeamRef = useRef(fireBeam);
  fireBeamRef.current = fireBeam;


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
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, climb: 0 };

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
    // Map3D fires gmp-click on the map element itself with two payload
    // types: PlaceClickEvent (user clicked a labeled POI / business
    // icon — has placeId) and LocationClickEvent (user clicked ground
    // / unlabeled building — has position only). Selection order:
    //   1. POI click (placeId) → route to Plot's PropertyPopup via
    //      onGooglePoiClick. The popup opens against a `gpoi:<placeId>`
    //      stub id which resolves through /api/google-poi. POI wins
    //      because it's the broader coverage — every labeled house
    //      and business worldwide becomes selectable, not just
    //      county-limited parcel polygons.
    //   2. Ground click (position) → resolve to a parcel via
    //      /api/parcels/at-point (server-side PostGIS point-in-polygon).
    function onMapClick(rawEv: Event) {
      const ev = rawEv as CustomEvent<{
        placeId?: string;
        position?: { lat: number; lng: number; altitude?: number };
      }> & {
        placeId?: string;
        position?: { lat: number; lng: number; altitude?: number };
        stop?: () => void;
        stopPropagation?: () => void;
      };
      // PlaceClickEvent carries placeId either on the event itself
      // (older API shape) or on event.detail (newer).
      const placeId = ev.placeId ?? ev.detail?.placeId;
      if (placeId) {
        // Suppress Google's default popover so Plot's PropertyPopup
        // is what the user sees. Both stop() and stopPropagation
        // exist on different Map3D versions; calling whichever is
        // available is harmless on the other.
        try { ev.stop?.(); } catch { /* ignore */ }
        try { ev.stopPropagation?.(); } catch { /* ignore */ }
        // POI click events also carry a position (Map3D includes
        // both fields on PlaceClickEvent). Fall back to (0,0) if
        // missing — the popup looks the place up by id, not coords.
        const poiPos = ev.position ?? ev.detail?.position;
        const lat = poiPos?.lat ?? 0;
        const lng = poiPos?.lng ?? 0;
        // Stamp the timestamp BEFORE firing the callback so a
        // gamepad A-press synthetic-click race can suppress its
        // follow-up parcel ray-cast. See A-press handler.
        lastPoiClickAtRef.current = performance.now();
        onGooglePoiClickRef.current?.(placeId, { lat, lng });
        return;
      }
      // LocationClickEvent — extract the click lat/lng.
      const pos = ev.position ?? ev.detail?.position;
      if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lng)) return;
      const lat = pos.lat;
      const lng = pos.lng;
      // Server-side resolve. AbortController so rapid clicks cancel
      // stale lookups (the last click wins, not the slowest network).
      const ac = new AbortController();
      lastParcelLookupAcRef.current?.abort();
      lastParcelLookupAcRef.current = ac;
      fetch(`/api/parcels/at-point?lat=${lat}&lng=${lng}`, { signal: ac.signal })
        .then((r) => r.ok ? r.json() : null)
        .then((json) => {
          if (!json || !json.apn) return;
          onParcelClickRef.current?.(json.apn as string, { lat, lng });
        })
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') {
            // eslint-disable-next-line no-console
            console.warn('[MapView3D] parcel-at-point lookup failed', err);
          }
        });
    }
    el.addEventListener('gmp-click', onMapClick);
    // Seed at 91m (300 ft) altitude looking forward to the horizon
    // (pitch 0). 300 ft is the top of the prospecting zone — high
    // enough to see the neighborhood, low enough to start working
    // immediately. Horizon framing puts the user in "flying" mind-
    // set on frame one instead of "satellite view." Greg locked
    // this spawn 2026-05-21.
    camRef.current = {
      lat: seed.lat, lng: seed.lng, altitude: 91,
      heading: 0, pitch: 0, range: 700,
    };
    airRef.current = { throttle: 0, strafe: 0, yaw: 0 };
    velRef.current = { panX: 0, panY: 0, heading: 0, tilt: 0, climb: 0 };
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
      el.removeEventListener('gmp-click', onMapClick);
      lastParcelLookupAcRef.current?.abort();
      lastParcelLookupAcRef.current = null;
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
        // A-press: selection priority is
        //   (1) Google POI under the reticle  → onGooglePoiClick
        //   (2) Plot parcel under the reticle → onParcelClick
        //   (3) nothing → onShoot fallback
        //
        // Map3D doesn't expose a public ray-cast-against-POIs API, but
        // it DOES dispatch gmp-click events with placeId when a pointer
        // event lands on a POI. We synthesize a click at the reticle
        // pixel; if Google's internal hit-test produces a POI click,
        // our gmp-click listener stamps lastPoiClickAtRef and the
        // follow-up parcel ray-cast suppresses itself to avoid double-
        // firing on the same press.
        if (justPressed.has('a')) {
          const pressedAt = performance.now();
          // Breakthrough 2 proof: fire the visible beam immediately so
          // the user gets feedback regardless of what the lookup
          // resolves to. Sweep mode for now; tap-vs-hold (sweep vs
          // tether) lands after the proof is signed off.
          fireBeamRef.current('sweep');
          const mapEl = elRef.current;
          if (mapEl) {
            // Dispatch synthetic click at the screen center (where the
            // reticle lives in the 3D path today). When the reticle
            // becomes draggable here, replace with the real pixel.
            const rect = mapEl.getBoundingClientRect();
            const clientX = rect.left + rect.width / 2;
            const clientY = rect.top + rect.height / 2;
            try {
              mapEl.dispatchEvent(new PointerEvent('pointerdown', {
                clientX, clientY, bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
              }));
              mapEl.dispatchEvent(new PointerEvent('pointerup', {
                clientX, clientY, bubbles: true, cancelable: true, button: 0, pointerType: 'mouse',
              }));
              mapEl.dispatchEvent(new MouseEvent('click', {
                clientX, clientY, bubbles: true, cancelable: true, button: 0,
              }));
            } catch {
              // PointerEvent not constructable in older runtimes; the
              // parcel branch still runs in that case.
            }
          }

          // Defer the parcel ray-cast one frame so the gmp-click event
          // (if any) has had a chance to fire and stamp the POI ref.
          const cam = camRef.current;
          requestAnimationFrame(() => {
            // Did the synthetic click resolve to a POI? If yes, done —
            // the popup is opening, don't also fire a parcel click.
            if (lastPoiClickAtRef.current >= pressedAt) return;

            // No POI hit. Run the existing parcel ray-cast.
            if (!cam) {
              actionsRef.current?.onShoot?.();
              return;
            }
            if (cam.pitch >= -0.5) {
              // Aimed at or above the horizon — no ground intersect.
              actionsRef.current?.onShoot?.();
              return;
            }
            const pitchRad = (Math.abs(cam.pitch) * Math.PI) / 180;
            const groundDistM = cam.altitude / Math.tan(pitchRad);
            if (!Number.isFinite(groundDistM) || groundDistM <= 0 || groundDistM >= 50_000) {
              actionsRef.current?.onShoot?.();
              return;
            }
            const headingRad = (cam.heading * Math.PI) / 180;
            const dNorthM = groundDistM * Math.cos(headingRad);
            const dEastM = groundDistM * Math.sin(headingRad);
            const cosLat = Math.cos((cam.lat * Math.PI) / 180) || 1;
            const targetLat = cam.lat + dNorthM / 111_320;
            const targetLng = cam.lng + dEastM / (111_320 * cosLat);
            const ac = new AbortController();
            lastParcelLookupAcRef.current?.abort();
            lastParcelLookupAcRef.current = ac;
            fetch(`/api/parcels/at-point?lat=${targetLat}&lng=${targetLng}`, { signal: ac.signal })
              .then((r) => r.ok ? r.json() : null)
              .then((json) => {
                // Re-check the POI flag — gmp-click can fire later
                // than one RAF on some browsers/Map3D versions.
                if (lastPoiClickAtRef.current >= pressedAt) return;
                if (json && json.apn) {
                  onParcelClickRef.current?.(json.apn as string, { lat: targetLat, lng: targetLng });
                } else {
                  actionsRef.current?.onShoot?.();
                }
              })
              .catch((err) => {
                if ((err as Error).name !== 'AbortError') {
                  actionsRef.current?.onShoot?.();
                }
              });
          });
        }
        fire('x', actionsRef.current?.onRotateChannel);
        fire('y', actionsRef.current?.onInspect);
        fire('b', actionsRef.current?.onCancel);
        if (justPressed.has('up') || justPressed.has('left')) actionsRef.current?.onCyclePrev?.();
        if (justPressed.has('down') || justPressed.has('right')) actionsRef.current?.onCycleNext?.();
      }

      // ── Control mapping (Greg locked 2026-05-21) ─────────────────
      //   LEFT-X   → strafe sideways
      //   LEFT-Y   → look up/down (pitch)
      //   RIGHT-X  → yaw (turn)
      //   RIGHT-Y  → vertical climb / descend in m/s
      //   RT       → accelerate forward (analog gas)
      //   LT       → brake; once stopped, reverse
      // Sticks = direction. Triggers = pace. Aircraft model.

      const boost = speedMultRef.current;
      const boostYaw = turnMultRef.current;
      const boostTilt = tiltMultRef.current;
      const boostClimb = climbMultRef.current;
      const dragExp = 60 * dt;

      const lx = shapeStick(leftStick.x);
      const ly = shapeStick(leftStick.y);
      const rx = shapeStick(rightStick.x);
      const ry = shapeStick(rightStick.y);
      // ── Control mapping (Greg locked 2026-05-21, restored drone feel) ──
      //   LEFT-X   → strafe sideways
      //   LEFT-Y   → fly forward / reverse (throttle, drone feel)
      //   RIGHT-X  → yaw
      //   RIGHT-Y  → look up/down (pitch)
      //   LT       → descend (direct vertical velocity m/s)
      //   RT       → ascend (direct vertical velocity m/s)

      // Throttle (LY) — same forward/reverse drone feel we had originally.
      air.throttle += -ly * AIR_THROTTLE_ACCEL * boost * dt;
      // Strafe (LX).
      air.strafe   +=  lx * AIR_STRAFE_ACCEL   * boost * dt;
      // Yaw (RX).
      air.yaw      +=  rx * AIR_YAW_ACCEL      * boostYaw * dt;

      air.throttle *= Math.pow(AIR_THROTTLE_DRAG, dragExp);
      air.strafe   *= Math.pow(AIR_STRAFE_DRAG,   dragExp);
      air.yaw      *= Math.pow(AIR_YAW_DRAG,      dragExp);

      const throttleMaxScaled = AIR_THROTTLE_MAX * boost;
      const strafeMaxScaled   = AIR_STRAFE_MAX   * boost;
      const yawMaxScaled      = AIR_YAW_MAX      * boostYaw;
      air.throttle = clamp(air.throttle, -throttleMaxScaled * 0.4, throttleMaxScaled);
      air.strafe   = clamp(air.strafe,   -strafeMaxScaled, strafeMaxScaled);
      air.yaw      = clamp(air.yaw,      -yawMaxScaled, yawMaxScaled);
      if (Math.abs(air.throttle) < 0.5)  air.throttle = 0;
      if (Math.abs(air.strafe)   < 0.5)  air.strafe   = 0;
      if (Math.abs(air.yaw)      < 0.05) air.yaw      = 0;

      // ── Look pitch (RIGHT-Y) ─────────────────────────────────────
      // Stick up (ry < 0) raises view; stick down (ry > 0) lowers it.
      vel.tilt -= ry * TILT_ACCEL_DEG_S2 * boostTilt * dt;
      vel.tilt *= Math.pow(TILT_DRAG, dragExp);
      const tiltMaxScaled = TILT_MAX_DEG_S * boostTilt;
      vel.tilt = clamp(vel.tilt, -tiltMaxScaled, tiltMaxScaled);
      if (Math.abs(vel.tilt) < 0.05) vel.tilt = 0;

      // ── Vertical climb (LT descend / RT ascend) ──────────────────
      // Triggers give analog pressure on a direct vertical velocity
      // in m/s. RT held = ascend; LT held = descend. Both held cancels
      // (input = rt - lt). ClimbRate slider scales accel + max.
      const TRIGGER_DEAD = 0.04;
      const rt = triggers.right < TRIGGER_DEAD ? 0 : triggers.right;
      const lt = triggers.left  < TRIGGER_DEAD ? 0 : triggers.left;
      const climbInput = rt - lt;
      vel.climb += climbInput * FLIGHT_BASE.CLIMB_ACCEL * boostClimb * dt;
      vel.climb *= Math.pow(FLIGHT_BASE.CLIMB_DRAG, dragExp);
      const climbMaxScaled = FLIGHT_BASE.CLIMB_MAX * boostClimb;
      vel.climb = clamp(vel.climb, -climbMaxScaled, climbMaxScaled);
      if (Math.abs(vel.climb) < 0.02) vel.climb = 0;
      cam.altitude = Math.max(1, cam.altitude + vel.climb * dt);

      // Pitch stays where the user sets it (no spring, no clamp on
      // the internal value — only the Map3D write is bounded inside
      // fpToMap3D). Sticks and triggers are independent verbs.

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
        {/* Parcel overlay on the 3D path. Mounts <gmp-polygon-3d>
            children of the Map3D element, exposes a hit-tester via
            localParcelHitTesterRef which the gamepad loop calls each
            frame at the reticle position. */}
        <Parcel3DOverlay
          mapElRef={elRef as React.MutableRefObject<HTMLElement & {
            center: { lat: number; lng: number; altitude?: number };
            heading: number;
            tilt: number;
            range: number;
            screenToLatLng?: (x: number, y: number) => { lat: number; lng: number } | null;
          } | null>}
          cameraRef={camRef as React.MutableRefObject<{
            lat: number;
            lng: number;
            altitude: number;
            heading: number;
            pitch: number;
          } | null>}
          visible={showParcelOverlay}
          colorMode={parcelColorMode}
          hitTesterRef={effectiveHitTesterRef}
          latLngFinderRef={latLngParcelFinderRef}
        />
        <AtmosphereOverlay />
        {/* Fire-beam selection animation (Breakthrough 2 proof). Each
            A-press appends a shot here; sweep shots auto-prune via
            handleShotComplete. SVG is full-viewport, pointer-events
            none, so it never blocks the map. */}
        <FireBeam shots={fireBeamShots} onShotComplete={handleShotComplete} />
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
        showParcelOverlay={props.showParcelOverlay}
        parcelColorMode={props.parcelColorMode}
        onParcelClick={props.onParcelClick}
        onParcelHoverChange={props.onParcelHoverChange}
        parcelHitTesterRef={props.parcelHitTesterRef}
        onGooglePoiClick={props.onGooglePoiClick}
      />
    </APIProvider>
  );
}
