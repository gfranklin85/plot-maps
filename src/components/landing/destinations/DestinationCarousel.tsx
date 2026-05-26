'use client';

// DestinationCarousel — horizontally-scrolling row of destination cards
// on the landing page, beneath the wordmark hero.
//
// Scroll mechanics:
//   - Native horizontal overflow scrolling. Works with trackpad swipes,
//     mouse wheel (with shift on Windows), and touch.
//   - Snap-to-card behavior so the scroll lands clean.
//   - Keyboard arrows scroll the row by one card width at a time.
//   - Subtle scrollbar styling (cream track, navy thumb at low opacity).
//
// Search affordance:
//   - At the right end of the carousel (after the last card), an inline
//     "Fly anywhere" prompt with a text input. For the casual visitor
//     whose city isn't featured. Submits to /map?destination=<query>
//     and the map route resolves the free-text query into a camera target.
//   - The free-text resolution itself is a follow-on task — for now the
//     submit just routes with the query attached.
//
// Section header:
//   - Restrained editorial line — "Begin anywhere" — no aggressive CTA.
//     The cards do the visual work; the header just opens the section
//     in the field-manual voice.

import { useRef, useState, useCallback, useEffect, KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DESTINATIONS, type Destination } from '@/lib/destinations';
import DestinationCard from './DestinationCard';
import ArrivalSequence, {
  readArrivalInFlight,
  clearArrivalInFlight,
} from './ArrivalSequence';

