'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  /** Whether the reticle should render at all. Page passes false outside airplane mode. */
  visible: boolean;
  /** Set when a target is under the reticle. Null = empty space, just show the dot. */
  hovering: boolean;
  /** Set when the user has actively grabbed the hovered target (LT held). */
  grabbed: boolean;
  /**
   * 0..1 horizontal viewport fraction. 0.5 = center. Saved per-user
   * via localStorage; drag the reticle to change. The Y counterpart
   * replaces the old topFraction prop.
   */
  xFraction: number;
  yFraction: number;
  /** Called when the user finishes dragging the reticle. Page persists
   *  the new position via useReticlePosition. */
  onPositionChange?: (next: { xFraction: number; yFraction: number }) => void;
  /** Called when the user double-clicks the reticle to reset position. */
  onResetPosition?: () => void;
}

/**
 * Center-screen reticle for airplane mode. Three visual states:
 *   - Empty (visible, hovering=false, grabbed=false)  → small dot
 *   - Hovering (visible, hovering=true, grabbed=false) → hand icon, pulsing emerald
 *   - Grabbed (visible, ..., grabbed=true)             → hand icon, solid emerald + ring
 *
 * Drag-to-place: mousedown on the reticle starts a drag that follows the
 * cursor across the whole document until mouseup. Position commits on
 * release (as a 0..1 viewport fraction so it survives resize). Double
 * click resets to default. The wrapper stays pointer-events:none so the
 * surrounding area passes clicks through; only the inner dot/icon is
 * interactive.
 */
export default function MapReticle({
  visible,
  hovering,
  grabbed,
  xFraction,
  yFraction,
  onPositionChange,
  onResetPosition,
}: Props) {
  // Position-during-drag. While the user holds the mouse down, we render
  // from this transient state so motion is buttery; on release we call
  // onPositionChange with the final fractions and let the parent persist.
  const [dragPos, setDragPos] = useState<{ xFraction: number; yFraction: number } | null>(null);
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (grabbed) return; // don't drag while the user is grabbing a target
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    setDragPos({ xFraction, yFraction });
  }, [grabbed, xFraction, yFraction]);

  useEffect(() => {
    if (!visible) return;
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      setDragPos({
        xFraction: Math.max(0.05, Math.min(0.95, e.clientX / w)),
        yFraction: Math.max(0.05, Math.min(0.95, e.clientY / h)),
      });
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragPos(current => {
        if (current) onPositionChange?.(current);
        return null;
      });
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [visible, onPositionChange]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResetPosition?.();
  }, [onResetPosition]);

  if (!visible) return null;

  const x = dragPos?.xFraction ?? xFraction;
  const y = dragPos?.yFraction ?? yFraction;
  const isDragging = dragPos !== null;

  // Wrapper is pointer-events:none so the page below remains clickable;
  // only the inner ring/dot below opts back into pointer events for
  // drag. This preserves the current "reticle never blocks the map"
  // behavior outside of the small grab affordance.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title="Drag to place · double-click to reset"
        className="pointer-events-auto"
        style={{ cursor: isDragging ? 'grabbing' : grabbed ? 'default' : 'grab' }}
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
    </div>
  );
}
