"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

// Photorealistic 3D Tiles renderer (Map3DElement / gmp-map-3d). This
// is THE Plot experience. The 3D world is the product. Locked
// 2026-05-30 evening — the prior profile.enable3DTilesAdmin gate is
// gone. Plot was created to give people the spatial experience; the
// 2D Mercator fallback only fires for devices that genuinely cannot
// render 3D tiles (see has3DSupport in the map page).
const MapView3D = dynamic(() => import("./MapView3D"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
  ),
});

export default function MapDynamic(props: MapViewProps) {
  return <MapView3D {...props} />;
}
