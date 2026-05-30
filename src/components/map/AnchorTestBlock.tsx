"use client";

// AnchorTestBlock — engineering verification element. Renders a bright
// fixed-size colored block that says "PLOT WAS HERE" so we can visually
// confirm the gmp-marker world-anchor primitive is actually projecting
// our HTML at the property's lat/lng in 3D.
//
// Purpose: prove the world anchor BEFORE risking the real PropertyCard
// design on it. Once this block sits correctly on a building when the
// camera moves, we know the primitive works and we can wire the real
// card in with confidence.
//
// Delete this file once the real PropertyCard is verified working
// through PlotCardMarker3D.

export default function AnchorTestBlock() {
  return (
    <div
      style={{
        background: '#FF2D55',
        color: 'white',
        padding: '12px 18px',
        borderRadius: '12px',
        font: 'bold 14px ui-sans-serif, system-ui',
        boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        border: '3px solid white',
        whiteSpace: 'nowrap',
      }}
    >
      PLOT WAS HERE
    </div>
  );
}
