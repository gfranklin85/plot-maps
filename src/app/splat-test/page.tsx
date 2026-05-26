'use client';

// /splat-test — bare validation page for the Gaussian-splat HUD layer.
// Renders the F-18 .ply over a placeholder background with a live
// opacity slider so we can confirm geometry, color, and HUD positioning
// before wiring the layer into /map and the landing arrival sequence.

import { useState } from 'react';
import SplatHUDLayer from '@/components/splat/SplatHUDLayer';

export default function SplatTestPage() {
  const [opacity, setOpacity] = useState(0.7);
  const [rotation, setRotation] = useState(0);
  const [idleMotion, setIdleMotion] = useState(true);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0B1020] text-white">
      {/* Test backdrop — a vertical gradient so we can see how the
          translucent splat composites over a real background. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #1a2540 0%, #0B1020 50%, #08101F 100%)',
        }}
      />
      {/* Faint grid to confirm transparency. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(120,140,200,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(120,140,200,0.18) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Controls panel — adjust opacity / rotation / idle motion live. */}
      <div className="absolute top-6 left-6 z-[60] bg-black/55 backdrop-blur rounded-lg p-4 w-72 space-y-4 text-xs">
        <div>
          <p className="uppercase tracking-[0.18em] text-white/60 mb-2">
            Opacity: {(opacity * 100).toFixed(0)}%
          </p>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <p className="uppercase tracking-[0.18em] text-white/60 mb-2">
            Rotation Y: {rotation.toFixed(2)} rad
          </p>
          <input
            type="range"
            min={-Math.PI}
            max={Math.PI}
            step={Math.PI / 24}
            value={rotation}
            onChange={(e) => setRotation(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={idleMotion}
            onChange={(e) => setIdleMotion(e.target.checked)}
          />
          <span className="text-white/80">Idle motion</span>
        </label>
        <p className="text-[10px] text-white/50 leading-relaxed">
          F-18 Gaussian splat from SAM 3D. Adjust until composition reads
          right, then bake values into SplatHUDLayer defaults.
        </p>
      </div>

      <SplatHUDLayer
        splatUrl="/assets/splats/f18hornet.ply"
        opacity={opacity}
        initialRotationY={rotation}
        idleMotion={idleMotion}
        widthFraction={0.4}
      />
    </main>
  );
}
