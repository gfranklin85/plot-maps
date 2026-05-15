"use client";

import dynamic from "next/dynamic";
import { useProfile } from "@/lib/profile-context";
import type { MapViewProps } from "./MapView";

// Standard 2D-tilt Maps JS API renderer. The default for everyone.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
  ),
});

// Photorealistic 3D Tiles renderer (Map3DElement / gmp-map-3d). Admin
// gate via profiles.enable_3d_tiles_admin. Billed per session against
// the Google Cloud project, so we keep it off by default until we've
// measured real cost-per-session and decided on a tier model.
const MapView3D = dynamic(() => import("./MapView3D"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
  ),
});

// Single entry point — picks the renderer based on the admin flag.
// All other props pass through unchanged; both renderers share the
// MapViewProps interface so page.tsx never has to know which surface
// is downstream.
export default function MapDynamic(props: MapViewProps) {
  const { profile } = useProfile();
  if (profile.enable3DTilesAdmin) {
    return <MapView3D {...props} />;
  }
  return <MapView {...props} />;
}
