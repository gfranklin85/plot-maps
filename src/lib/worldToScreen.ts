// worldToScreen — project a world (lat/lng/altitude) point to a screen
// pixel using the camera's first-person state. Pure math, no Google
// involvement. Plot owns the projection.
//
// Locked 2026-06-06. Greg: "if we know the lat and long, why do you
// want to give our popup to Google to show it? Put the shit on our
// own screen for crying out loud!"
//
// Returns:
//   { x, y, behind } — screen pixel + a flag saying the point is
//                      behind the camera (dot product negative).
//                      Caller can choose to clamp, hide, or arrow.
//   null              — math broke (invalid inputs). Caller MUST
//                       handle this; never silently fall back.
//
// Math approach (right-handed, camera-relative):
//   1. Convert (eye lat/lng) and (target lat/lng) into local meters
//      using small-angle approximation around the eye latitude.
//      Plot's camera radius is bounded enough that flat-Earth is
//      <0.1% off — totally fine for screen projection at our zooms.
//   2. Build a camera basis: forward vector from heading + pitch,
//      right = forward × up, up = right × forward.
//   3. Express the target's local position in camera basis.
//   4. If camera-relative Z (depth along forward) is <=0, the point
//      is behind the camera. Flag and still project (caller decides).
//   5. Perspective divide: x = (X / Z) * fx, y = (Y / Z) * fy,
//      where fx/fy come from the camera's horizontal/vertical FOV.
//   6. Convert to pixel coords (origin = top-left).

interface Eye {
  lat: number;
  lng: number;
  altitude: number;   // meters above ground
  heading: number;    // 0=N, 90=E, in degrees
  pitch: number;      // 0=horizon, +60=looking down 60°, in degrees
}

interface Target {
  lat: number;
  lng: number;
  altitude?: number;  // meters above ground; default 0 (ground)
}

interface Viewport {
  width: number;       // canvas width px
  height: number;      // canvas height px
  hFovDeg?: number;    // horizontal field of view. Google Map3D's
                       // default is ~60deg. Override if calibration
                       // proves otherwise.
}

export interface ScreenPos {
  x: number;        // pixels from left
  y: number;        // pixels from top
  behind: boolean;  // true if the target is behind the camera plane
  depthM: number;   // meters from eye along forward direction
}

const DEG = Math.PI / 180;
const EARTH_M_PER_LAT_DEG = 111_320;  // ~constant

export function worldToScreen(
  eye: Eye,
  target: Target,
  view: Viewport,
): ScreenPos | null {
  if (!Number.isFinite(eye.lat) || !Number.isFinite(eye.lng)) return null;
  if (!Number.isFinite(target.lat) || !Number.isFinite(target.lng)) return null;
  if (view.width <= 0 || view.height <= 0) return null;

  // ── 1. Local meters from eye → target ──
  // Flat-Earth approximation around eye latitude. East = +x, North = +y.
  const dLat = target.lat - eye.lat;
  const dLng = target.lng - eye.lng;
  const mPerLngDeg = EARTH_M_PER_LAT_DEG * Math.cos(eye.lat * DEG);
  const east  = dLng * mPerLngDeg;
  const north = dLat * EARTH_M_PER_LAT_DEG;
  // Vertical = ground altitude diff. We don't have target ground elev;
  // assume target is at the ground (altitude 0). Eye altitude is above
  // ground, so the vertical diff from eye to target is -eye.altitude
  // + target.altitude.
  const up = (target.altitude ?? 0) - eye.altitude;

  // ── 2. Camera basis ──
  // Forward direction in world (East-North-Up frame):
  //   heading is bearing of look direction (0=N, 90=E)
  //   pitch is downward angle from horizon
  const hRad = eye.heading * DEG;
  const pRad = eye.pitch * DEG;
  const cosP = Math.cos(pRad), sinP = Math.sin(pRad);
  const sinH = Math.sin(hRad), cosH = Math.cos(hRad);

  // forward: east = sin(h)*cosP, north = cos(h)*cosP, up = -sinP
  const fE = sinH * cosP;
  const fN = cosH * cosP;
  const fU = -sinP;
  // right (camera +x): horizontal, perpendicular to heading.
  // east = cos(h), north = -sin(h), up = 0
  const rE = cosH;
  const rN = -sinH;
  const rU = 0;
  // up (camera +y, head-up): forward × right (right-handed) →
  // gives the "up" in camera space. Equals (-fU*rN, fU*rE - fE*rU, fE*rN - fN*rE)
  // simplified with rU=0:
  // upE = -fU * rN
  // upN =  fU * rE
  // upU =  fE * rN - fN * rE
  const uE = -fU * rN;
  const uN =  fU * rE;
  const uU =  fE * rN - fN * rE;

  // ── 3. Target position in camera basis ──
  // X (camera right), Y (camera up), Z (camera forward).
  const X = east * rE + north * rN + up * rU;
  const Y = east * uE + north * uN + up * uU;
  const Z = east * fE + north * fN + up * fU;

  const behind = Z <= 0.01;  // ~10mm in front avoids divide-by-near-zero.

  // ── 4. Perspective divide ──
  // Field of view. Google Map3DElement's default horizontal FOV is
  // approximately 60deg. Vertical FOV derived from aspect ratio.
  const hFov = (view.hFovDeg ?? 60) * DEG;
  const aspect = view.width / view.height;
  const vFov = 2 * Math.atan(Math.tan(hFov / 2) / aspect);
  // Focal lengths in pixel units.
  const fx = (view.width  / 2) / Math.tan(hFov / 2);
  const fy = (view.height / 2) / Math.tan(vFov / 2);

  // Guard divide. If behind, we still compute using |Z| so the caller
  // can choose where the off-screen target falls (we just flip sign
  // so the math points the right way for the arrow indicator).
  const denom = behind ? Math.max(0.01, Math.abs(Z)) : Z;
  const ndcX = (X / denom) * fx;  // pixels offset from screen center
  const ndcY = (Y / denom) * fy;

  // ── 5. Screen coords (origin = top-left) ──
  // Y axis flips: camera +Y is UP in world, screen +Y is DOWN.
  const x = view.width  / 2 + ndcX;
  const y = view.height / 2 - ndcY;

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y, behind, depthM: Z };
}
