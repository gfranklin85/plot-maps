'use client';

// Phase 4a of the atmospheric rendering thesis.
//
// AtmosphereContext publishes a real-time "what does the sky look like
// right now at this location" state derived from the user's lat/lng plus
// the system clock. v1 is time-of-day only — sun elevation drives a
// color-temp shift, a brightness lift/dip, and a directional vignette.
// Future phases layer live weather (4b), particles (4c), and AQI (4d)
// on top of the same context — same consumers, richer state.
//
// Recomputation cadence: every 60s. Sun elevation moves slowly (~0.25°
// per minute) so per-second updates would burn CPU for zero visible
// difference. A 60s tick is imperceptible to a viewer.
//
// Why this is not Three.js (yet): the v1 color grade + vignette are 2D
// operations any browser already does with CSS filter + radial-gradient.
// Mounting Three.js to render those would be over-engineering. When we
// need particles for rain/snow/dust (Phase 4c), THAT is when we mount
// Three.js and the existing context state feeds the GLSL shaders. The
// upgrade is incremental; no rewrite.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import SunCalc from 'suncalc';

// One atmosphere snapshot. Consumers read this and render accordingly.
export interface AtmosphereState {
  // Sun position
  /** Degrees above (positive) or below (negative) the horizon. */
  sunElevationDeg: number;
  /** Compass bearing of the sun. 0 = north, 90 = east, 180 = south, 270 = west. */
  sunAzimuthDeg: number;
  /** Discrete time-of-day phase. Useful for non-continuous decisions
   *  (e.g. swap a background asset, change Surveyor copy). */
  phase: 'night' | 'astronomical_twilight' | 'civil_twilight' | 'golden_hour' | 'day';
  // Render hints (all derived; consumers can use these directly without
  // re-doing the math).
  /** CSS color the overlay should tint the map with. RGBA. */
  tintRgba: string;
  /** 0..1 strength of the tint when blended over the map. */
  tintOpacity: number;
  /** 0..2 multiplier for the map's apparent brightness. 1.0 = neutral.
   *  Below 1 dims (night); above 1 brightens (golden hour). */
  brightnessMultiplier: number;
  /** CSS `filter` string ready to drop on a layer. Includes brightness,
   *  contrast, and saturation tuning per phase. */
  cssFilter: string;
  /** Direction the vignette should bias toward. Same coordinate system
   *  as sunAzimuthDeg. Lets the overlay render a warmer/brighter edge
   *  on the side the sun is on. */
  vignetteBiasDeg: number;
}

interface AtmosphereInput {
  lat: number;
  lng: number;
  /** Optional override for testing. Pass a fixed Date to freeze the
   *  atmosphere for screenshots / regression. */
  fixedTime?: Date;
}

// ── Color-grade lookup ────────────────────────────────────────────
// Each phase carries a tint, an opacity, a brightness multiplier, and
// CSS filter parameters. The thresholds (sun elevation in degrees) are
// the standard astronomical / photographic definitions:
//   day:                   sun > +6°
//   golden hour:           -4° to +6°    (warm low-angle light)
//   civil twilight:        -6° to -4°    (post-sunset glow / pre-sunrise blue)
//   astronomical twilight: -12° to -6°   (deepening night)
//   night:                 sun < -12°
//
// We interpolate continuously WITHIN each phase rather than snap-
// changing at boundaries. That keeps transitions smooth — a viewer
// watching the sun set never sees a step change.

interface PhaseStop {
  /** Sun elevation in degrees this stop targets. */
  elev: number;
  tint: [number, number, number];      // RGB 0-255
  tintOpacity: number;
  brightness: number;                  // 1.0 = neutral
  contrast: number;                    // 1.0 = neutral
  saturation: number;                  // 1.0 = neutral
  phase: AtmosphereState['phase'];
}

