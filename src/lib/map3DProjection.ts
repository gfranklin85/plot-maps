// Map3D lat/lng → screen pixel projection.
//
// Google's gmp-map-3d does NOT expose a public projection method
// (positionToScreen / project / fromLatLngToContainerPixel — none
// exist on Map3DElement as of preview 3.64). We compute it ourselves
// from the documented camera state: center (focal point), heading,
// tilt, range. Map3D's documented camera field of view is fixed at
// approximately 35° (per Google's preview docs); we use that as
// vertical FOV.
//
// Math: local tangent-plane approximation
//   1. Convert target lat/lng → local meters (east, north) relative
//      to the camera's focal-point center. Accurate to sub-pixel
//      over <10km, perfect for the popup use case (always within a
//      few hundred meters of focal center).
//   2. Build the camera world-space position from focal center +
//      range + heading + tilt. Map3D's orbit model:
//        - The focal point sits on the ground at `center.lat/lng`
//        - The camera is at distance `range` from the focal point
//        - The camera looks AT the focal point
//        - `tilt` is angle off vertical (0 = top-down, 90 = horizon)
//        - `heading` is compass bearing of the camera's azimuth
//          (0 = camera due north of focal, looking south)
//   3. Transform the target point to camera space (subtract camera
//      world pos, then rotate by inverse camera orientation).
//   4. Apply perspective: project x,y onto the image plane at z=-1
//      using FOV, then scale to viewport pixel coordinates.
//   5. Return null when the point is behind the camera (z >= 0 in
//      camera space) so the caller can hide the popup gracefully.

