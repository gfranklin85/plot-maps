'use client';

// ── WorkstationScreen ─────────────────────────────────────────────────
//
// THE alive screen. The desk's map-screen IS the autocomplete: as you type
// where you want to fly, the suggestions render ON the screen, and the
// screen's BACKDROP blooms for the focused place (a per-place image / big
// city word). You're not picking from a dropdown — you're AIMING the
// screen at a destination, previewing where you're about to fly.
// See memory/project_dashboard_room_screen_alive.
//
// Selecting a place flies into /map at that location.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { PlotButton } from '@/components/plot/PlotControls';
import { LANDING_DESTINATIONS } from '@/lib/destinations';
import { useAuth } from '@/lib/auth-context';
import { useProfile } from '@/lib/profile-context';

interface Sugg {
  placeId: string;
  main: string;
  secondary: string;
}

// Per-place backdrops: reuse the destination catalog's hand-shot images
// where a typed query matches a known city; otherwise the screen shows a
// styled big-word treatment of the focused suggestion.
const PLACE_IMAGES: { match: RegExp; src: string; label: string }[] =
  LANDING_DESTINATIONS.filter((d) => d.imageSrc).map((d) => ({
    match: new RegExp(d.name.split(',')[0], 'i'),
    src: d.imageSrc as string,
    label: d.name,
  }));

function backdropFor(text: string): { src?: string; label: string } {
  const hit = PLACE_IMAGES.find((p) => p.match.test(text));
  if (hit) return { src: hit.src, label: hit.label };
  return { label: text };
}

