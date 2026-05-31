// farSideOffset.ts — compute a lat/lng that's on the FAR SIDE of a
// property from the camera. The "far side" is the position behind the
// property from the camera's POV, so when we mount UI at this coordinate
// the photoreal building is between the camera and the UI.
//
// Snapshotted at fire time, not subscribed to camera changes.
// Per [[feedback-snapshot-state-at-fire-not-continuously]].

interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_378_137; // WGS84 equatorial radius

/** Compute a lat/lng point a given number of meters beyond `property`
 *  in the direction AWAY from `camera`. The bearing camera→property is
 *  computed and extended past the property by `offsetM` meters. */
export function farSideOf(
  property: LatLng,
  camera: LatLng,
  offsetM: number,
): LatLng {
  // Bearing from camera to property (radians, north = 0, clockwise positive)
  const lat1 = (camera.lat * Math.PI) / 180;
  const lat2 = (property.lat * Math.PI) / 180;
  const dLng = ((property.lng - camera.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = Math.atan2(y, x);

  // Project a point `offsetM` meters from `property` along `bearing`
  // (i.e. continuing past the property in the same direction the camera
  // is looking). Inverse haversine.
  const angular = offsetM / EARTH_RADIUS_M;
  const propLat = (property.lat * Math.PI) / 180;
  const propLng = (property.lng * Math.PI) / 180;

  const newLatRad = Math.asin(
    Math.sin(propLat) * Math.cos(angular) +
      Math.cos(propLat) * Math.sin(angular) * Math.cos(bearing),
  );
  const newLngRad =
    propLng +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(propLat),
      Math.cos(angular) - Math.sin(propLat) * Math.sin(newLatRad),
    );

  return {
    lat: (newLatRad * 180) / Math.PI,
    lng: (newLngRad * 180) / Math.PI,
  };
}
