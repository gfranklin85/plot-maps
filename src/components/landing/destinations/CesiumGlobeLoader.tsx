'use client';

// CesiumGlobeLoader — formerly wrapped CesiumGlobe with a <Script /> tag
// to inject the Cesium runtime. Now redundant: the persistent Cesium
// viewer (CesiumViewerProvider, mounted at the layout level) owns the
// script load and viewer lifecycle. CesiumGlobe is just a layer over
// that viewer.
//
// Kept as a thin passthrough so /landing's import path doesn't change.
// Safe to delete once /landing/page.tsx is updated to import
// CesiumGlobe directly.

import CesiumGlobe from './CesiumGlobe';

export default function CesiumGlobeLoader() {
  return <CesiumGlobe />;
}
