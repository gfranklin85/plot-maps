"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import CardBeamTail from "./CardBeamTail";

// AnchoredPropertyCard v4 — MINIMUM VIABLE RENDERER for diagnosis.
// Locked 2026-05-30. The full v3 perspective-projection version was
// silently rendering nothing. This is a stripped-back version that
// just portals the popup to a fixed location on screen (top-center
// with a 80px offset) so we can confirm the click → mount → render
// path is alive end-to-end. Once we know the popup CAN appear,
// projection comes back in a separate pass.

interface AnchoredPropertyCardProps {
  mapElRef: React.MutableRefObject<HTMLElement | null>;
  lat: number;
  lng: number;
  altitudeM?: number;
  popoverForwardRef?: React.MutableRefObject<HTMLElement | null>;
  children: ReactNode;
}

export default function AnchoredPropertyCard({
  mapElRef,
  popoverForwardRef,
  children,
}: AnchoredPropertyCardProps) {
  useEffect(() => {
    if (popoverForwardRef) popoverForwardRef.current = mapElRef.current;
    return () => {
      if (popoverForwardRef) popoverForwardRef.current = null;
    };
  }, [popoverForwardRef, mapElRef]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-plot-popup="1"
      style={{
        position: 'fixed',
        left: '50%',
        top: '90px',
        transform: 'translateX(-50%)',
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
