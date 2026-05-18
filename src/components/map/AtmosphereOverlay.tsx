'use client';

// AtmosphereOverlay — DEMOTED (2026-05-18).
//
// Originally Phase 4a's primary atmospheric layer. The painted sky dome
// (Greg's Blender + paint craft, see docs/asset-roadmap.md > Sky Paintings)
// now carries 95% of the atmospheric work. This layer survives as the
// thin "ground-bounce tint" — the warmth or coolness reflecting off the
// terrain back up onto the camera, the bottom 5% the sky dome physically
// can't reach because it's overhead.
//
// Per feedback_no_basic_css_magic memory: CSS atmospheric work is not a
// featured layer in Plot — but it's honest as a subtle finishing touch
// that complements the crafted assets above it. Think of it as the bloom
// off a painter's last brushstroke, not the painting itself.
//
// What this layer does NOW:
//   - A weak bottom-edge tint that varies with sun phase (warm at golden
//     hour, cool at night, neutral at noon)
//   - Maximum effective opacity capped at 8% so it can never be the
//     featured atmospheric element
//   - No more backdrop-filter brightness/contrast/saturation grading —
//     that work belongs to the sky paintings, not to CSS
//   - No more directional radial gradient covering the whole frame
//
// Performance: still pure CSS, zero JS per frame.

import { useAtmosphere } from '@/lib/atmosphere/AtmosphereContext';

interface Props {
  /** Whether to render the ground-bounce tint. False = layer returns null. */
  enabled?: boolean;
}

// Cap at 8% — non-negotiable. This layer must never be the featured
// atmospheric element. If you ever feel the urge to crank this above 8%,
// the right move is to commission Greg for a crafted asset instead.
const MAX_GROUND_TINT_OPACITY = 0.08;

export default function AtmosphereOverlay({ enabled = true }: Props) {
  const atmos = useAtmosphere();
  if (!enabled || !atmos) return null;

  // Ground tint opacity: scales with how much directional warmth/cool
  // we'd expect off the terrain. Strongest at golden hour and twilight
  // (low-angle light bouncing off the ground); near-zero at high noon
  // (light comes straight down, no horizontal bounce); modest at deep
  // night (cool ambient reflected off the terrain).
  let tintOpacity = 0;
  if (atmos.phase === 'golden_hour') tintOpacity = MAX_GROUND_TINT_OPACITY;
  else if (atmos.phase === 'civil_twilight' || atmos.phase === 'astronomical_twilight') tintOpacity = MAX_GROUND_TINT_OPACITY * 0.85;
  else if (atmos.phase === 'night') tintOpacity = MAX_GROUND_TINT_OPACITY * 0.5;
  else if (atmos.phase === 'day') {
    // Subtle day tint only when the sun is low (early morning or late
    // afternoon). High noon = zero. Linear ramp from sun elevation 6° (full)
    // to 30° (zero).
    const elevAbove6 = Math.max(0, atmos.sunElevationDeg - 6);
    const dayTaper = 1 - Math.min(1, elevAbove6 / 24);
    tintOpacity = MAX_GROUND_TINT_OPACITY * 0.5 * dayTaper;
  }

  if (tintOpacity <= 0.001) return null;

  // Phase-keyed tint color. Warm for low-angle light, cool for night.
  // Pulled directly from the atmosphere context's phase-keyed tint
  // so it stays consistent with the sky dome's color story.
  const tintColor = atmos.tintRgba.replace(/,\s*[\d.]+\)$/, `, ${tintOpacity.toFixed(3)})`);

  // Bottom-edge gradient — fades from the tint color at the very bottom
  // edge of the frame up to transparent at ~40% of the frame height.
  // This is the "warmth reflecting off the ground" effect — never the
  // sky itself.
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        background: `linear-gradient(to top, ${tintColor} 0%, transparent 40%)`,
        // Multiply so the warmth deepens the terrain colors rather than
        // washing them out. Subtle by design.
        mixBlendMode: 'multiply',
      }}
    />
  );
}
