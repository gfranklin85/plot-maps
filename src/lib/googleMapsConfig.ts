// Single source of truth for the Google Maps loader params.
//
// Google Maps JS can only be loaded ONCE per page. @vis.gl/react-google-maps'
// APIProvider locks the params on the first mount; any later APIProvider with
// DIFFERENT `libraries` throws "already loaded with different parameters" and
// its libraries are silently ignored — which breaks maps3d (the 3D tiles /
// flight camera) and marker rendering, and destabilizes the camera (the Vegas
// "stuck in the ground" flight bug traced back to this).
//
// Fix: every APIProvider requests the SAME superset of libraries from here, so
// whichever mounts first, maps3d + marker + places are all present and no
// second loader ever conflicts. Add a library here (not per-component) if a new
// surface needs one.
import type { APIProviderProps } from '@vis.gl/react-google-maps';

export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// The union of every library any surface needs. maps3d = photoreal 3D tiles,
// marker = advanced markers, places = search/autocomplete.
export const GOOGLE_MAPS_LIBRARIES: NonNullable<APIProviderProps['libraries']> =
  ['places', 'marker', 'maps3d'];
