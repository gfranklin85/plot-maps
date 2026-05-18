'use client';

// AtmosphereOverlay — Phase 4a render layer.
//
// A full-bleed, pointer-events:none div positioned over the map. Reads
// the AtmosphereContext and applies two visual layers:
//
//   1. A backdrop-filter on the whole layer — graded brightness /
//      contrast / saturation that affects the map underneath without
//      needing to wrap the map in a filter container. Works on Safari,
//      Chrome, Firefox; degrades to no-op on browsers that don't support
//      backdrop-filter (older Firefox), in which case the tint layer
//      still applies but without the brightness shift.
//
//   2. A tinted color cast layer — radial gradient biased toward the
//      sun's azimuth, so the side of the frame "facing" the sun gets
//      a warmer/brighter wash than the opposite side. Mix-blend-mode
//      'multiply' for warm grades (deepens the map), 'screen' for cool
//      grades (lifts shadows).
//
// Performance: this is a pure CSS layer. No JS runs per frame. Compositor
// handles everything. Costs nothing.

import { useAtmosphere } from '@/lib/atmosphere/AtmosphereContext';

interface Props {
  /** Whether to render. False = layer renders empty (component returns
   *  null). Lets callers toggle the whole atmospheric pipeline without
   *  unmounting the context provider. */
  enabled?: boolean;
}

export default function AtmosphereOverlay({ enabled = true }: Props) {
  const atmos = useAtmosphere();
  if (!enabled || !atmos) return null;

  // Translate sun azimuth (compass degrees from north) into a CSS
  // background-position percentage for the radial-gradient center.
  // The vignette focuses TOWARD the sun's direction — sunset sun in
  // the west (azimuth ≈ 270°) puts the warm focal point on the left
  // edge of the frame.
  //
  // Map azimuth to (x%, y%) on the viewport:
  //   north (0°)   → 50% 0%   (top-center)
  //   east  (90°)  → 100% 50% (right-center)
  //   south (180°) → 50% 100% (bottom-center)
  //   west  (270°) → 0% 50%   (left-center)
  const azRad = (atmos.vignetteBiasDeg * Math.PI) / 180;
  // Push the focal point slightly past the edge so the gradient feels
  // like it's coming from outside the frame, not a spotlight inside it.
  const ovx = 50 + Math.sin(azRad) * 75;
  const ovy = 50 - Math.cos(azRad) * 75;

  // For warm phases (golden hour / day) use 'multiply' so the tint
  // deepens the map's existing color. For cool phases (twilight /
  // night) use 'screen' so the tint LIFTS shadows toward the blue
  // wash instead of crushing them to black.
  const blendMode =
    atmos.phase === 'night' || atmos.phase === 'astronomical_twilight' || atmos.phase === 'civil_twilight'
      ? 'screen'
      : 'multiply';

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        // backdrop-filter applies the brightness/contrast/saturation
        // grade to everything underneath. No-op on browsers without
        // support — the tint layer below still ships.
        backdropFilter: atmos.cssFilter,
        WebkitBackdropFilter: atmos.cssFilter,
      }}
    >
      {/* Tint cast — radial gradient biased toward the sun direction.
          Goes from the sun's color at the focal edge to transparent
          across the frame, blended over the map. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse 150% 150% at ${ovx.toFixed(1)}% ${ovy.toFixed(1)}%, ${atmos.tintRgba} 0%, transparent 70%)`,
          mixBlendMode: blendMode,
        }}
      />
    </div>
  );
}
