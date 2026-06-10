// ── cancelAutoPan ────────────────────────────────────────────────────
//
// Google's gmp elements (popover, marker, polygon) auto-pan the camera
// to bring themselves into view when they mount/open near the screen
// edge or under the camera. The documented `disable-pan-while-open`
// attribute is NOT honored by the JS web component (confirmed 2026-06-04).
//
// This is a HARD violation of Plot's locked rule: the camera belongs to
// the user, nothing auto-moves it. See [[feedback-no-zoom-to-ui-messes-
// up-flight]] and [[feedback-no-zoom-to-popup]].
//
// Defense: snapshot the camera the instant a selection happens, then
// forcibly restore it every frame for a short window so the auto-pan
// tween can't take hold. Released early on any real user input
// (pointer/wheel/key) so we never fight the user's own camera moves.
//
// Extracted to a shared util 2026-06-09 so EVERY selection path (click,
// shot-impact, search) can pin the camera, not just GroundGlow's popover
// — shooting a parcel close/under the camera was still getting yanked
// because other gmp elements pan too.

interface Map3DCam extends HTMLElement {
  center?: { lat: number; lng: number; altitude?: number };
  heading?: number;
  tilt?: number;
  range?: number;
}

const MAX_MS = 2000;

/**
 * Pin the map camera to its current pose for a short window, cancelling
 * any gmp auto-pan. Returns a stop() to release early. Safe to call on
 * every selection — if there's no camera or no movement, it's a no-op.
 */
export function cancelAutoPan(mapEl: HTMLElement | null): () => void {
  if (!mapEl) return () => {};
  const cam = mapEl as Map3DCam;
  const snap = {
    center: cam.center ? { ...cam.center } : null,
    heading: cam.heading,
    tilt: cam.tilt,
    range: cam.range,
  };
  if (!snap.center) return () => {};

  let rafId = 0;
  let released = false;
  const start = performance.now();

  const release = () => {
    if (released) return;
    released = true;
    window.removeEventListener("pointerdown", release, true);
    window.removeEventListener("wheel", release, true);
    window.removeEventListener("keydown", release, true);
  };
  // Any genuine user input releases the pin immediately so we never
  // override the user's own camera control.
  window.addEventListener("pointerdown", release, true);
  window.addEventListener("wheel", release, true);
  window.addEventListener("keydown", release, true);

  const tick = () => {
    if (released || performance.now() - start > MAX_MS) {
      rafId = 0;
      return;
    }
    try {
      if (snap.center) cam.center = snap.center;
      if (typeof snap.heading === "number") cam.heading = snap.heading;
      if (typeof snap.tilt === "number") cam.tilt = snap.tilt;
      if (typeof snap.range === "number") cam.range = snap.range;
    } catch {
      /* element not ready / mid-teardown — ignore */
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return () => {
    release();
    if (rafId) cancelAnimationFrame(rafId);
  };
}
