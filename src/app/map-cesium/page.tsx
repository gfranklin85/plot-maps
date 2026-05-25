'use client';

// /map-cesium — preview surface for the Cesium-based work map.
//
// Lives alongside /map (which renders MapView3D on Map3DElement) so
// you can compare both renderers side-by-side. No chrome wired here
// yet — this is purely "is the Cesium surface where we want it to
// be." Once it's signed off, the cutover folds into /map.
//
// Built 2026-05-25.

import { useState } from 'react';
import MapViewCesiumLoader from '@/components/map/MapViewCesiumLoader';

export default function MapCesiumPreviewPage() {
  const [showParcels, setShowParcels] = useState(true);
  const [colorMode, setColorMode] = useState<'value' | 'land_use' | 'flat'>('land_use');
  const [showWalls, setShowWalls] = useState(true);

  return (
    <div className="fixed inset-0 bg-[#0E1626]">
      <MapViewCesiumLoader
        showParcels={showParcels}
        parcelColorMode={colorMode}
        showParcelWalls={showWalls}
        onParcelClick={(apn, latLng) => {
          // eslint-disable-next-line no-console
          console.log('[Cesium] parcel click', apn, latLng);
        }}
      />

      {/* Minimal control strip — top-right, translucent. Just enough
          to flip the four interesting knobs while flying. */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 rounded-2xl bg-black/60 backdrop-blur-md px-4 py-3 text-white text-xs font-mono shadow-2xl border border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-white/50">Cesium preview</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showParcels}
            onChange={(e) => setShowParcels(e.target.checked)}
          />
          Parcels
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showWalls}
            onChange={(e) => setShowWalls(e.target.checked)}
          />
          Glowing walls
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-white/50">Color</span>
          {(['land_use', 'value', 'flat'] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="colorMode"
                value={m}
                checked={colorMode === m}
                onChange={() => setColorMode(m)}
              />
              {m}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