export default function WorkstationScreen({
  variant = 'hero',
}: {
  /** 'hero' = centered standalone block; 'wall' = fills the room's screen
   *  rect (the search overlays at the screen's bottom edge). */
  variant?: 'hero' | 'wall';
}) {
  const wall = variant === 'wall';
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Sugg[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);
  const [googleReady, setGoogleReady] = useState(false);
  const acRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const psRef = useRef<google.maps.places.PlacesService | null>(null);

  // load Google places
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google?.maps?.places) { setGoogleReady(true); return; }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (!existing) {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      s.async = true;
      s.onload = () => setGoogleReady(true);
      document.head.appendChild(s);
    } else {
      const t = setInterval(() => {
        if (window.google?.maps?.places) { setGoogleReady(true); clearInterval(t); }
      }, 300);
      return () => clearInterval(t);
    }
  }, []);

  useEffect(() => {
    if (!googleReady) return;
    acRef.current = new google.maps.places.AutocompleteService();
    psRef.current = new google.maps.places.PlacesService(document.createElement('div'));
  }, [googleReady]);

  // fetch suggestions (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !acRef.current) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      acRef.current!.getPlacePredictions(
        { input: q, types: ['geocode'], componentRestrictions: { country: 'us' } },
        (preds) => {
          setSuggestions(
            (preds || []).slice(0, 5).map((p) => ({
              placeId: p.place_id,
              main: p.structured_formatting?.main_text || p.description,
              secondary: p.structured_formatting?.secondary_text || '',
            })),
          );
          setFocusIdx(0);
        },
      );
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  // what the screen currently displays as its backdrop: the focused
  // suggestion's place, or the raw query, or the idle map.
  const focused = suggestions[focusIdx];
  const screenText = focused ? `${focused.main}` : query.trim();
  const backdrop = useMemo(() => backdropFor(screenText), [screenText]);
  const idle = !query.trim();

  function fly(s: Sugg) {
    if (!psRef.current) return;
    psRef.current.getDetails(
      { placeId: s.placeId, fields: ['geometry', 'formatted_address'] },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK) return;
        const loc = place?.geometry?.location;
        if (!loc) return;
        const params = new URLSearchParams({
          lat: String(loc.lat()),
          lng: String(loc.lng()),
          zoom: '17',
          prospect: '1',
          address: place?.formatted_address || s.main,
        });
        router.push(`/map?${params.toString()}`);
      },
    );
  }

  function onKey(e: React.KeyboardEvent) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((i) => (i + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((i) => (i - 1 + suggestions.length) % suggestions.length); }
    else if (e.key === 'Enter') { e.preventDefault(); fly(suggestions[focusIdx]); }
  }

  return (
    <div className={wall ? 'w-full h-full flex flex-col' : 'w-full max-w-2xl mx-auto flex flex-col items-center'}>
      {/* THE SCREEN */}
      <div className={wall ? 'relative w-full flex-1' : 'relative w-full'}>
        {/* cast glow below the screen (hero mode only) */}
        {!wall && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-8 w-[88%] h-16 rounded-[50%] pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center, rgba(138,108,69,0.42), transparent 70%)', filter: 'blur(10px)' }}
          />
        )}
        <div
          className={`relative overflow-hidden ${wall ? 'w-full h-full rounded-[4px]' : 'rounded-2xl'}`}
          style={{
            aspectRatio: wall ? undefined : '16 / 8',
            background: 'var(--scr-bg-bot)',
            // Restrained: a quiet neutral border + soft self-light, not a glow.
            border: '1px solid color-mix(in srgb, var(--scr-glow) 14%, transparent)',
            boxShadow: wall
              ? '0 0 50px -16px color-mix(in srgb, var(--scr-glow) 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 30px 70px -20px rgba(0,0,0,0.85), 0 0 50px -18px color-mix(in srgb, var(--scr-glow) 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
          {/* Backdrop. In the MENU (idle) state the screen is a CLEAN cool
              self-lit display surface so the buttons read crisply — no busy
              map behind them. The map/place image only appears when the user
              is searching/aiming at a destination. */}
          {idle ? (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 50% -10%, rgba(255,255,255,0.035), transparent 55%), linear-gradient(180deg, var(--scr-bg-top), var(--scr-bg-bot))',
              }}
            />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={backdrop.src || '/card-map.png'}
                alt=""
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
                style={{ opacity: backdrop.src ? 0.9 : 0.55 }}
                key={backdrop.src || 'idle'}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(10,11,15,0.2) 30%, rgba(10,11,15,0.92))' }} />
            </>
          )}

          {/* IDLE state — the screen is the CONTROL PANEL. All navigation
              lives here (no app chrome on the room). Menu items as clear,
              interactive rows so nothing camouflages. */}
          {idle && wall && (
            <ScreenMenu onFly={(view) => router.push(`/map?view=${view}`)} />
          )}
          {idle && !wall && (
            <>
              <div className="absolute left-5 top-4 text-[10px] uppercase tracking-[0.3em]" style={{ color: 'var(--plot-cyan)' }}>
                Your market · paused
              </div>
              <div className="absolute left-5 bottom-4 flex items-center gap-3">
                <PlotButton variant="primary" size="sm" icon={<MaterialIcon icon="explore" className="text-[16px]" />} onClick={() => router.push('/map')}>
                  Open the map
                </PlotButton>
                <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--plot-text-2)' }}>Fly your market</span>
              </div>
            </>
          )}

          {/* TYPING state — big place word + on-screen suggestions */}
          {!idle && (
            <>
              {/* big city word blooming on the screen */}
              <div className="absolute inset-0 flex items-center justify-center px-8 pointer-events-none">
                <div
                  className="font-headline font-extrabold text-center leading-none"
                  style={{
                    fontSize: 'clamp(28px, 7vw, 72px)',
                    color: 'rgba(255,255,255,0.92)',
                    textShadow: '0 4px 40px rgba(0,242,255,0.35)',
                  }}
                >
                  {screenText}
                </div>
              </div>

              {/* on-screen suggestion list */}
              <div className="absolute left-0 right-0 bottom-0 p-3 space-y-1">
                {suggestions.map((s, i) => (
                  <button
                    key={s.placeId}
                    onMouseEnter={() => setFocusIdx(i)}
                    onClick={() => fly(s)}
                    className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    style={{
                      background: i === focusIdx ? 'rgba(0,242,255,0.16)' : 'rgba(7,11,20,0.55)',
                      border: `1px solid ${i === focusIdx ? 'rgba(0,242,255,0.45)' : 'rgba(125,168,255,0.14)'}`,
                    }}
                  >
                    <MaterialIcon icon="location_on" className="text-[16px]" />
                    <span className="text-sm font-semibold text-white truncate">{s.main}</span>
                    <span className="text-[11px] truncate" style={{ color: 'var(--plot-text-2)' }}>{s.secondary}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* THE SEARCH — the HERO invitation. It drives the screen above it,
          so it earns the most interest: a lit amber field that glows and
          pulses gently, unmistakably "do this." */}
      <div className={wall ? 'w-full mt-2.5' : 'w-full mt-9'}>
        <div
          className={`fly-search relative ${wall ? 'rounded-lg' : 'rounded-2xl'}`}
          style={{
            background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
            border: '1px solid rgba(244,246,248,0.28)',
          }}
        >
          <span className={`absolute top-1/2 -translate-y-1/2 ${wall ? 'left-3.5' : 'left-5'}`} style={{ color: 'var(--scr-text)' }}>
            <MaterialIcon icon="travel_explore" filled className={wall ? 'text-[clamp(14px,1.7vw,20px)]' : 'text-[24px]'} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Where do you want to fly?"
            className={`w-full bg-transparent font-semibold focus:outline-none placeholder:opacity-70 ${
              wall
                ? 'pl-11 pr-3 py-2.5 text-[clamp(12px,1.5vw,18px)]'
                : 'pl-14 pr-5 py-4 md:py-5 text-base md:text-lg'
            }`}
            style={{ color: 'var(--scr-text)' }}
          />
          {/* gentle "fly" hint on the right */}
          <span
            className={`absolute top-1/2 -translate-y-1/2 right-3.5 uppercase tracking-[0.2em] font-bold pointer-events-none ${query ? 'opacity-0' : 'opacity-100'} transition-opacity`}
            style={{ color: 'var(--scr-accent)', fontSize: 'clamp(8px,0.95vw,11px)' }}
          >
            ↵ Fly
          </span>
        </div>
      </div>
    </div>
  );
}

// ── ScreenMenu — the OFFICE app launcher, ON the screen ───────────────
// The room is the brokerage OFFICE; this screen is how you choose what to
// work on and ENTER it (select an app → you go INTO that screen, which
// becomes the app's full surface). PlotMaps (the map) is the flagship;
// the contract drafter (Form Builder) and the rest live here too. Not a
// nav bar — an app launcher inside your office.
// See memory/project_room_is_a_platform.md.

interface OfficeApp {
  href: string;
  icon: string;
  title: string;
  sub: string;
  flagship?: boolean;
}

const OFFICE_APPS: OfficeApp[] = [
  { href: '/map?view=3d', icon: 'flight', title: 'Fly the market', sub: '3D flight · prospect from the air', flagship: true },
  { href: '/map?view=2d', icon: 'map', title: '2D work map', sub: 'Heads-down prospecting grid' },
  { href: '/forms', icon: 'history_edu', title: 'Draft a contract', sub: 'Offers & disclosures, in plain English' },
  { href: '/leads', icon: 'contacts_product', title: 'Work your leads', sub: 'Lists, owners, follow-ups' },
  { href: '/imports', icon: 'database_upload', title: 'Bring in inventory', sub: 'CSV, MLS, contacts' },
];

function ScreenMenu({ onFly }: { onFly: (view: '2d' | '3d') => void }) {
  const { signOut } = useAuth();
  const prof = useProfile();
  return (
    <div className="absolute inset-0 flex flex-col p-[4%]">
      <div className="flex items-baseline justify-between">
        <div className="font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--scr-accent)', fontSize: 'clamp(8px,1vw,11px)' }}>
          Your office
        </div>
        <div className="uppercase tracking-[0.2em]" style={{ color: 'var(--scr-text-2)', fontSize: 'clamp(7px,0.9vw,10px)' }}>
          Choose what to work on
        </div>
      </div>

      {/* the apps you ENTER — each a distinct, lit card that POPS off the
          screen surface and clearly reacts on hover. */}
      <div className="mt-[3.5%] grid grid-cols-2 gap-[2.5%] flex-1 content-start">
        {OFFICE_APPS.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            onClick={app.href.startsWith('/map') ? (e) => { e.preventDefault(); onFly(app.href.includes('2d') ? '2d' : '3d'); } : undefined}
            className="office-card group flex items-center gap-[4%] p-[3.5%] rounded-xl transition-all duration-200"
            data-flagship={app.flagship ? '1' : undefined}
          >
            <span
              className="office-card__icon shrink-0 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ width: 'clamp(30px,3.4vw,46px)', height: 'clamp(30px,3.4vw,46px)' }}
            >
              <MaterialIcon icon={app.icon} filled className="text-[clamp(16px,2vw,26px)]" />
            </span>
            <div className="min-w-0">
              <div className="font-extrabold truncate" style={{ color: 'var(--scr-text)', fontSize: 'clamp(12px,1.35vw,17px)' }}>{app.title}</div>
              <div className="truncate" style={{ color: 'var(--scr-text-2)', fontSize: 'clamp(8.5px,1.02vw,12.5px)' }}>{app.sub}</div>
            </div>
            <MaterialIcon icon="chevron_right" className="office-card__arrow ml-auto text-[clamp(14px,1.6vw,20px)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>

      {/* footer: profile + sign out */}
      <div className="mt-auto flex items-center justify-between pt-[3%]" style={{ borderTop: '1px solid color-mix(in srgb, var(--scr-glow) 18%, transparent)' }}>
        <Link href="/settings" className="flex items-center gap-2">
          <span className="rounded-full flex items-center justify-center font-bold" style={{ width: 'clamp(18px,2vw,26px)', height: 'clamp(18px,2vw,26px)', background: 'var(--scr-accent)', color: '#042030', fontSize: 'clamp(8px,0.9vw,11px)' }}>
            {prof.initials}
          </span>
          <span className="font-semibold truncate" style={{ color: 'var(--scr-text)', fontSize: 'clamp(10px,1.1vw,13px)', maxWidth: '60%' }}>
            {prof.profile?.fullName || prof.profile?.email || 'Profile'}
          </span>
        </Link>
        <button
          onClick={() => signOut?.()}
          className="flex items-center gap-1.5 font-semibold transition-colors"
          style={{ color: 'var(--plot-sold)', fontSize: 'clamp(10px,1.1vw,13px)' }}
        >
          <MaterialIcon icon="logout" className="text-[clamp(12px,1.4vw,16px)]" />
          Sign out
        </button>
      </div>
    </div>
  );
}
