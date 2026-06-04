// Monument rise/sink animation primitives — shared by the in-world
// monument that surfaces from a selected parcel. Extracted from the
// (now-retired) PlotMonumentLayer so the single-monument summon and any
// future caller use the identical feel.
//
// The monument lives buried below ground at rest and rises to ground
// level on selection with a heavy ease-out + slight settle bounce, as if
// a heavy slab is decelerating into place. Sinking gathers speed downward
// with no overshoot. Greg locked the feel 2026-05-30 evening.

/** Altitude (meters) the monument rests at while buried — far enough
 *  below ground to be invisible at any camera angle. */
export const BURIED_ALT_M = -30;
/** Altitude (meters) the monument rises to when surfaced. Floats just
 *  above rooftop height so the card-tower hovers close over the property,
 *  not way up in the sky. Tunable live via window.__plotMonumentRiseM. */
export const RISEN_ALT_M = 20;
/** Rise duration (ms) — buried → risen. */
export const RISE_MS = 850;
/** Sink duration (ms) — risen → buried. Faster than the rise. */
export const SINK_MS = 550;

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Spring-style overshoot for the rise: peaks at 1.05 around t=0.85 then
 *  settles back to 1.0, so the slab feels heavy as it comes to rest. */
export function easeOutWithSettle(t: number): number {
  if (t < 0.85) {
    const local = t / 0.85;
    return easeOutCubic(local) * 1.05;
  }
  const local = (t - 0.85) / 0.15;
  return 1.05 - 0.05 * easeOutCubic(local);
}

/** Ease-in for the sink — gathers speed downward, no overshoot. */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/** Interpolate altitude for a rise (uses settle) or sink (uses ease-in).
 *  `raw` is linear progress 0..1. */
export function altAt(from: number, to: number, raw: number): number {
  const rising = to > from;
  const eased = rising ? easeOutWithSettle(raw) : easeInCubic(raw);
  return from + (to - from) * eased;
}
