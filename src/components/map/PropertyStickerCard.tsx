"use client";

// PropertyStickerCard — the windshield-sticker popup.
//
// Greg's framing 2026-06-06 (verbatim): "Imagine that google didnt
// offer us anything, all you can do is fly around, but any add on,
// you have to pull off with camera tricks really. This is just 2026
// Buster Keaton version."
//
// The model is dead simple:
//   1. At the moment of click, we record (a) the screen pixel where
//      they clicked and (b) the camera's eye state at that instant
//      (heading, pitch, altitude).
//   2. Each frame after that, we look at how much the camera has
//      moved/turned/tilted SINCE the click, and we slide the
//      sticker on the screen by the same amount the world has
//      slid underneath it.
//   3. If the camera hasn't moved, the sticker hasn't moved. If
//      the camera pans right by 1°, the world pixels visibly slide
//      left, and we slide the sticker left by the same number of
//      pixels — so the sticker stays glued to that house silhouette.
//
// There is no 3D scene on our side. No virtual world. No projection
// math against lat/lng. The lat/lng is just a label for the planted
// spot; the math is purely camera-delta-to-pixel-delta.
//
// We have an out: if the user moves the camera far enough that the
// math would put the sticker off-screen by more than a margin, we
// just stop rendering until they fly back. Nothing fancy.

import { useEffect, useRef, useState } from "react";

interface CamSnapshot {
  heading: number;     // degrees, 0=N
  pitch: number;       // degrees, 0=horizon, +60=down 60°
  altitude: number;    // meters
  lat: number;
  lng: number;
}

interface Props {
  cameraRef: React.RefObject<CamSnapshot | null>;
  /** Screen pixel where the user clicked (pageX/pageY at click time). */
  anchorPxX: number;
  anchorPxY: number;
  /** Snapshot of the camera at the click frame. Used as the zero-point
   *  for camera-delta math. */
  cameraAtClick: CamSnapshot;
  children: React.ReactNode;
}

// ── Tuning ──────────────────────────────────────────────────────────
// How many screen pixels does the world slide for 1° of camera rotation?
// At ~60° horizontal FOV on a 1920px-wide viewport, 1° ≈ 32px. We adapt
// to the actual viewport size at runtime so this stays right on any
// monitor. (1920 / 60 = 32.)
function pxPerDegHorizontal(viewportPxWide: number, hFovDeg = 60): number {
  return viewportPxWide / hFovDeg;
}
function pxPerDegVertical(viewportPxTall: number, vFovDeg = 35): number {
  // Vertical FOV is smaller than horizontal in widescreen viewports.
  // ~35° is a reasonable default for Google Map3D's tilt range.
  return viewportPxTall / vFovDeg;
}

// Off-screen margin: if the projected sticker position falls more than
// this many pixels outside the viewport, hide the sticker. Tiny grace
// so we don't pop at the literal edge.
const OFFSCREEN_MARGIN_PX = 200;

// Rise-in animation. The sticker begins this many pixels ABOVE its
// anchor (further up the screen, already above the reticle) and 0
// opacity, then over RISE_MS milliseconds settles down to the anchor
// with full opacity. Greg locked 2026-06-06: "we want it to animate
// up. But also, it cant animate up from behind, under, or cover the
// reticle, it must begin rising already above the reticle." The
// animation moves DOWN by RISE_FROM_OFFSET_PX to land at its anchor;
// it never crosses the reticle line because the anchor is itself
// already above the reticle.
const RISE_FROM_OFFSET_PX = 36;
const RISE_MS = 280;

export default function PropertyStickerCard({
  cameraRef,
  anchorPxX,
  anchorPxY,
  cameraAtClick,
  children,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // visible state mirrored as React so children can react if they need
  // to (e.g. opacity transitions). We mostly write straight to style
  // to avoid 60fps re-renders.
  const [visible, setVisible] = useState(true);
  // Rise-in animation start timestamp. Captured on the FIRST frame
  // we have a wrapper + camera. Reset whenever the anchor pixel
  // changes (new selection → new rise).
  const riseStartRef = useRef<number | null>(null);

  // Reset the rise animation start whenever the anchor changes —
  // makes a new click feel like a new rise, not a teleport.
  useEffect(() => {
    riseStartRef.current = null;
  }, [anchorPxX, anchorPxY]);

  useEffect(() => {
    let rafId = 0;
    let cancelled = false;

    function tick() {
      if (cancelled) return;
      const wrapper = wrapperRef.current;
      const cam = cameraRef.current;
      if (!wrapper || !cam) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      // Stamp the rise start on the first frame we can render. Using
      // performance.now() so the timer is monotonic across re-renders.
      if (riseStartRef.current === null) {
        riseStartRef.current = performance.now();
      }
      const riseElapsed = performance.now() - (riseStartRef.current ?? 0);
      const riseT = Math.min(1, riseElapsed / RISE_MS);
      // ease-out cubic so it lands soft
      const riseEased = 1 - Math.pow(1 - riseT, 3);
      // Sticker starts RISE_FROM_OFFSET_PX higher than the anchor (so it
      // begins ALREADY above the reticle, never crossing it) and
      // animates DOWN to the anchor.
      const riseOffsetY = -RISE_FROM_OFFSET_PX * (1 - riseEased);
      const riseOpacity = riseEased;

      // ── Camera deltas since click ──
      // heading change → horizontal world slide. If the camera has
      // rotated +Δh degrees clockwise (yaw right), the world appears
      // to slide LEFT by Δh × pxPerDeg, so the sticker also slides
      // left by the same amount.
      let dHeading = cam.heading - cameraAtClick.heading;
      // shortest-arc wrap so 359→1° is +2°, not -358°.
      if (dHeading > 180) dHeading -= 360;
      if (dHeading < -180) dHeading += 360;

      const dPitch = cam.pitch - cameraAtClick.pitch;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const pxPerDegH = pxPerDegHorizontal(vw);
      const pxPerDegV = pxPerDegVertical(vh);

      // Camera pans right (positive dHeading) → world slides left on
      // screen → sticker slides left → subtract from x.
      const slideX = -dHeading * pxPerDegH;
      // Camera pitches down (positive dPitch) → world slides UP on
      // screen → sticker slides up → subtract from y.
      const slideY = -dPitch * pxPerDegV;

      const x = anchorPxX + slideX;
      const y = anchorPxY + slideY + riseOffsetY;

      const offscreen =
        x < -OFFSCREEN_MARGIN_PX ||
        x > vw + OFFSCREEN_MARGIN_PX ||
        y < -OFFSCREEN_MARGIN_PX ||
        y > vh + OFFSCREEN_MARGIN_PX;

      wrapper.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      wrapper.style.opacity = offscreen ? '0' : String(riseOpacity);
      wrapper.style.pointerEvents = offscreen ? 'none' : 'auto';
      if (visible && offscreen) setVisible(false);
      if (!visible && !offscreen) setVisible(true);

      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [cameraRef, anchorPxX, anchorPxY, cameraAtClick, visible]);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 50,
        willChange: 'transform, opacity',
        transform: `translate3d(${anchorPxX}px, ${anchorPxY}px, 0) translate(-50%, -100%)`,
        pointerEvents: 'auto',
      }}
    >
      {children}
    </div>
  );
}