export default function DestinationCarousel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState('');
  // When set, the ArrivalSequence overlay mounts and takes over the
  // viewport. Cleared on cancel; on completion the overlay navigates
  // away from /landing entirely so we don't need to clear it.
  const [activeDestination, setActiveDestination] = useState<Destination | null>(null);
  // When the visitor returns from the OAuth round-trip via
  // /landing?resumeArrival=1, mount ArrivalSequence in resume mode so
  // the sequence picks up at logbook beat instead of replaying from
  // darken.
  const [resumeAfterAuth, setResumeAfterAuth] = useState(false);

  const handleDestinationSelect = useCallback((destination: Destination) => {
    setActiveDestination(destination);
    setResumeAfterAuth(false);
  }, []);

  // OAuth-callback resume effect — runs once on mount. If the URL
  // carries ?resumeArrival=1 and localStorage has a stashed in-flight
  // arrival, re-open ArrivalSequence at the right destination in
  // resume mode.
  //
  // Note: we deliberately keep ?resumeArrival=1 in the URL until the
  // ArrivalSequence completes and navigates to /map. Stripping it here
  // (via router.replace('/landing')) caused middleware's "authenticated
  // user on /landing → /" rule to bounce the visitor to the dashboard
  // mid-sequence. The param falls off naturally when ArrivalSequence
  // hands off to /map?destination=<slug>.
  useEffect(() => {
    if (!searchParams) return;
    if (searchParams.get('resumeArrival') !== '1') return;
    const slugFromUrl = searchParams.get('dest');
    const stashed = !slugFromUrl ? readArrivalInFlight() : null;
    const slug = slugFromUrl ?? stashed?.destinationSlug ?? null;
    if (!slug) return;
    const match = DESTINATIONS.find((d) => d.slug === slug);
    if (!match) {
      clearArrivalInFlight();
      return;
    }
    setActiveDestination(match);
    setResumeAfterAuth(true);
  }, [searchParams]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = searchValue.trim();
      if (!trimmed) return;
      // Free-text "fly anywhere" submissions become a synthetic destination
      // routed through the same arrival sequence. The free-text → lat/lng
      // resolution happens on the /map side via geocoding; for now we
      // bypass the arrival sequence and route directly since we don't
      // yet have coordinates to display in the instrument.
      router.push(`/map?destination=${encodeURIComponent(trimmed)}`);
    },
    [router, searchValue]
  );

  // Arrow-key scrolling — one card width per press.
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!scrollerRef.current) return;
    const el = scrollerRef.current;
    // Heuristic card width — matches the card's clamp() formula's midpoint.
    const cardStep = Math.min(480, Math.max(280, el.clientWidth * 0.28));
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      el.scrollBy({ left: cardStep + 24, behavior: 'smooth' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      el.scrollBy({ left: -(cardStep + 24), behavior: 'smooth' });
    }
  }, []);

  return (
    <section
      aria-label="Destinations"
      className="relative w-full h-full flex flex-col justify-center"
      style={{
        // Background is transparent in the one-viewport layout — the
        // parent landing page paints the parchment field as a single
        // material under both hero and carousel.
        backgroundColor: 'transparent',
      }}
    >
      <div className="relative z-10 mx-auto max-w-[1800px] w-full px-6 sm:px-10">
        {/* Section header — restrained editorial line. */}
        <header className="mb-8 sm:mb-10 select-none">
          <div className="flex items-center gap-4 text-on-surface-variant/55">
            <span className="text-[10px] font-headline font-semibold tracking-[0.4em] uppercase">
              Tab. II
            </span>
            <span className="h-px flex-1 max-w-[120px] bg-current" aria-hidden />
          </div>
          <h2 className="mt-3 font-headline text-3xl sm:text-4xl font-bold tracking-tight text-on-surface italic">
            Begin anywhere.
          </h2>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-2xl">
            A city, a coast, your own street. Pick a plate or fly somewhere of your own.
          </p>
        </header>

        {/* Scrolling row of cards. */}
        <div
          ref={scrollerRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="plot-destination-scroller flex items-stretch gap-5 sm:gap-6 overflow-x-auto overflow-y-hidden pb-6 focus:outline-none"
          style={{
            scrollSnapType: 'x mandatory',
            scrollBehavior: 'smooth',
            scrollPaddingLeft: '0',
            // Spacer at the start so the leftmost card breathes a bit
            // from the section padding edge.
            paddingLeft: '2px',
            paddingRight: '2px',
          }}
        >
          {DESTINATIONS.map((destination) => (
            <div
              key={destination.slug}
              className="snap-start"
              style={{ scrollSnapAlign: 'start' }}
            >
              <DestinationCard
                destination={destination}
                onSelect={handleDestinationSelect}
              />
            </div>
          ))}

          {/* Inline "Fly anywhere" affordance — the safety net for
              cities not featured in the curated set. Matches card
              dimensions so it sits visually as the row's tail. */}
          <form
            onSubmit={handleSearchSubmit}
            className="fly-anywhere snap-start flex-shrink-0 flex flex-col justify-between p-6 rounded-xl bg-transparent border border-on-surface/15 transition-all duration-300 hover:border-on-surface/30 focus-within:border-on-surface/50"
            style={{
              width: 'clamp(280px, 28vw, 480px)',
              aspectRatio: '16 / 9',
              scrollSnapAlign: 'start',
            }}
            aria-label="Fly to any place"
          >
            <div className="text-[10px] font-headline tracking-[0.32em] uppercase text-on-surface-variant/55 select-none">
              Plate · Open
            </div>
            <div>
              <h3 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-on-surface italic">
                Fly anywhere.
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant italic">
                Type a place. We&apos;ll find it.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder="A city, a street, an address…"
                  className="flex-1 bg-transparent border-b border-on-surface/30 focus:border-on-surface/70 outline-none py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/55 transition-colors"
                  aria-label="Destination"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-sm font-headline tracking-wide text-on-surface hover:text-stake transition-colors"
                  aria-label="Fly"
                >
                  Fly →
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <style jsx global>{`
        /* Scrollbar styling — cream track, navy thumb at low opacity.
           Subtle enough that the carousel reads as quiet scroll, not as
           a heavy scrollbar dominating the visual hierarchy. */
        .plot-destination-scroller {
          scrollbar-width: thin;
          scrollbar-color: rgba(26, 31, 46, 0.25) transparent;
        }
        .plot-destination-scroller::-webkit-scrollbar {
          height: 8px;
        }
        .plot-destination-scroller::-webkit-scrollbar-track {
          background: transparent;
        }
        .plot-destination-scroller::-webkit-scrollbar-thumb {
          background: rgba(26, 31, 46, 0.18);
          border-radius: 4px;
        }
        .plot-destination-scroller::-webkit-scrollbar-thumb:hover {
          background: rgba(26, 31, 46, 0.32);
        }
      `}</style>

      {/* Arrival sequence — full-viewport overlay that takes over when
          a destination is picked. Holds the OAuth gate, the post-auth
          questionnaire, and the flight brief while the map route
          prefetches in the background, then navigates to /map.
          resumeAfterAuth: true when the visitor returned from the
          Google OAuth round-trip and we're picking up where we left off. */}
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
    </section>
  );
}