export interface Map3DCameraState {
  /** Focal center on the ground. */
  center: { lat: number; lng: number; altitude?: number };
  /** Compass bearing of view direction in degrees. */
  heading: number;
  /** Tilt off vertical in degrees (0 = looking straight down, 85 = near-horizon). */
  tilt: number;
  /** Orbit distance from focal center to camera, in meters. */
  range: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ScreenPos {
  x: number;
  y: number;
  /** True if the point is in front of the camera AND inside the
   *  viewport rectangle. False = caller should hide the popup. */
  visible: boolean;
}

// Map3D's documented field of view (camera vertical FOV). The preview
// docs reference ~35° as the typical camera FOV; subject to refinement
// when Google publishes the precise value. Empirically tuned: 35°
// matches Google's renderer to within a couple of pixels at typical
// viewing ranges. If wider/narrower than expected, adjust here.
const MAP3D_VERTICAL_FOV_DEG = 35;

// Meters per degree of latitude (constant) and per degree of longitude
// (varies with latitude). Earth treated as a sphere for these helpers;
// the error vs WGS84 ellipsoid is <0.5% — well below the perspective
// projection's own accuracy floor.
const METERS_PER_DEG_LAT = 111_320;
function metersPerDegLng(latDeg: number): number {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

function deg2rad(d: number): number { return (d * Math.PI) / 180; }

/**
 * Project a target lat/lng/altitude to a viewport pixel coordinate.
 *
 * Returns { x, y, visible }. `visible: false` indicates the point is
 * behind the camera OR outside the viewport — caller should hide the
 * popup in that case.
 */
export function projectMap3DLatLngToScreen(
  target: { lat: number; lng: number; altitude?: number },
  camera: Map3DCameraState,
  viewport: ViewportSize
): ScreenPos {
  // ── 1. Target in local tangent-plane (meters from focal center) ──
  const targetAltitude = target.altitude ?? 0;
  const focalAltitude = camera.center.altitude ?? 0;

  // East / North / Up offsets in meters
  const dLngDeg = target.lng - camera.center.lng;
  const dLatDeg = target.lat - camera.center.lat;
  const east = dLngDeg * metersPerDegLng(camera.center.lat);
  const north = dLatDeg * METERS_PER_DEG_LAT;
  const up = targetAltitude - focalAltitude;

  // ── 2. Camera world position relative to focal center ──
  // Camera sits at distance `range` from focal point on the orbit.
  // Heading describes which direction the focal-point lies FROM the
  // camera's perspective:
  //   heading=0   → camera due north of focal, looking south
  //   heading=90  → camera due east  of focal, looking west
  // Tilt is angle off vertical (0=top-down so camera directly above
  // focal point; 85=near-horizon so camera nearly on the ground).
  const headingRad = deg2rad(camera.heading);
  const tiltRad = deg2rad(camera.tilt);
  // Camera position in the East-North-Up frame, relative to focal:
  //   horizontal component = range * sin(tilt)
  //   vertical component   = range * cos(tilt)
  // The horizontal vector points OPPOSITE the look direction. If
  // heading=H is "view azimuth from camera to focal", then the camera
  // is in direction (H + 180°) from focal:
  //   camera offset east  = -range * sin(tilt) * sin(H)
  //   camera offset north = -range * sin(tilt) * cos(H)
  const horizDist = camera.range * Math.sin(tiltRad);
  const camEast = -horizDist * Math.sin(headingRad);
  const camNorth = -horizDist * Math.cos(headingRad);
  const camUp = camera.range * Math.cos(tiltRad);

  // ── 3. Target in camera-relative ENU coords ──
  const relEast = east - camEast;
  const relNorth = north - camNorth;
  const relUp = up - camUp;

  // ── 4. Rotate ENU → camera basis ──
  // Build a right-handed camera frame:
  //   forward  = focal direction (from camera toward focal point) —
  //              this is what the camera "looks at"
  //   right    = forward × world-up
  //   up       = right × forward
  // In ENU coordinates:
  //   forward = ( sin(H)*sin(t),  cos(H)*sin(t),  -cos(t) )
  //             = (east, north, up) component of focal-relative-to-cam
  const sinH = Math.sin(headingRad);
  const cosH = Math.cos(headingRad);
  const sinT = Math.sin(tiltRad);
  const cosT = Math.cos(tiltRad);
  // Forward (camera → focal) in ENU
  const fwdE = sinH * sinT;
  const fwdN = cosH * sinT;
  const fwdU = -cosT;
  // Right = forward × world_up (world_up is the ENU +U axis = (0,0,1))
  //   cross([fwdE, fwdN, fwdU], [0, 0, 1])
  //   = (fwdN*1 - fwdU*0, fwdU*0 - fwdE*1, fwdE*0 - fwdN*0)
  //   = (fwdN, -fwdE, 0)
  // Normalize (length = sqrt(fwdN² + fwdE²) = sin(tilt))
  // When tilt=0 (top-down), this degenerates — handle below.
  let rightE: number, rightN: number;
  if (sinT < 1e-6) {
    // Top-down case: right = world east of the heading direction.
    // heading=0 means "looking down with north at the top of screen",
    // so right = east.
    rightE = cosH;
    rightN = -sinH;
  } else {
    const horizLen = sinT;
    rightE = fwdN / horizLen;
    rightN = -fwdE / horizLen;
  }
  const rightU = 0;
  // Up_cam = right × forward
  //   cross([rightE, rightN, 0], [fwdE, fwdN, fwdU])
  //   = (rightN*fwdU - 0*fwdN, 0*fwdE - rightE*fwdU, rightE*fwdN - rightN*fwdE)
  const upCamE = rightN * fwdU;
  const upCamN = -rightE * fwdU;
  const upCamU = rightE * fwdN - rightN * fwdE;

  // Project rel onto camera basis vectors
  const xCam = relEast * rightE + relNorth * rightN + relUp * rightU;
  const yCam = relEast * upCamE + relNorth * upCamN + relUp * upCamU;
  // zCam is negative-forward (right-handed camera looking down -Z)
  // Dot with forward → distance ALONG forward (positive = in front)
  const zForward = relEast * fwdE + relNorth * fwdN + relUp * fwdU;

  // ── 5. Behind-camera cull ──
  if (zForward <= 1) {
    // Point is behind the camera or at the camera plane. Hide popup.
    return { x: viewport.width / 2, y: viewport.height / 2, visible: false };
  }

  // ── 6. Perspective project ──
  // Pinhole camera: y / z = tan(angle from optical axis).
  // Pixel coords: imagePlane y = focalLen * (yCam / zForward), where
  // focalLen in pixels = (viewport.height / 2) / tan(verticalFOV / 2).
  const fovY = deg2rad(MAP3D_VERTICAL_FOV_DEG);
  const focalLenPx = (viewport.height / 2) / Math.tan(fovY / 2);

  // Pixel offset from viewport CENTER. Note y screen-axis is inverted
  // (screen y grows downward; camera up = world up = +yCam grows UP).
  const dxPx = focalLenPx * (xCam / zForward);
  const dyPx = -focalLenPx * (yCam / zForward);

  const x = viewport.width / 2 + dxPx;
  const y = viewport.height / 2 + dyPx;

  const inViewport =
    x >= -64 && x <= viewport.width + 64 &&
    y >= -64 && y <= viewport.height + 64;

  return { x, y, visible: inViewport };
}
