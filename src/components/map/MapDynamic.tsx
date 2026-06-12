"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

// Routes between the two real map surfaces based on `view3D`:
//   • 3D (view3D=true)  → MapView3D — the photoreal flight map
//     (gmp-map-3d / Map3DElement). THE flight experience.
//   • 2D (view3D=false) → MapView — the lightweight flat map
//     (@vis.gl/react-google-maps <Map>). The 2D Work Mode surface,
//     where the rich 2D-only Maps features live (DDS boundaries, etc).
//
// FIXED 2026-06-12: this used to ALWAYS render MapView3D and ignore the
// toggle, so clicking "2D" only flattened the 3D camera tilt — the user
// could never actually reach the 2D map. The ModeSwitch now genuinely
// swaps surfaces. (2D Work Mode = [[project-2d-work-mode]].)
const MapView3D = dynamic(() => import("./MapView3D"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
  ),
});
const MapView2D = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
  ),
});

export default function MapDynamic(props: MapViewProps) {
  return props.view3D ? <MapView3D {...props} /> : <MapView2D {...props} />;
}
