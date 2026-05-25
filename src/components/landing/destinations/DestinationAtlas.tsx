'use client';

// DestinationAtlas — the centerpiece of the landing. A flat antique
// atlas image with destination pins positioned at their real lat/lng
// coordinates, glowing softly at rest. Hovering a pin blooms the
// active state and peels open a photographic destination card beside it.
// Clicking commits to the destination and opens the ArrivalSequence.
//
// Architecture:
//   - The atlas itself is a single high-res image (public/assets/landing/
//     atlas.png) rendered as the centered stage. The image is the
//     "world map" — every other element layers on top in code.
//   - Each destination is converted from lat/lng to absolute pixel
//     percentages via equirectangular projection. Atlas bounds match
//     the visible map area inside the parchment frame.
//   - Pins render as positioned absolute elements with a candle-flame
//     glow (CSS box-shadow + radial gradient). Hover state blooms a
//     coral aperture and renders the photographic card next to the pin.
//   - Click triggers the same ArrivalSequence flow the carousel used.

import { useCallback, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { DESTINATIONS, type Destination } from '@/lib/destinations';
import ArrivalSequence, {
  readArrivalInFlight,
  clearArrivalInFlight,
} from './ArrivalSequence';

// ── Atlas projection bounds ─────────────────────────────────────────
// The atlas image shows the world in equirectangular projection. The
// visible map area inside the parchment border doesn't quite span the
// full -90°/+90° latitude range — top and bottom are cropped to the
// graticule labels shown on the image. These constants describe what
// the IMAGE itself covers, so lat/lng → pixel conversion is accurate.
//
// Tuned to the current atlas.png. If the atlas image is swapped, these
// may need to be re-measured against the new image.
const ATLAS_BOUNDS = {
  // Latitude range visible inside the parchment frame
  topLat: 75, // °N at the top edge
  bottomLat: -60, // °S at the bottom edge
  // Longitude is full -180 / +180 for equirectangular
  leftLng: -180,
  rightLng: 180,
  // The map fills roughly the inner 90% of the rendered image width;
  // the parchment border + ocean margin take the remaining 10%. These
  // insets describe where the map content STARTS and ENDS within the
  // image, as fractions of image width/height.
  insetLeft: 0.116,
  insetRight: 0.116,
  insetTop: 0.116,
  insetBottom: 0.116,
};

function latLngToPercent(lat: number, lng: number): { x: number; y: number } {
  const { topLat, bottomLat, leftLng, rightLng, insetLeft, insetRight, insetTop, insetBottom } = ATLAS_BOUNDS;
  // Normalize within the visible map content (0..1)
  const xNorm = (lng - leftLng) / (rightLng - leftLng);
  const yNorm = (topLat - lat) / (topLat - bottomLat);
  // Map normalized content space into the full image space accounting
  // for the parchment-border insets.
  const x = insetLeft + xNorm * (1 - insetLeft - insetRight);
  const y = insetTop + yNorm * (1 - insetTop - insetBottom);
  return { x: x * 100, y: y * 100 };
}

export default function DestinationAtlas() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeDestination, setActiveDestination] = useState<Destination | null>(null);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [resumeAfterAuth, setResumeAfterAuth] = useState(false);

  // OAuth-callback resume — same shape as the carousel had. If the
  // visitor returns with ?resumeArrival=1 and there's a stashed
  // destination, re-open ArrivalSequence at that destination in
  // resume mode.
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('resumeArrival') !== '1') return;
    const stashed = readArrivalInFlight();
    if (!stashed) {
      router.replace('/landing');
      return;
    }
    const match = DESTINATIONS.find((d) => d.slug === stashed.destinationSlug);
    if (!match) {
      clearArrivalInFlight();
      router.replace('/landing');
      return;
    }
    setActiveDestination(match);
    setResumeAfterAuth(true);
    router.replace('/landing');
  }, [searchParams, router]);

  const handlePinClick = useCallback((destination: Destination) => {
    setActiveDestination(destination);
    setResumeAfterAuth(false);
  }, []);

  // Pre-computed pin positions for each destination.
  const pins = useMemo(
    () =>
      DESTINATIONS.map((d) => ({
        destination: d,
        position: latLngToPercent(d.lat, d.lng),
      })),
    [],
  );

  const hovered = hoveredSlug
    ? pins.find((p) => p.destination.slug === hoveredSlug)
    : null;

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Atlas image stage — fills the full viewport. The atlas image
          itself is rendered at its native 16:9 aspect ratio; we use
          object-cover so it fills the viewport completely on any
          aspect ratio (16:9, 16:10, ultrawide). Light cropping of the
          desk-surface edges is acceptable; the atlas content remains
          centered. Pin positions are percentages of the container,
          which match the visible atlas content because the image
          covers the full container. */}
      <div className="relative w-full h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/landing/atlas.png"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover select-none"
          draggable={false}
        />

        {/* Pins — positioned in percentage space relative to the atlas
            image. Each pin is a candle-flame glow with hover + click
            handlers. */}
        {pins.map(({ destination, position }) => {
          const isHovered = hoveredSlug === destination.slug;
          return (
            <button
              key={destination.slug}
              type="button"
              onMouseEnter={() => setHoveredSlug(destination.slug)}
              onMouseLeave={() => setHoveredSlug((current) =>
                current === destination.slug ? null : current,
              )}
              onFocus={() => setHoveredSlug(destination.slug)}
              onBlur={() => setHoveredSlug((current) =>
                current === destination.slug ? null : current,
              )}
              onClick={() => handlePinClick(destination)}
              className="atlas-pin absolute -translate-x-1/2 -translate-y-full focus:outline-none"
              style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
              }}
              aria-label={`Fly to ${destination.name}`}
              data-active={isHovered}
            >
              {/* Pin shaft + flame. Vertical line with a soft amber
                  glow at the tip. Hover blooms a coral aperture. */}
              <div className="pin-shaft" />
              <div className="pin-flame" />
              {isHovered && <div className="pin-aperture" />}

              {/* City label always visible, small editorial caps. */}
              <div className="pin-label">
                {destination.name}
              </div>
            </button>
          );
        })}

        {/* Active destination card — peels open beside the hovered pin.
            Sized and positioned relative to the atlas image. */}
        {hovered && (
          <DestinationHoverCard
            destination={hovered.destination}
            atlasX={hovered.position.x}
            atlasY={hovered.position.y}
          />
        )}
      </div>

      {/* Editorial footer line — quiet, no instructions. */}
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-headline italic text-sm tracking-[0.16em] text-on-surface-variant/60 select-none">
        Choose your field.
      </p>

      {/* Arrival sequence — full-viewport overlay that takes over when
          a destination is picked. Holds OAuth, post-auth questionnaire,
          flight brief, then opens the map. */}
      {activeDestination && (
        <ArrivalSequence
          destination={activeDestination}
          resumeAfterAuth={resumeAfterAuth}
          onCancel={() => {
            setActiveDestination(null);
            setResumeAfterAuth(false);
            clearArrivalInFlight();
          }}
        />
      )}

      <style jsx global>{`
        .atlas-pin {
          width: 28px;
          height: 36px;
          cursor: pointer;
          z-index: 5;
        }

        .atlas-pin .pin-shaft {
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1.5px;
          height: 22px;
          background: linear-gradient(
            to top,
            rgba(244, 201, 127, 0.95) 0%,
            rgba(244, 201, 127, 0.4) 100%
          );
          box-shadow: 0 0 4px rgba(244, 201, 127, 0.6);
        }

        .atlas-pin .pin-flame {
          position: absolute;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 230, 170, 1) 0%,
            rgba(244, 201, 127, 0.85) 35%,
            rgba(200, 85, 61, 0.3) 70%,
            transparent 100%
          );
          box-shadow:
            0 0 8px 2px rgba(244, 201, 127, 0.55),
            0 0 16px 4px rgba(244, 201, 127, 0.35),
            0 0 28px 8px rgba(200, 85, 61, 0.18);
          animation: plot-pin-flicker 2.4s ease-in-out infinite;
        }

        .atlas-pin[data-active='true'] .pin-flame {
          animation: plot-pin-flame-bloom 400ms ease-out forwards;
          background: radial-gradient(
            circle,
            rgba(255, 240, 190, 1) 0%,
            rgba(244, 201, 127, 1) 35%,
            rgba(200, 85, 61, 0.55) 70%,
            transparent 100%
          );
          box-shadow:
            0 0 14px 4px rgba(244, 201, 127, 0.85),
            0 0 28px 8px rgba(244, 201, 127, 0.55),
            0 0 48px 14px rgba(200, 85, 61, 0.32);
        }

        .atlas-pin .pin-aperture {
          position: absolute;
          bottom: 6px;
          left: 50%;
          transform: translateX(-50%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid rgba(200, 85, 61, 0.75);
          animation: plot-pin-aperture-bloom 500ms cubic-bezier(0.2, 0.65, 0.3, 1)
            forwards;
          pointer-events: none;
        }

        .atlas-pin .pin-label {
          position: absolute;
          bottom: 38px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-family: var(--font-geist-sans), 'Inter', sans-serif;
          font-weight: 600;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(244, 234, 213, 0.78);
          text-shadow: 0 1px 4px rgba(14, 22, 38, 0.8),
            0 0 8px rgba(14, 22, 38, 0.6);
          transition: color 200ms ease-out, transform 200ms ease-out;
        }

        .atlas-pin:hover .pin-label,
        .atlas-pin:focus .pin-label,
        .atlas-pin[data-active='true'] .pin-label {
          color: rgba(255, 240, 190, 1);
          transform: translateX(-50%) translateY(-2px);
        }

        @keyframes plot-pin-flicker {
          0%, 100% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 0.82;
            transform: translateX(-50%) scale(0.92);
          }
        }

        @keyframes plot-pin-flame-bloom {
          0% {
            transform: translateX(-50%) scale(1);
          }
          50% {
            transform: translateX(-50%) scale(1.4);
          }
          100% {
            transform: translateX(-50%) scale(1.15);
          }
        }

        @keyframes plot-pin-aperture-bloom {
          0% {
            opacity: 0;
            width: 14px;
            height: 14px;
            border-width: 2px;
          }
          100% {
            opacity: 1;
            width: 36px;
            height: 36px;
            border-width: 1px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .atlas-pin .pin-flame {
            animation: none !important;
          }
          .atlas-pin .pin-aperture {
            animation: none !important;
            opacity: 1;
            width: 32px;
            height: 32px;
          }
        }
      `}</style>
    </div>
  );
}

