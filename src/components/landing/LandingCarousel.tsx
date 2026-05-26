'use client';

// LandingCarousel — Plot's entry-point carousel.
//
// Single viewport, horizontal scroller, one active card at a time with
// neighbors faded at the edges. Picking a card mounts ArrivalSequence
// over the carousel (questions → OAuth → handoff to /map).
//
// Navigation:
//   - Left / right arrow buttons (mouse)
//   - Arrow keys (keyboard)
//   - (Future) D-pad on a connected controller — same indices
//   - Enter / Space / A button on the active card = pick it
//
// Layout invariants:
//   - One viewport tall, no scroll. The carousel fills the middle.
//   - Wordmark top-left, controller chip top-right.
//   - Survey-tick corner accents (the only vintage callback).
//   - All chrome above the carousel; carousel itself is z-0 in this page.

import { useCallback, useEffect, useMemo, useState } from 'react';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import LandingControllerChip from '@/components/landing/LandingControllerChip';
import ArrivalSequence from '@/components/landing/destinations/ArrivalSequence';
import {
  LANDING_DESTINATIONS as DESTINATIONS,
  type Destination,
} from '@/lib/destinations';
import LandingDestinationCard from './LandingDestinationCard';

export default function LandingCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [committed, setCommitted] = useState<Destination | null>(null);

  const advance = useCallback(
    (delta: number) => {
      setActiveIndex((i) => {
        const next = (i + delta + DESTINATIONS.length) % DESTINATIONS.length;
        return next;
      });
    },
    [],
  );

  const commit = useCallback(() => {
    setCommitted(DESTINATIONS[activeIndex] ?? null);
  }, [activeIndex]);

  // Keyboard navigation. Arrow keys to flip, Enter/Space to commit the
  // active card. Skip when ArrivalSequence is already open (it owns its
  // own focus + key handling).
  useEffect(() => {
    if (committed) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        advance(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance(1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        commit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, commit, committed]);

  // Precomputed cards so the indexed map stays cheap.
  const cards = useMemo(
    () =>
      DESTINATIONS.map((d, i) => ({
        destination: d,
        offset: i - activeIndex,
      })),
    [activeIndex],
  );

  const active = DESTINATIONS[activeIndex];

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0B1020] text-[#ECEDF3] select-none">
      {/* Subtle topo grid backdrop. Faint enough to read as texture, not
          decoration. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(180,190,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(180,190,255,1) 1px, transparent 1px)',
          backgroundSize: '120px 120px',
        }}
      />
      {/* Soft warm-light wash from upper-left — Plot's canonical light
          direction. Stays subtle; the cards do the visual work. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 18% 8%, rgba(255, 215, 165, 0.06) 0%, rgba(255, 215, 165, 0) 65%)',
        }}
      />

      {/* Survey-tick corner accents — the one vintage-cartography
          callback we keep. */}
      <SurveyTick className="top-5 left-5" corner="tl" />
      <SurveyTick className="top-5 right-5" corner="tr" />
      <SurveyTick className="bottom-5 left-5" corner="bl" />
      <SurveyTick className="bottom-5 right-5" corner="br" />

      {/* Wordmark — top-left. Locked logo, no replacement. */}
      <header className="absolute top-6 left-8 z-30">
        <div style={{ width: '160px' }}>
          <PlotMapsLogo color="#F4EAD5" className="w-full h-auto" />
        </div>
      </header>

      {/* Controller chip — top-right. */}
      <LandingControllerChip />

      {/* Carousel stage. The active card sits centered; neighbors flank
          it, dimmed and slightly scaled. Click a neighbor to advance to
          it; click the active card to commit. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* Headline + sub. Two lines that say what the page is to a
            first-time visitor. Plain language; no platform-speak. */}
        <div className="mb-10 text-center px-6">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#7B8398] mb-3">
            Pick a city to fly
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
            The real-estate platform you fly.
          </h1>
        </div>

        {/* Card track. Each card is absolutely positioned by its offset
            from the active index, so the layout is smooth even on rapid
            navigation. */}
        <div className="relative w-full max-w-[1400px] h-[460px] mx-auto">
          {cards.map(({ destination, offset }) => (
            <LandingDestinationCard
              key={destination.slug}
              destination={destination}
              offset={offset}
              onActivate={() => {
                if (offset === 0) {
                  commit();
                } else {
                  setActiveIndex(DESTINATIONS.indexOf(destination));
                }
              }}
            />
          ))}
        </div>

        {/* Active-card meta (coordinates + tagline). Plot's plain-text
            footer line — no fake instruments. */}
        <div className="mt-8 text-center h-12">
          <p className="font-mono text-[12px] tracking-[0.12em] text-[#7B8398]">
            {formatCoords(active)}
          </p>
          {active?.tagline && (
            <p className="font-headline italic text-[13px] text-[#C4CBDC] mt-1">
              {active.tagline}
            </p>
          )}
        </div>

        {/* Primary action */}
        <button
          onClick={commit}
          className="mt-8 group inline-flex items-center gap-3 px-7 py-3 rounded-full bg-[#F4EAD5] text-[#0B1020] font-semibold tracking-[0.04em] hover:bg-white transition-colors"
        >
          <span>Plug in to fly</span>
          <span
            aria-hidden
            className="inline-block w-4 h-4 border border-current rounded-full relative"
          >
            <span className="absolute inset-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
          </span>
        </button>
      </div>

      {/* Arrow controls — flank the carousel. */}
      <ArrowButton
        direction="left"
        onClick={() => advance(-1)}
        className="left-6"
      />
      <ArrowButton
        direction="right"
        onClick={() => advance(1)}
        className="right-6"
      />

      {/* ArrivalSequence overlay — mounts when the user commits. */}
      {committed && (
        <ArrivalSequence
          destination={committed}
          resumeAfterAuth={false}
          onCancel={() => setCommitted(null)}
        />
      )}
    </main>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function SurveyTick({
  className,
  corner,
}: {
  className?: string;
  corner: 'tl' | 'tr' | 'bl' | 'br';
}) {
  const borders =
    corner === 'tl'
      ? 'border-t border-l'
      : corner === 'tr'
      ? 'border-t border-r'
      : corner === 'bl'
      ? 'border-b border-l'
      : 'border-b border-r';
  return (
    <div
      aria-hidden
      className={`absolute w-3 h-3 border-[#7B8398]/40 ${borders} ${className ?? ''}`}
    />
  );
}

function ArrowButton({
  direction,
  onClick,
  className,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
  className?: string;
}) {
  const label = direction === 'left' ? 'Previous city' : 'Next city';
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-sm flex items-center justify-center text-[#ECEDF3]/70 hover:text-white hover:bg-white/[0.08] hover:border-white/30 transition-all active:scale-95 ${className ?? ''}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden
        style={{ transform: direction === 'left' ? 'rotate(180deg)' : undefined }}
      >
        <path
          d="M4 1 L10 7 L4 13"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function formatCoords(d: Destination | undefined): string {
  if (!d) return '';
  const lat = d.pose.lat;
  const lng = d.pose.lng;
  const latAbs = Math.abs(lat).toFixed(4);
  const lngAbs = Math.abs(lng).toFixed(4);
  const latHem = lat >= 0 ? 'N' : 'S';
  const lngHem = lng >= 0 ? 'E' : 'W';
  return `${latAbs}° ${latHem}   ·   ${lngAbs}° ${lngHem}`;
}
