'use client';

// CesiumGlobeLoader — thin client-component wrapper that dynamically
// imports CesiumGlobe with SSR disabled. Cesium relies on WebGL and
// browser globals (window, document, navigator) that don't exist
// during server-side render, so it must mount client-only.
//
// This file exists separate from CesiumGlobe so the landing page can
// stay a server component (which it must be in order to export
// `metadata`). The 'use client' boundary lives here; the landing
// imports this loader as a regular import.

import dynamic from 'next/dynamic';

const CesiumGlobe = dynamic(() => import('./CesiumGlobe'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0E1626]">
      <p className="font-headline italic text-sm tracking-[0.16em] text-surface/50">
        Loading the world…
      </p>
    </div>
  ),
});

export default function CesiumGlobeLoader() {
  return <CesiumGlobe />;
}
