"use client";

import { useEffect, useRef, useState } from "react";
import { RITUAL_TIMING } from "@/lib/ritualTiming";

// CardBeamTail — the vertical information beam that visually "deploys"
// the popup from the ground. Renders as a child of the popup container
// so it stays glued to the popup natively (no follow loop needed).
//
// Greg locked 2026-05-28: the beam must STAY with the popup, not the
// screen. Previous approach used screen-space SVG + follow loop reading
// the popover's bounding rect — fragile when Google's gmp-popover uses
// internal compositing that doesn't always reflect into bounding rects.
//
// This version is a normal absolutely-positioned div just BELOW the
// card's bottom edge. The popup's parent positions itself in screen
// space (via gmp-popover); we ride along by being inside the same
// element. The beam moves when the popup moves. Period.
//
// The beam animates IN on mount (rises from 0 height → RISE_DISTANCE),
// reaching full extension at the same moment the card's reveal
// animation completes. Visually the beam "lands into" the card.

interface CardBeamTailProps {
  /** Height in pixels the beam extends below the card. */
  heightPx?: number;
}

export default function CardBeamTail({
  heightPx = RITUAL_TIMING.REBOUND_RISE_DISTANCE_PX,
}: CardBeamTailProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Trigger the rise animation on mount. We start at scaleY(0) anchored
  // at the top (origin: top center) so the beam APPEARS to extend
  // DOWN from the card's bottom. But the source-of-thought is the
  // beam rising UP from the ground INTO the card — so we use a
  // bottom-up scale + opacity sweep that reads as "energy rising."
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '4px',
        height: `${heightPx}px`,
        pointerEvents: 'none',
        // Origin at TOP so when we scaleY(0→1) it grows DOWNWARD from
        // the card's bottom edge — reads as "the beam extends from the
        // card toward the ground."
        transformOrigin: 'top center',
      }}
    >
      {/* The beam itself — vertical gradient from bright at top
          (touching the card) to faint at bottom (touching the ground). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,255,148,1) 0%, rgba(0,255,148,0.7) 40%, rgba(0,255,148,0.2) 95%, rgba(0,255,148,0) 100%)',
          borderRadius: '2px',
          filter: 'drop-shadow(0 0 4px rgba(0,255,148,0.7)) drop-shadow(0 0 12px rgba(0,255,148,0.35))',
          // Animate the scaleY from 0 → 1 over the rebound rise
          // duration, eased. Pairs with the card's own fade-in so
          // both complete at approximately the same frame.
          transform: mounted ? 'scaleY(1)' : 'scaleY(0)',
          transformOrigin: 'top center',
          transition: `transform ${RITUAL_TIMING.REBOUND_RISE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease-out`,
          opacity: mounted ? 1 : 0,
        }}
      />
      {/* Information node — sits at the BOTTOM of the beam (the ground
          end) as the spatial anchor. Subtle glow. v1 placeholder for the
          eventual Blender/SAM-3D asset per design-intelligence thesis. */}
      <div
        style={{
          position: 'absolute',
          bottom: '-4px',
          left: '50%',
          transform: mounted ? 'translateX(-50%) scale(1)' : 'translateX(-50%) scale(0)',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,148,1) 0%, rgba(0,255,148,0.6) 50%, rgba(0,255,148,0) 100%)',
          filter: 'drop-shadow(0 0 8px rgba(0,255,148,0.85))',
          transition: `transform ${RITUAL_TIMING.REBOUND_RISE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`,
          transitionDelay: `${RITUAL_TIMING.REBOUND_RISE_DURATION_MS * 0.4}ms`,
          transformOrigin: 'center',
        }}
      />
    </div>
  );
}
