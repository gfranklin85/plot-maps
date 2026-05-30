"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import CardBeamTail from "./CardBeamTail";
import {
  projectMap3DLatLngToScreen,
  type Map3DCameraState,
} from "@/lib/map3DProjection";

// AnchoredPropertyCard v5 — minimal renderer + opt-in projection.
//
// Locked 2026-05-30. v4 confirmed the popup CAN render when we strip
// projection. v5 adds projection back as an optional layer: if camera
// state reads and projection succeeds, popup tracks the property;
// otherwise popup falls back to a fixed top-center position so the
// click path is never broken. The fallback is the v4 behavior — guaranteed
// to render.
//
// The projection math lives in src/lib/map3DProjection.ts (computed
// from Map3DElement's documented camera state: center, heading, tilt,
// range + standard 35° vertical FOV). When the camera moves, the
// RAF loop recomputes every frame and the popup follows the property.

interface AnchoredPropertyCardProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  altitudeM?: number;
  popoverForwardRef?: React.MutableRefObject<HTMLElement | null>;
  children: ReactNode;
}

interface Map3DElement extends HTMLElement {
  center: { lat: number; lng: number; altitude?: number };
  heading: number;
  tilt: number;
  range: number;
}

// Fallback fixed position when projection can't read the camera.
// Top-center of viewport. The v4 minimal version proved this position
// works as a safety net.
const FALLBACK_TOP_PX = 90;

export default function AnchoredPropertyCard({
  mapElRef,
  lat,
  lng,
  altitudeM = 8,
  popoverForwardRef,
  children,
}: AnchoredPropertyCardProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (popoverForwardRef) popoverForwardRef.current = mapElRef.current;
    return () => {
      if (popoverForwardRef) popoverForwardRef.current = null;
    };
  }, [popoverForwardRef, mapElRef]);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    const tick = () => {
      if (cancelled) return;
      const mapEl = mapElRef.current as Map3DElement | null;
      let projectedNext: { x: number; y: number } | null = null;

      if (mapEl) {
        try {
          const rect = mapEl.getBoundingClientRect();
          const cam: Map3DCameraState = {
            center: mapEl.center,
            heading: mapEl.heading,
            tilt: mapEl.tilt,
            range: mapEl.range,
          };
          if (
            cam.center &&
            typeof cam.heading === 'number' &&
            typeof cam.tilt === 'number' &&
            typeof cam.range === 'number' &&
            rect.width > 0 &&
            rect.height > 0
          ) {
            const projected = projectMap3DLatLngToScreen(
              { lat, lng, altitude: altitudeM },
              cam,
              { width: rect.width, height: rect.height }
            );
            if (projected.visible) {
              projectedNext = {
                x: rect.left + projected.x,
                y: rect.top + projected.y,
              };
            }
          }
        } catch {
          /* projection threw — fall through to fallback */
        }
      }

      // If projection produced a position, use it. Otherwise use the
      // fallback top-center (so the popup is ALWAYS visible).
      const next = projectedNext ?? {
        x: window.innerWidth / 2,
        y: FALLBACK_TOP_PX,
      };

      const last = lastPosRef.current;
      if (
        !last ||
        Math.abs(last.x - next.x) > 0.5 ||
        Math.abs(last.y - next.y) > 0.5
      ) {
        lastPosRef.current = next;
        setPos(next);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, altitudeM]);

  if (typeof document === 'undefined') return null;
  if (!pos) return null;

  // Decide vertical anchor: when projection succeeded, we want the
  // popup's BOTTOM-CENTER at the projected point (so it floats above
  // the property). When falling back to top-center, we want the
  // popup's TOP-CENTER at the fallback point.
  const isFallback = pos.y === FALLBACK_TOP_PX;
  const transform = isFallback
    ? 'translateX(-50%)'
    : 'translate(-50%, -100%)';

  return createPortal(
    <div
      data-plot-popup="1"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        transform,
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
