'use client';

// MapViewCesiumLoader — injects Cesium's CDN script/stylesheet once
// and mounts the work-map viewer. Same pattern as CesiumGlobeLoader
// on the landing surface.

import Script from 'next/script';
import MapViewCesium from './MapViewCesium';

const CESIUM_VERSION = '1.141';
const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;

interface Props {
  center?: { lat: number; lng: number } | null;
  altitude?: number;
  showParcels?: boolean;
  parcelColorMode?: 'value' | 'land_use' | 'flat';
  showParcelWalls?: boolean;
  onParcelClick?: (apn: string, latLng: { lat: number; lng: number }) => void;
}

export default function MapViewCesiumLoader(props: Props) {
  return (
    <>
      <link rel="stylesheet" href={`${CESIUM_BASE}/Widgets/widgets.css`} />
      <Script src={`${CESIUM_BASE}/Cesium.js`} strategy="afterInteractive" />
      <MapViewCesium {...props} />
    </>
  );
}
