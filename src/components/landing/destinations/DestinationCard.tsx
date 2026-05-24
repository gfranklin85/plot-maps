'use client';

// DestinationCard — one card in the landing's destination carousel.
//
// Two rendering modes:
//   1. With hero image — when destination.imageSrc is set, the card
//      renders the photograph with destination name + tagline laid
//      typographically on top of a graduated darkening gradient.
//   2. Without hero image — typographic placeholder. The card frame
//      is the same dimensions but the interior renders just the name
//      and tagline on a soft parchment field, reading as deliberately
//      in-progress until Greg ships real card art.
//
// Card behavior:
//   - Hover: lifts slightly (translateY -6px), scale 1.02, soft navy
//     glow underneath. Cursor becomes pointer.
//   - Click: calls onSelect(destination). The parent carousel opens
//     the ArrivalSequence overlay which holds the surveyor's logbook
//     and the map preload before navigation actually happens.
//   - Focus (keyboard): same visual treatment as hover, plus a clear
//     focus ring for keyboard accessibility.
//
// Sizing: 16:9 wide cinematic cards (destination posters, not
// Instagram stories). Width is set by the parent carousel; the card
// fills its allotted slot.

import type { Destination } from '@/lib/destinations';

interface Props {
  destination: Destination;
  /** Click handler when the card is selected. The carousel passes a
   *  handler that opens the ArrivalSequence overlay instead of routing
   *  to /map directly — the overlay holds the surveyor's logbook and
   *  the map preload before navigation happens. */
  onSelect?: (destination: Destination) => void;
}

export default function DestinationCard({ destination, onSelect }: Props) {
  const { slug, name, tagline, imageSrc } = destination;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(destination)}
      className="destination-card group block relative overflow-hidden rounded-xl bg-on-surface/[0.04] aspect-[16/9] flex-shrink-0 text-left transition-all duration-300 ease-out hover:-translate-y-1.5 hover:scale-[1.02] focus-visible:-translate-y-1.5 focus-visible:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-surface/40"
      style={{
        width: 'clamp(280px, 28vw, 480px)',
        boxShadow:
          '0 1px 2px rgba(26, 31, 46, 0.06), 0 8px 24px rgba(26, 31, 46, 0.08)',
      }}
      aria-label={`Fly to ${name}`}
      data-destination-slug={slug}
    >
      {/* Hero image OR typographic placeholder */}
      {imageSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          {/* Graduated darkening gradient so the typography stays
              legible regardless of the underlying image's contrast. */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(to top, rgba(26, 31, 46, 0.65) 0%, rgba(26, 31, 46, 0.25) 40%, rgba(26, 31, 46, 0.05) 70%, rgba(26, 31, 46, 0) 100%)',
            }}
          />
        </>
      ) : (
        // Typographic placeholder — same frame, parchment interior.
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, #F4EAD5 0%, #ECDFC2 100%)',
          }}
        >
          {/* Subtle paper-grain to keep the placeholder feeling crafted
              rather than empty. Same texture family as the wordmark hero
              so the page reads as one continuous material. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'repeating-linear-gradient(45deg, rgba(155, 146, 130, 0.025) 0px, rgba(155, 146, 130, 0.025) 1px, transparent 1px, transparent 3px)',
            }}
          />
          {/* Faint reserved-figure mark — like the figure slot placeholders
              in the FieldManualPlate. Signals "this card is in-progress
              and intentional" rather than "broken layout." */}
          <div className="absolute top-4 left-4 text-[10px] font-headline tracking-[0.32em] uppercase text-on-surface-variant/45 select-none">
            Plate · {slug}
          </div>
        </div>
      )}

      {/* Typography overlay — name + tagline. Sits in the lower-left
          on image cards, centered on placeholder cards. */}
      <div
        className={`absolute inset-x-0 bottom-0 p-5 sm:p-6 ${
          imageSrc ? 'text-surface' : 'text-on-surface'
        }`}
      >
        <h3
          className="font-headline text-2xl sm:text-3xl font-bold tracking-tight"
          style={{
            // Subtle text shadow when over imagery, none on placeholder.
            textShadow: imageSrc
              ? '0 2px 12px rgba(26, 31, 46, 0.4)'
              : 'none',
          }}
        >
          {name}
        </h3>
        <p
          className={`mt-1 italic text-sm sm:text-base ${
            imageSrc ? 'text-surface/85' : 'text-on-surface-variant'
          }`}
        >
          {tagline}
        </p>
      </div>
    </button>
  );
}
