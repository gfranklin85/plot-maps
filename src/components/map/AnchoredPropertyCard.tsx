"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import CardBeamTail from "./CardBeamTail";
import {
  projectMap3DLatLngToScreen,
  type Map3DCameraState,
} from "@/lib/map3DProjection";

// AnchoredPropertyCard v3 — manual perspective projection.
//
// Locked 2026-05-30. v1 used gmp-popover (chrome we couldn't kill).
// v2 used gmp-marker-3d-interactive + getBoundingClientRect (marker
// rect doesn't reflect projected screen position — Google paints into
// a separate WebGL canvas). v3 reads the map's camera state each frame
// (center, heading, tilt, range) and computes the lat/lng → screen
// pixel projection ourselves via standard perspective math.
//
// Math lives in src/lib/map3DProjection.ts. This component:
//   1. Reads the gmp-map-3d host's camera state each animation frame
//   2. Projects target.lat/lng to viewport pixel coords
//   3. Renders the React children via createPortal(..., document.body)
//      as a position:fixed div at the projected coordinates
//
// When the camera moves, the popup tracks the property naturally
// because we recompute every frame. When the target goes off-screen
// or behind the camera, we hide the popup.

interface AnchoredPropertyCardProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  /** Altitude above ground in meters. The popup floats above this
   *  point on the screen. */
  altitudeM?: number;
  /** Forwarded ref so other components (CardBeamTail, RitualTether)
   *  can find the popup's host position. Kept for API compatibility
   *  with v1 callers — points at the map element rather than a marker
   *  in this version. */
  popoverForwardRef?: React.MutableRefObject<HTMLElement | null>;
  children: ReactNode;
}

interface Map3DElement extends HTMLElement {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
}

export default function AnchoredPropertyCard({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  popoverForwardRef,
  children,
}: AnchoredPropertyCardProps) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number; visible: boolean } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number; visible: boolean } | null>(null);

  // Forward the map element to the popoverForwardRef so callers that
  // expected a positionable element still get one.
  useEffect(() => {
    if (popoverForwardRef) popoverForwardRef.current = mapElRef.current;
    return () => {
      if (popoverForwardRef) popoverForwardRef.current = null;
    };
  }, [popoverForwardRef, mapElRef]);

  // ── RAF loop: read camera state → project → setScreenPos ─────
  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    const tick = () => {
      if (cancelled) return;
      const mapEl = mapElRef.current as Map3DElement | null;
      if (mapEl) {
        const rect = mapEl.getBoundingClientRect();
        const cam: Map3DCameraState = {
          center: mapEl.center,
          heading: mapEl.heading,
          tilt: mapEl.tilt,
          range: mapEl.range,
        };
        // Defensive: camera fields can be undefined during the brief
        // window before Map3D initializes its scene. Skip the frame
        // and let the RAF loop retry next frame.
        if (
          cam.center &&
          typeof cam.heading === 'number' &&
          typeof cam.tilt === 'number' &&
          typeof cam.range === 'number'
        ) {
          // Map the target relative to viewport ORIGIN at the map's
          // bounding rect (so the popup sits in viewport coords, not
          // map-element-local coords).
          const projected = projectMap3DLatLngToScreen(
            { lat, lng, altitude: altitudeM },
            cam,
            { width: rect.width, height: rect.height }
          );
          const x = rect.left + projected.x;
          const y = rect.top + projected.y;
          const visible = projected.visible;
          const last = lastPosRef.current;
          if (
            !last ||
            last.visible !== visible ||
            Math.abs(last.x - x) > 0.5 ||
            Math.abs(last.y - y) > 0.5
          ) {
            const next = { x, y, visible };
            lastPosRef.current = next;
            setScreenPos(next);
          }
        }
      }
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
    // mapElRef is stable; lat/lng/altitude changes re-trigger projection
    // automatically because we re-read them every frame inside the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, altitudeM]);

  if (!screenPos || typeof document === 'undefined') return null;
  if (!screenPos.visible) return null;

  return createPortal(
    <div
      data-plot-popup="1"
      style={{
        position: 'fixed',
        left: screenPos.x,
        top: screenPos.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 40,
        pointerEvents: 'auto',
      }}
    >
      {children}
      <CardBeamTail />
    </div>,
    document.body,
  );
}
