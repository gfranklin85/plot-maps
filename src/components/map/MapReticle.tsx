'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  /** Whether the reticle should render at all. Page passes false outside airplane mode. */
  visible: boolean;
  /** Set when a target is under the reticle. Null = empty space, just show the dot. */
  hovering: boolean;
  /** Set when the user has actively grabbed the hovered target (LT held). */
  grabbed: boolean;
  /**
   * How far up the viewport (as a 0..1 fraction) to render the reticle.
   * 0.5 = CSS center. Lower numbers = higher up the screen. With camera
   * tilt > 0 the visual focal point of the map sits above CSS-center, so
   * the page passes a smaller value (e.g. 0.42) when in tilted airplane
   * mode to land the reticle on what the user perceives as "what I'm
   * pointed at" instead of dead-center pixels.
   */
  topFraction?: number;
}

/**
 * Center-screen reticle for airplane mode. Three states:
 *   - Empty (visible, hovering=false, grabbed=false)  → small dot
 *   - Hovering (visible, hovering=true, grabbed=false) → hand icon, pulsing emerald
 *   - Grabbed (visible, ..., grabbed=true)             → hand icon, solid emerald + ring
 *
 * Pure presentation. All hover detection / grab state lives on the page.
 */
export default function MapReticle({ visible, hovering, grabbed, topFraction = 0.5 }: Props) {
  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ top: `${topFraction * 100}%` }}
    >
      {grabbed ? (
        <div className="relative flex h-12 w-12 items-center justify-center">
          {/* outer pulse ring confirming the grab is active */}
          <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-50" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.55)]">
            <MaterialIcon icon="back_hand" className="text-[18px] text-white" />
          </div>
        </div>
      ) : hovering ? (
        <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-500/20 backdrop-blur-sm shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse">
          <MaterialIcon icon="back_hand" className="text-[16px] text-emerald-100" />
        </div>
      ) : (
        <div className="h-2.5 w-2.5 rounded-full bg-white/85 shadow-[0_0_6px_rgba(255,255,255,0.6)] ring-1 ring-black/30" />
      )}
    </div>
  );
}
