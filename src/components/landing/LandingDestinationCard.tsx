'use client';

// LandingDestinationCard — a single card in the landing carousel.
//
// Layout is offset-driven. The card receives `offset` (its index relative
// to the active card: 0 = centered, -1 = one to the left, +2 = two to
// the right, etc.) and positions itself accordingly with a CSS transform.
//
// Visual treatment by offset:
//   - 0 (active)        — full scale, full opacity, soft outer glow
//   - ±1                — slightly smaller, dimmed, slight blur
//   - ±2 and beyond     — further dimmed, more blur; cards far off-screen
//                          render but with opacity 0 so they don't flash
//                          during navigation
//
// Card content:
//   - Background image when destination.imageSrc exists; typographic
//     placeholder when not. Placeholder reads as "screenshot pending,"
//     not broken.
//   - Bottom gradient + name overlay.
//   - Active card additionally renders the destination's coords + a thin
//     border accent.

import type { Destination } from '@/lib/destinations';

interface Props {
  destination: Destination;
  /** Offset from the active card index. 0 = centered. */
  offset: number;
  /** Called when the user clicks the card. Active card commits; others
   *  advance the carousel to that card. The parent decides which. */
  onActivate: () => void;
}

const CARD_WIDTH = 720;
const CARD_HEIGHT = 405; // 16:9
const NEIGHBOR_GAP_PX = 56;

export default function LandingDestinationCard({
  destination,
  offset,
  onActivate,
}: Props) {
  const isActive = offset === 0;
  const absOff = Math.abs(offset);

  // Horizontal translation. Each neighbor sits a card-width-plus-gap to
  // the side of the active card. Sign carries direction.
  const translateX = offset * (CARD_WIDTH + NEIGHBOR_GAP_PX);

  // Scale shrinks neighbors. Falls off as you move away from active.
  const scale = isActive ? 1 : Math.max(0.78, 0.92 - (absOff - 1) * 0.06);

  // Opacity. Far-out cards effectively invisible so they don't blink
  // during fast advance, but they stay in the DOM so transitions are
  // smooth.
  const opacity = isActive
    ? 1
    : absOff === 1
    ? 0.55
    : absOff === 2
    ? 0.25
    : 0;

  // Blur on neighbors gives focus to the active card.
  const blur = isActive ? 0 : absOff === 1 ? 2 : 4;

  // Z-order: active on top, neighbors behind, far ones further behind.
  const zIndex = isActive ? 20 : 10 - absOff;

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={isActive ? `Fly to ${destination.name}` : `Show ${destination.name}`}
      tabIndex={isActive ? 0 : -1}
      className="absolute left-1/2 top-1/2 cursor-pointer rounded-2xl overflow-hidden transition-[transform,opacity,filter,box-shadow] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none"
      style={{
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        transform: `translate(-50%, -50%) translateX(${translateX}px) scale(${scale})`,
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
        zIndex,
        boxShadow: isActive
          ? '0 30px 80px -20px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px -10px rgba(244,234,213,0.15)'
          : '0 20px 40px -20px rgba(0,0,0,0.5)',
        pointerEvents: absOff > 2 ? 'none' : 'auto',
      }}
    >
      {destination.imageSrc ? (
        <img
          src={destination.imageSrc}
          alt={destination.name}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <PlaceholderArt name={destination.name} />
      )}

      {/* Bottom gradient + label band. */}
      <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none">
        <div className="flex items-baseline justify-between gap-6">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.28em] mb-2"
              style={{ color: 'rgba(244, 234, 213, 0.7)' }}
            >
              {destination.region}
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-white">
              {destination.name}
            </h2>
          </div>
          {isActive && (
            <p className="font-mono text-[11px] tracking-[0.12em] text-white/55 whitespace-nowrap">
              {fmt(destination.pose.lat, 'lat')}  ·  {fmt(destination.pose.lng, 'lng')}
            </p>
          )}
        </div>
      </div>

      {/* Active inner stroke — a hair of an outline that reads as
          "selected" without shouting. */}
      {isActive && (
        <div
          aria-hidden
          className="absolute inset-3 rounded-[14px] pointer-events-none"
          style={{ border: '1px solid rgba(255,255,255,0.10)' }}
        />
      )}
    </button>
  );
}

function PlaceholderArt({ name }: { name: string }) {
  // Typographic placeholder — large city name on a soft gradient so
  // the page reads as "screenshot pending" rather than broken. The
  // composition matches the real card framing so swapping in the
  // real image later doesn't shift the layout.
  return (
    <div
      className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 40%, #1F2742 0%, #0F1424 70%, #0B1020 100%)',
      }}
    >
      <div className="text-center px-8 opacity-30">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#9AA3BB] mb-3">
          screenshot pending
        </p>
        <p className="font-display text-6xl font-semibold tracking-tight text-[#C4CBDC]">
          {name}
        </p>
      </div>
    </div>
  );
}

function fmt(deg: number, axis: 'lat' | 'lng'): string {
  const hem =
    axis === 'lat' ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
  return `${Math.abs(deg).toFixed(4)}° ${hem}`;
}