const STOPS: PhaseStop[] = [
  // Deep night
  { elev: -90, tint: [26, 37, 64],  tintOpacity: 0.55, brightness: 0.65, contrast: 1.05, saturation: 0.85, phase: 'night' },
  { elev: -12, tint: [26, 37, 64],  tintOpacity: 0.50, brightness: 0.72, contrast: 1.04, saturation: 0.88, phase: 'night' },
  // Astronomical twilight
  { elev: -8,  tint: [50, 65, 110], tintOpacity: 0.40, brightness: 0.82, contrast: 1.02, saturation: 0.92, phase: 'astronomical_twilight' },
  // Civil twilight — the "blue hour" — coolest moment of the day
  { elev: -4,  tint: [90, 106, 154], tintOpacity: 0.32, brightness: 0.92, contrast: 1.00, saturation: 0.95, phase: 'civil_twilight' },
  // Sunset / sunrise — the dramatic warm
  { elev: -2,  tint: [255, 153, 102], tintOpacity: 0.28, brightness: 0.98, contrast: 1.02, saturation: 1.10, phase: 'golden_hour' },
  { elev: 2,   tint: [255, 178, 122], tintOpacity: 0.22, brightness: 1.03, contrast: 1.02, saturation: 1.10, phase: 'golden_hour' },
  // Golden hour — warm but rising
  { elev: 6,   tint: [255, 217, 168], tintOpacity: 0.16, brightness: 1.05, contrast: 1.02, saturation: 1.08, phase: 'golden_hour' },
  // Working hours — warm white
  { elev: 20,  tint: [255, 244, 224], tintOpacity: 0.08, brightness: 1.02, contrast: 1.00, saturation: 1.04, phase: 'day' },
  // High noon — neutral
  { elev: 50,  tint: [255, 255, 255], tintOpacity: 0.00, brightness: 1.00, contrast: 1.00, saturation: 1.00, phase: 'day' },
  { elev: 90,  tint: [255, 255, 255], tintOpacity: 0.00, brightness: 1.00, contrast: 1.00, saturation: 1.00, phase: 'day' },
];

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function interpStops(elev: number): {
  tint: [number, number, number];
  tintOpacity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  phase: AtmosphereState['phase'];
} {
  // Clamp.
  if (elev <= STOPS[0].elev) return STOPS[0];
  if (elev >= STOPS[STOPS.length - 1].elev) return STOPS[STOPS.length - 1];
  // Find the bracketing stops.
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (elev >= a.elev && elev <= b.elev) {
      const t = (elev - a.elev) / (b.elev - a.elev);
      return {
        tint: lerpColor(a.tint, b.tint, t),
        tintOpacity: lerp(a.tintOpacity, b.tintOpacity, t),
        brightness: lerp(a.brightness, b.brightness, t),
        contrast: lerp(a.contrast, b.contrast, t),
        saturation: lerp(a.saturation, b.saturation, t),
        // Phase is discrete; take the lower stop's phase below the
        // midpoint, the higher stop's phase above.
        phase: t < 0.5 ? a.phase : b.phase,
      };
    }
  }
  return STOPS[STOPS.length - 1];
}

function computeAtmosphere(lat: number, lng: number, when: Date): AtmosphereState {
  const sun = SunCalc.getPosition(when, lat, lng);
  // suncalc returns altitude in radians. Azimuth is measured from
  // SOUTH, going clockwise (Sun at solar noon = 0). Convert to a
  // compass bearing from NORTH for our consumers.
  const sunElevationDeg = (sun.altitude * 180) / Math.PI;
  const sunAzimuthDeg = (((sun.azimuth * 180) / Math.PI) + 180 + 360) % 360;

  const interp = interpStops(sunElevationDeg);
  const [r, g, b] = interp.tint;
  const tintRgba = `rgba(${r}, ${g}, ${b}, ${interp.tintOpacity.toFixed(3)})`;

  const cssFilter = [
    `brightness(${interp.brightness.toFixed(3)})`,
    `contrast(${interp.contrast.toFixed(3)})`,
    `saturate(${interp.saturation.toFixed(3)})`,
  ].join(' ');

  return {
    sunElevationDeg,
    sunAzimuthDeg,
    phase: interp.phase,
    tintRgba,
    tintOpacity: interp.tintOpacity,
    brightnessMultiplier: interp.brightness,
    cssFilter,
    vignetteBiasDeg: sunAzimuthDeg,
  };
}

// ── React context ─────────────────────────────────────────────────

const AtmosphereContext = createContext<AtmosphereState | null>(null);

interface ProviderProps extends AtmosphereInput {
  children: ReactNode;
  /** Milliseconds between recomputations. Default 60_000 (1 minute) —
   *  the sun moves slowly enough that anything tighter wastes work. */
  refreshMs?: number;
}

export function AtmosphereProvider({ lat, lng, fixedTime, refreshMs = 60_000, children }: ProviderProps) {
  const [now, setNow] = useState<Date>(() => fixedTime ?? new Date());

  useEffect(() => {
    if (fixedTime) return; // frozen for testing
    const id = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(id);
  }, [fixedTime, refreshMs]);

  const value = useMemo(
    () => computeAtmosphere(lat, lng, now),
    [lat, lng, now],
  );

  return (
    <AtmosphereContext.Provider value={value}>
      {children}
    </AtmosphereContext.Provider>
  );
}

export function useAtmosphere(): AtmosphereState | null {
  return useContext(AtmosphereContext);
}

// Export for tests + dev tooling.
export const _internals = { computeAtmosphere, interpStops, STOPS };
