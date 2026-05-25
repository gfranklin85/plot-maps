'use client';

// CesiumGlobeLoader — wraps CesiumGlobe with the CDN Script loader.
// Cesium's runtime is loaded via <Script /> from cesium.com's CDN
// rather than bundled through webpack — Cesium is a 3MB+ library
// that doesn't ship cleanly through Next.js's code-splitting.
//
// Once the CDN scripts load, window.Cesium becomes available and
// CesiumGlobe initializes the viewer against it.

import Script from 'next/script';
import CesiumGlobe from './CesiumGlobe';

const CESIUM_VERSION = '1.141';
const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

export default function CesiumGlobeLoader() {
  return (
    <>
      <link rel="stylesheet" href={`${CESIUM_BASE}/Widgets/widgets.css`} />
      <Script
        src={`${CESIUM_BASE}/Cesium.js`}
        strategy="beforeInteractive"
      />
      <CesiumGlobe />
    </>
  );
}
