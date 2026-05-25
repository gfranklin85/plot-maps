'use client';

// CesiumGlobeLoader — wraps CesiumGlobe with the CDN Script loader.
// Cesium's runtime is loaded via <Script /> from cesium.com's CDN
// rather than bundled through webpack — Cesium is a 3MB+ library
// that doesn't ship cleanly through Next.js's code-splitting.
//
// Strategy "afterInteractive": Next.js only honors "beforeInteractive"
// in the root layout. On page-level routes, the global directive is
// ignored and the script never executes — which is what caused the
// previous "Loading the world…" hang. "afterInteractive" loads the
// script as soon as the page hydrates; CesiumGlobe polls window.Cesium
// until it's ready and initializes the viewer the moment it lands.

import Script from 'next/script';
import CesiumGlobe from './CesiumGlobe';

const CESIUM_VERSION = '1.141';
const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

export default function CesiumGlobeLoader() {
  return (
    <>
      <link rel="stylesheet" href={`${CESIUM_BASE}/Widgets/widgets.css`} />
      <Script src={`${CESIUM_BASE}/Cesium.js`} strategy="afterInteractive" />
      <CesiumGlobe />
    </>
  );
}
