'use client';

// LandingHome — Plot Maps' search-first public landing.
//
// Locked 2026-05-29. See:
//   memory/project_landing_search_first_no_gate.md
//   memory/project_plot_maps_position_hierarchy.md
//
// The front door is the experience, not the pitch:
//   - Cinematic search bar: "Where do you want to fly?"
//   - Horizontally scrolling destination cards underneath
//   - Below-the-fold: audience routes (buyers / homeowners / agents / investors)
//   - Footer: Position compliance + brand layers
//
// Launch rule: NO gate, NO signup, NO claim wall. Participation prompts
// fire AFTER engagement, not at the door. The product earns the right
// to ask (per project-participation-based-monetization-thesis).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import {
  LANDING_DESTINATIONS,
  type Destination,
} from '@/lib/destinations';

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  primaryType: string | null;
}

export default function LandingHome() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  // ── Autocomplete state ───────────────────────────────────────
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState<number>(-1);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const fetchSeqRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch suggestions on query change (debounced) ────────────
  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    if (q.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    setSuggestLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      const seq = ++fetchSeqRef.current;
      try {
        const res = await fetch(`/api/public/places-autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        // Drop stale responses if the user kept typing past this fetch
        if (seq !== fetchSeqRef.current) return;
        const list: Suggestion[] = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
        setHighlightIdx(list.length > 0 ? 0 : -1);
      } catch {
        if (seq === fetchSeqRef.current) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (seq === fetchSeqRef.current) setSuggestLoading(false);
      }
    }, 180);
    return () => {
      if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  // ── Close dropdown on outside click ──────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // ── Pick a suggestion (or submit raw text) ───────────────────
  // - Suggestion picked → resolve place_id to lat/lng via place-details
  // - Raw text → fall back to /api/public/geocode (current behavior)
  const pickSuggestion = useCallback(
    async (s: Suggestion) => {
      setShowSuggestions(false);
      setSearching(true);
      setSearchError(null);
      // Cosmetic: show the chosen text in the input while the details fetch flies
      setQuery(`${s.mainText}${s.secondaryText ? ', ' + s.secondaryText : ''}`);
      try {
        const res = await fetch(
          `/api/public/place-details?placeId=${encodeURIComponent(s.placeId)}`
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.hit) {
          // Fall back to the typed text — let the map page surface the miss prompt
          router.push(`/map?q=${encodeURIComponent(s.mainText)}&miss=1`);
          return;
        }
        const params = new URLSearchParams({
          q: data.formatted || s.mainText,
          lat: String(data.lat),
          lng: String(data.lng),
        });
        router.push(`/map?${params.toString()}`);
      } catch {
        setSearchError('Search is unavailable right now. Try a destination card below.');
        setSearching(false);
      }
    },
    [router]
  );

  const submitSearch = useCallback(async () => {
    // If the dropdown has a highlighted suggestion, prefer it
    if (showSuggestions && highlightIdx >= 0 && suggestions[highlightIdx]) {
      pickSuggestion(suggestions[highlightIdx]);
      return;
    }
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/public/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.hit) {
        router.push(`/map?q=${encodeURIComponent(q)}&miss=1`);
        return;
      }
      const params = new URLSearchParams({
        q,
        lat: String(data.lat),
        lng: String(data.lng),
      });
      router.push(`/map?${params.toString()}`);
    } catch {
      setSearchError('Search is unavailable right now. Try a destination card below.');
      setSearching(false);
    }
  }, [query, router, showSuggestions, highlightIdx, suggestions, pickSuggestion]);

  // ── Keyboard nav for the dropdown ────────────────────────────
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [showSuggestions, suggestions]
  );

  const scrollStrip = useCallback((delta: number) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-30 px-6 md:px-10 pt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PlotMapsLogo color="#F5EDD8" className="h-7 w-auto" />
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm text-zinc-300">
          <Link href="/map" className="hover:text-white transition-colors">Enter Map</Link>
          <Link href="/position" className="hover:text-white transition-colors">Position Realty</Link>
          <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
        </nav>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 pt-28 pb-12 overflow-hidden">

        {/* Atmospheric backdrop — radial pools, no photo. The page
            should feel like sky and field, not stock imagery. */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,214,107,0.10),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_85%,rgba(120,90,40,0.20),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_75%,rgba(60,80,120,0.18),transparent_55%)]" />
        </div>

        <div className="w-full max-w-3xl text-center space-y-6">
          <h1 className="font-headline text-4xl md:text-6xl font-light tracking-tight text-zinc-50 leading-[1.05]">
            Where do you want to fly?
          </h1>
          <p className="text-base md:text-lg text-zinc-300 max-w-xl mx-auto leading-relaxed">
            Plot Maps is a spatial real-estate platform. Search any city,
            address, neighborhood, or place. Then fly the world.
          </p>

          {/* Search bar — the main CTA */}
          <form
            onSubmit={(e) => { e.preventDefault(); submitSearch(); }}
            className="relative max-w-2xl mx-auto"
          >
            <div ref={wrapperRef} className="relative">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-300/70 z-10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                inputMode="search"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Search any city, address, neighborhood, or place..."
                className="relative w-full rounded-full bg-zinc-900/85 backdrop-blur border border-amber-300/30 pl-14 pr-32 py-4 text-base md:text-lg text-zinc-50 placeholder:text-zinc-500 outline-none focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20 shadow-[0_0_40px_-12px_rgba(255,214,107,0.45)] transition-all"
                aria-autocomplete="list"
                aria-controls="plot-landing-suggestions"
                aria-expanded={showSuggestions}
                role="combobox"
              />
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-amber-300 text-zinc-950 px-5 py-2 text-sm font-semibold tracking-wide hover:bg-amber-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors z-10"
              >
                {searching ? 'Searching…' : 'Fly There'}
              </button>

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <ul
                  id="plot-landing-suggestions"
                  role="listbox"
                  className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-zinc-950/95 backdrop-blur border border-amber-300/30 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.8)] overflow-hidden z-20 text-left"
                >
                  {suggestions.map((s, i) => (
                    <li
                      key={s.placeId}
                      role="option"
                      aria-selected={i === highlightIdx}
                      onMouseEnter={() => setHighlightIdx(i)}
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                      className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                        i === highlightIdx
                          ? 'bg-amber-300/15 text-amber-100'
                          : 'text-zinc-200 hover:bg-amber-300/10'
                      }`}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-amber-300/70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                      >
                        <path d="M12 21s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{s.mainText}</div>
                        {s.secondaryText && (
                          <div className="text-xs text-zinc-400 truncate">{s.secondaryText}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Loading shimmer beneath the bar — tiny, low-friction */}
              {suggestLoading && !showSuggestions && query.trim().length >= 2 && (
                <div className="absolute left-0 right-0 -bottom-6 text-center text-[10px] uppercase tracking-[0.32em] text-amber-300/50">
                  Searching…
                </div>
              )}
            </div>
            {searchError && (
              <p className="mt-3 text-xs text-rose-300">{searchError}</p>
            )}
          </form>

          <div className="pt-2 text-xs text-zinc-400 uppercase tracking-[0.32em]">
            No account required
          </div>
        </div>

        {/* ── DESTINATION STRIP ──────────────────────────────── */}
        <div className="w-full max-w-7xl mt-16">
          <div className="flex items-end justify-between px-6 md:px-2 mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">
                Popular flights
              </div>
              <div className="mt-1 text-zinc-400 text-sm">
                Start somewhere recognizable, then fly anywhere from there.
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <StripArrow direction="left" onClick={() => scrollStrip(-560)} />
              <StripArrow direction="right" onClick={() => scrollStrip(560)} />
            </div>
          </div>

          <div
            ref={stripRef}
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 px-6 md:px-2 scroll-smooth scrollbar-thin"
            style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
          >
            {LANDING_DESTINATIONS.map((d) => (
              <DestinationCard key={d.slug} destination={d} />
            ))}
          </div>
        </div>
      </section>

      {/* ── AUDIENCE ROUTES ─────────────────────────────────── */}
      <section className="bg-zinc-925/30 border-t border-zinc-900 px-6 md:px-10 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs uppercase tracking-[0.32em] text-amber-300/70">Who Plot Maps is for</div>
            <h2 className="mt-3 text-3xl md:text-4xl font-light text-zinc-50 tracking-tight">
              A platform with many doors.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <AudienceCard
              title="Home buyers"
              body="Search homes spatially. Fly your future neighborhood at sunset before you commit."
              cta="Enter the map"
              href="/map"
            />
            <AudienceCard
              title="Homeowners"
              body="See what's happening around your property — listings, market activity, nearby movement."
              cta="Explore my area"
              href="/map"
            />
            <AudienceCard
              title="Agents"
              body="Operate with better tools, cleaner data, and direct demand flow. Position Realty is preparing a selective expansion."
              cta="About Position"
              href="/position"
            />
            <AudienceCard
              title="Investors"
              body="Study places, parcels, and opportunity in 3D. Layered enrichment data — owner, parcel, listing — on demand."
              cta="Open the map"
              href="/map"
            />
          </div>
        </div>
      </section>

      {/* ── POSITION TRUST BAND ─────────────────────────────── */}
      <section className="border-t border-zinc-900 px-6 md:px-10 py-16 bg-zinc-950">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="text-xs uppercase tracking-[0.32em] text-amber-300/70">
            Operated by Position Realty
          </div>
          <h3 className="text-2xl md:text-3xl font-light tracking-tight text-zinc-50">
            A California brokerage built around better tools and clearer data.
          </h3>
          <p className="text-zinc-400 leading-relaxed max-w-2xl mx-auto">
            Position Realty is the licensed brokerage operating inside
            Plot Maps. When you find a property and want help, you reach
            a real California-licensed broker, not a faceless inquiry form.
          </p>
          <div className="pt-2 flex items-center justify-center gap-4">
            <Link
              href="/position"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/45 text-amber-200 px-5 py-2.5 text-sm font-medium hover:bg-amber-300/10 transition-colors"
            >
              About Position
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full text-zinc-300 px-5 py-2.5 text-sm font-medium hover:text-zinc-100 transition-colors"
            >
              Contact Greg →
            </Link>
          </div>
        </div>
      </section>

      <PositionFooter />
    </div>
  );
}

// ── DestinationCard ─────────────────────────────────────────────
// Clicking a card flies the map to the destination's hand-tuned pose.
// The map page already accepts ?destination=<slug> and resolves it
// via findDestinationBySlug().
function DestinationCard({ destination }: { destination: Destination }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/map?destination=${destination.slug}`)}
      className="snap-start shrink-0 group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-300/50 transition-all w-[260px] h-[320px] text-left focus:outline-none focus:ring-2 focus:ring-amber-300/40"
      aria-label={`Fly to ${destination.name}`}
    >
      {destination.imageSrc ? (
        <Image
          src={destination.imageSrc}
          alt=""
          fill
          sizes="260px"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        // Typographic placeholder for destinations without a screenshot
        // yet (London, Paris, LA, SF, Dubai). Reads as "intentional"
        // not "broken" — see destinations.ts note about pending shots.
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex items-center justify-center">
          <div className="font-headline text-2xl text-zinc-600 tracking-tight">{destination.name}</div>
        </div>
      )}

      {/* gradient scrim for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent pointer-events-none" />

      {/* label block */}
      <div className="absolute left-0 right-0 bottom-0 p-5">
        <div className="text-[10px] uppercase tracking-[0.28em] text-amber-300/85">
          {destination.region}
        </div>
        <div className="mt-1 text-2xl font-light tracking-tight text-zinc-50">
          {destination.name}
        </div>
        {destination.tagline && (
          <div className="mt-1 text-xs text-zinc-300/85 italic line-clamp-2">
            {destination.tagline}
          </div>
        )}
      </div>

      {/* surveyor's corner accent (the only vintage callback) */}
      <span className="absolute top-3 left-3 h-3 w-3 border-t border-l border-amber-300/60 pointer-events-none" />
      <span className="absolute top-3 right-3 h-3 w-3 border-t border-r border-amber-300/60 pointer-events-none" />
    </button>
  );
}

function StripArrow({
  direction,
  onClick,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 w-9 rounded-full bg-zinc-900/80 backdrop-blur border border-zinc-700 hover:border-amber-300/60 hover:bg-zinc-800 transition-colors flex items-center justify-center text-zinc-300 hover:text-amber-200"
      aria-label={`Scroll ${direction}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
        {direction === 'left'
          ? <polyline points="15 18 9 12 15 6" />
          : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  );
}

function AudienceCard({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-300/40 p-6 transition-all"
    >
      <div className="text-sm font-semibold text-amber-200 mb-2 tracking-tight">{title}</div>
      <p className="text-sm text-zinc-400 leading-relaxed mb-4">{body}</p>
      <div className="text-xs text-zinc-300 group-hover:text-amber-200 transition-colors">
        {cta} →
      </div>
    </Link>
  );
}
