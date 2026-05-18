"use client";

interface Props {
  /** Live eye altitude in meters above ground (or seed altitude).
   *  MapView3D's per-frame loop reports this via onAltitudeChange. */
  altitudeMeters: number;
  visible: boolean;
}

// ── Altitude gauge HUD ──────────────────────────────────────────────
//
// Bottom-left readout: live eye altitude as a vertical bar + numeric
// feet + meters. Gives the user a perceived sense of where they
// physically are above the world. No cockpit chrome required — clean
// numerical readout, brand-friendly.
//
// The bar is log-scaled (0..40km mapped non-linearly) so low-altitude
// changes are visible at the bottom of the bar AND high-altitude
// changes are still resolvable at the top. Linear would hide every
// useful change below 1km in a single-pixel sliver.

// Bar configuration.
const ALT_MAX_M = 40_000;  // matches MapView3D's altitude ceiling
// Log-scale mapping: log10(1 + altitude). At 0m → 0, at 40,000m → ~4.6.
// We normalize the result to 0..1 for the bar height.
function altitudeToBarFraction(altMeters: number): number {
  if (altMeters <= 0) return 0;
  const ln = Math.log10(1 + altMeters);
  const ceil = Math.log10(1 + ALT_MAX_M);
  return Math.min(1, ln / ceil);
}

function formatFeet(meters: number): string {
  const ft = meters * 3.28084;
  if (ft < 1000) return `${Math.round(ft)} ft`;
  return `${(ft / 1000).toFixed(1)}k ft`;
}

function formatMeters(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function AltitudeGauge({ altitudeMeters, visible }: Props) {
  if (!visible) return null;

  const fraction = altitudeToBarFraction(altitudeMeters);
  const barHeightPct = fraction * 100;

  return (
    <div
      aria-hidden
      className="absolute bottom-6 left-6 z-30 pointer-events-none flex items-end gap-2"
    >
      {/* Vertical bar with fill */}
      <div className="relative w-2 h-32 rounded-full bg-surface/40 backdrop-blur-md border border-white/10 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full bg-gradient-to-t from-primary/80 to-amber-400/80 transition-all duration-150 ease-out"
          style={{ height: `${barHeightPct}%` }}
        />
        {/* Tick marks at decade altitudes for orientation */}
        {[10, 100, 1000, 10000].map((m) => {
          const tickPct = altitudeToBarFraction(m) * 100;
          return (
            <div
              key={m}
              className="absolute left-0 right-0 h-px bg-white/15"
              style={{ bottom: `${tickPct}%` }}
            />
          );
        })}
      </div>

      {/* Numeric readout */}
      <div className="flex flex-col gap-0.5">
        <div className="text-[11px] font-mono font-bold text-on-surface tabular-nums leading-tight">
          {formatFeet(altitudeMeters)}
        </div>
        <div className="text-[9px] font-mono text-on-surface-variant tabular-nums leading-tight">
          {formatMeters(altitudeMeters)}
        </div>
      </div>
    </div>
  );
}