// ── Destination hover card ─────────────────────────────────────────
// Peels open beside the hovered pin showing the destination's hero
// image (when available) and name + coordinates. Positioned dynamically
// based on the pin's atlas coordinates — pins near the right edge get
// the card on the left, pins near the bottom get the card above, etc.,
// so the card never falls off the atlas.
function DestinationHoverCard({
  destination,
  atlasX,
  atlasY,
}: {
  destination: Destination;
  atlasX: number;
  atlasY: number;
}) {
  // Position the card next to the pin. Default: card sits to the right
  // and slightly below the pin. Flip horizontally if the pin is in the
  // right half of the atlas (so the card doesn't extend off the edge).
  // Flip vertically if the pin is near the bottom edge.
  const flipHorizontal = atlasX > 60;
  const flipVertical = atlasY > 65;

  const cardOffsetX = flipHorizontal ? -2 : 2; // % from pin
  const cardOffsetY = flipVertical ? -2 : 2;

  const transformOrigin = `${flipHorizontal ? 'right' : 'left'} ${
    flipVertical ? 'bottom' : 'top'
  }`;

  const left = flipHorizontal ? undefined : `${atlasX + cardOffsetX}%`;
  const right = flipHorizontal ? `${100 - atlasX + Math.abs(cardOffsetX)}%` : undefined;
  const top = flipVertical ? undefined : `${atlasY + cardOffsetY}%`;
  const bottom = flipVertical ? `${100 - atlasY + Math.abs(cardOffsetY)}%` : undefined;

  const latAbs = Math.abs(destination.lat).toFixed(2);
  const lngAbs = Math.abs(destination.lng).toFixed(2);
  const latHem = destination.lat >= 0 ? 'N' : 'S';
  const lngHem = destination.lng >= 0 ? 'E' : 'W';

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left,
        right,
        top,
        bottom,
        width: '22%',
        minWidth: '240px',
        maxWidth: '320px',
        transformOrigin,
        animation: 'plot-card-peel 380ms cubic-bezier(0.2, 0.65, 0.3, 1) forwards',
      }}
    >
      <div
        className="relative overflow-hidden rounded-md shadow-2xl"
        style={{
          aspectRatio: '16 / 10',
          background: '#0E1626',
          boxShadow:
            '0 4px 20px rgba(0, 0, 0, 0.55), 0 0 40px rgba(200, 85, 61, 0.15)',
        }}
      >
        {destination.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={destination.imageSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // Typographic placeholder until real screenshots are dropped in.
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at top, rgba(244, 234, 213, 0.08), rgba(14, 22, 38, 0.9)), repeating-linear-gradient(45deg, rgba(244, 234, 213, 0.02) 0px, rgba(244, 234, 213, 0.02) 1px, transparent 1px, transparent 4px)',
            }}
          />
        )}
        {/* Graduated dark gradient for legibility */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(14, 22, 38, 0.88) 0%, rgba(14, 22, 38, 0.4) 40%, rgba(14, 22, 38, 0.05) 80%, rgba(14, 22, 38, 0) 100%)',
          }}
        />
        {/* Typography */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="font-mono text-[9px] tracking-[0.18em] text-[#F4C97F]/85">
            {latAbs}° {latHem} &nbsp;&middot;&nbsp; {lngAbs}° {lngHem}
          </p>
          <h3 className="font-headline text-base sm:text-lg font-semibold italic text-surface mt-0.5">
            {destination.name}
          </h3>
          <p className="font-headline italic text-[11px] text-surface/75 mt-0.5">
            {destination.tagline}
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes plot-card-peel {
          0% {
            opacity: 0;
            transform: scale(0.85);
          }
          60% {
            opacity: 1;
            transform: scale(1.02);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
