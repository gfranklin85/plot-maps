'use client';

// FigureSlot — a single encyclopedia-plate figure on Plot's landing page.
//
// Renders in three states, depending on what assets exist:
//   1. NO assets shipped yet → typographic placeholder. A small ornate
//      bracket with the figure label and a hand-lettered "Reserved"
//      mark. Page reads as "the plate exists; this figure is awaiting
//      illustration." No broken-image state.
//   2. 2D asset shipped → the hand-engraved ink illustration is shown.
//      This is the resting state of an active figure.
//   3. 2D + 3D both shipped → the figure quietly awakens to 3D on hover,
//      controller focus, or scheduled ambient cycle. Returns to 2D when
//      attention leaves. The 3D model renders inline in the same slot.
//
// See public/assets/landing/figures/README.md for asset paths.

import { useState, type CSSProperties } from 'react';

export interface FigureSlotProps {
  /** Stable identifier — used to construct asset paths and as React key. */
  figureKey: string;
  /** Roman-numeral figure number for the label (Fig. I, Fig. II, etc.). */
  number: string;
  /** Hand-lettered caption shown beneath the figure. */
  label: string;
  /** True if a 2D illustration has been delivered for this figure. */
  has2D: boolean;
  /** True if a 3D model has been delivered (only meaningful if has2D is also true). */
  has3D: boolean;
  /** Optional click handler — used for the brass-key entry figure. Non-key figures don't take clicks. */
  onClick?: () => void;
  /** Subtle coral glow signature applied to the entry-affordance figure. */
  isEntryAffordance?: boolean;
  /** Tailwind grid column / row span overrides if a figure should claim
   *  more space than the default 1x1 slot (e.g. the plotmaps-mark figure
   *  centered as the title cartouche). */
  className?: string;
  /** Inline style override. */
  style?: CSSProperties;
}

const FIGURES_2D_BASE = '/assets/landing/figures/2d';

export default function FigureSlot({
  figureKey,
  number,
  label,
  has2D,
  has3D,
  onClick,
  isEntryAffordance = false,
  className,
  style,
}: FigureSlotProps) {
  const [hovering, setHovering] = useState(false);
  // 3D rendering deferred for now — the runtime drops in a React Three
  // Fiber canvas here once the .glb exists. For v1, when has3D is true,
  // we still show the 2D but hint at the awaken state via a soft scale
  // and warmth lift. The full 3D swap lands the moment we wire R3F.
  const showAwaken = hovering && has3D;

  const interactive = !!onClick;
  const Container = interactive ? 'button' : 'div';

  return (
    <Container
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className={`group relative flex flex-col items-center justify-end gap-2 ${
        interactive ? 'cursor-pointer' : ''
      } ${className ?? ''}`}
      style={style}
      aria-label={interactive ? `${label} — enter Plot` : label}
    >
      {/* Figure illustration area. Square aspect, centered, transitions
          subtly on hover. The actual illustration sits inside this. */}
      <div
        className={`relative aspect-square w-full max-w-[180px] flex items-center justify-center transition-all duration-500 ${
          showAwaken ? 'scale-105' : 'scale-100'
        }`}
      >
        {has2D ? (
          // 2D illustration delivered. Render the SVG/PNG.
          <div className="relative w-full h-full">
            {/* SVG path — fall back to PNG via <img onError>. */}
            <img
              src={`${FIGURES_2D_BASE}/${figureKey}.svg`}
              alt=""
              className="w-full h-full object-contain"
              onError={(e) => {
                // Try PNG fallback.
                const img = e.currentTarget;
                if (img.src.endsWith('.svg')) {
                  img.src = `${FIGURES_2D_BASE}/${figureKey}.png`;
                }
              }}
              draggable={false}
            />
            {/* Coral signature glow for the entry-affordance figure.
                Subtle, warm, breathes in and out slowly. Goes brighter
                on hover/focus. */}
            {isEntryAffordance && (
              <div
                className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
                  hovering ? 'opacity-90' : 'opacity-50'
                }`}
                style={{
                  background:
                    'radial-gradient(circle at center, rgba(200, 85, 61, 0.18) 0%, transparent 65%)',
                  animation: hovering ? 'none' : 'plot-entry-pulse 3.6s ease-in-out infinite',
                }}
              />
            )}
          </div>
        ) : (
          // No 2D asset yet — typographic placeholder. Reads as an
          // intentional reserved slot in the encyclopedia plate.
          <div className="relative w-full h-full flex items-center justify-center border border-dashed border-outline-variant/60 rounded-sm bg-surface-container-low/40">
            <div className="text-center px-3">
              <div className="text-[10px] font-semibold tracking-[0.2em] uppercase text-on-surface-variant/70">
                {number}
              </div>
              <div className="mt-1 text-[9px] text-on-surface-variant/50 italic">
                Reserved
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hand-lettered caption beneath the figure. */}
      <div className="text-center select-none">
        <div className="text-[10px] font-headline font-semibold tracking-[0.18em] uppercase text-on-surface-variant">
          {number}
        </div>
        <div className="mt-0.5 text-[12px] font-headline italic text-on-surface">
          {label}
        </div>
      </div>
    </Container>
  );
}
