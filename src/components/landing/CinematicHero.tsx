'use client';

// ── CinematicHero — the front page as a movie ─────────────────────────
//
// Greg's locked mockup (2026-07-15, "bro, we need this"): the ENTIRE hero is
// a full-bleed space/Earth VIDEO, and the UI floats over it like a film's
// title sequence. PlotMaps huge + a wonder marquee + "where do you want to
// go?" search + two CTAs (Start flying / Post your move), nav on top, three
// cards below. The Earth video is ambient (not interactive — Greg: "we don't
// need to touch or spin it"); selection flies the REAL map. memory:
// the front-door breakthrough (flyable Earth of wonders), the_thesis
// (SaaS with consumer flare — the craft is the moat), feedback_brand_fidelity.
//
// The Earth sits in the lower frame (dark space up top) so the wordmark +
// marquee sit in the quiet zone and never fight the video (that composition
// is baked into the Veo prompt).

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useAuth } from '@/lib/auth-context';
import { signInWithGoogle } from '@/lib/signIn';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotPadModal from '@/components/landing/PlotPadModal';
import { usePlotPadStatus } from '@/lib/usePlotPadStatus';
import { DESTINATIONS } from '@/lib/destinations';

// INTERLEAVE wonders + cities so the marquee wows with variety immediately
// (Greg: mix ruins/ancient sites/landmarks WITH cities, wonder-weighted).
// We have more wonders than cities → a wonder leads, then alternate; leftover
// wonders trail. Result: ancient-sites feel dominates but cities are sprinkled.
const MARQUEE = (() => {
  const wonders = DESTINATIONS.filter((d) => d.category === 'wonder');
  const cities = DESTINATIONS.filter((d) => d.category !== 'wonder');
  const out: typeof DESTINATIONS = [];
  const n = Math.max(wonders.length, cities.length);
  for (let i = 0; i < n; i++) {
    if (wonders[i]) out.push(wonders[i]);
    if (cities[i]) out.push(cities[i]);
  }
  return out.map((d) => ({ slug: d.slug, name: d.name, region: d.region }));
})();

// The Google Places loader is per-surface (no app-level provider). The hero
// wraps its Places-powered search in an APIProvider so "Where do you want to
// go?" can fly ANYWHERE on Earth, not just our curated catalog.
export default function CinematicHero() {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
      <CinematicHeroInner />
    </APIProvider>
  );
}

// A global-place suggestion from Google Places (anything on Earth).
interface PlaceHit { placeId: string; label: string; }

function CinematicHeroInner() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const { status: padStatus } = usePlotPadStatus();
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  // The search bar is a DUAL door — explore a place OR list yours. The
  // placeholder alternates to signal both (pauses once the user types).
  const PLACEHOLDERS = ['Where do you want to go?', 'List your property…'];
  const [phIdx, setPhIdx] = useState(0);
  useEffect(() => {
    if (q.length > 0) return; // don't cycle while they're typing
    const t = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(t);
  }, [q.length, PLACEHOLDERS.length]);
  const autoRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const detailsRef = useRef<google.maps.places.PlacesService | null>(null);

  // Build the Places services once the ambient loader (APIProvider) has
  // populated window.google.maps.places. Poll briefly like ProspectSearch does
  // — the library can arrive a beat after the provider mounts.
  useEffect(() => {
    let cancelled = false;
    const build = () => {
      if (cancelled) return true;
      const p = window.google?.maps?.places;
      if (!p?.AutocompleteService) return false;
      autoRef.current = new p.AutocompleteService();
      detailsRef.current = new p.PlacesService(document.createElement('div'));
      return true;
    };
    if (build()) return;
    const id = window.setInterval(() => { if (build()) window.clearInterval(id); }, 250);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  const fly = (slug: string) => {
    const path = `/map?destination=${slug}&view=3d`;
    if (user) router.push(path); else signInWithGoogle(path);
  };
  const flyCoords = (lat: number, lng: number, address: string) => {
    const p = new URLSearchParams({ lat: String(lat), lng: String(lng), view: '3d', address });
    const path = `/map?${p.toString()}`;
    if (user) router.push(path); else signInWithGoogle(path);
  };
  const goPost = () => {
    if (user) router.push('/post'); else signInWithGoogle('/post');
  };
  const goListing = () => {
    if (user) router.push('/listings/new'); else signInWithGoogle('/listings/new');
  };
  // Buyer doors (browse homes is public — no auth wall to look).
  const goHomes = () => router.push('/listings');
  const goTeam = () => {
    if (user) router.push('/bullpen'); else signInWithGoogle('/bullpen');
  };

  // Curated catalog matches FIRST (fast, branded), then global Places.
  const searchMatches = q.trim().length > 0
    ? DESTINATIONS.filter((d) =>
        d.name.toLowerCase().includes(q.toLowerCase()) || d.region.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 5)
    : [];

  // Global Places fallthrough — NO country restriction (fly ANYWHERE: Petra,
  // Reykjavik, an address). Debounced; only fires once the service is built.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 3 || !autoRef.current) { setPlaces([]); return; }
    const t = setTimeout(() => {
      autoRef.current!.getPlacePredictions({ input: query }, (preds) => {
        setPlaces((preds || []).slice(0, 5).map((p) => ({ placeId: p.place_id, label: p.description })));
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  // Resolve a Places prediction → lat/lng, then fly there.
  const flyPlace = (hit: PlaceHit) => {
    const svc = detailsRef.current;
    if (!svc) return;
    svc.getDetails({ placeId: hit.placeId, fields: ['geometry', 'name', 'formatted_address'] }, (res) => {
      const loc = res?.geometry?.location;
      if (!loc) return;
      flyCoords(loc.lat(), loc.lng(), res?.formatted_address || res?.name || hit.label);
    });
  };

  // Drop catalog names we already show so the two lists don't duplicate.
  const catalogNames = new Set(searchMatches.map((d) => d.name.toLowerCase()));
  const placeHits = places.filter((p) => !catalogNames.has(p.label.split(',')[0].trim().toLowerCase()));
  const hasResults = searchMatches.length > 0 || placeHits.length > 0;

  return (
    <div className="chero">
      {/* ── the film: full-bleed Earth-in-space video ── */}
      <video
        className="chero__video"
        autoPlay muted loop playsInline
        poster="/hero/earth-space-poster.jpg"
      >
        <source src="/hero/earth-space.mp4" type="video/mp4" />
      </video>
      {/* scrims: darken top (for the wordmark) + bottom (blends into the page) */}
      <div className="chero__scrim" />

      {/* ── nav ── */}
      <header className="chero__nav">
        <button className="chero__hamburger" onClick={() => setMenuOpen(true)} aria-label="Menu">
          <MaterialIcon icon="menu" className="text-[26px]" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" className="chero__navlogo" />
        <nav className="chero__navlinks">
          <a href="/#explore">Explore</a>
          <a href="/#move">Move</a>
          <a href="/listings">Real Estate</a>
          <a href="/#about">About</a>
        </nav>
        <div className="chero__navright">
          <button className="chero__signin" onClick={() => (user ? router.push('/home') : signInWithGoogle('/home'))}>
            {user ? 'Home' : 'Sign in'}
          </button>
          <a href="/position" className="chero__join"><MaterialIcon icon="person" className="text-[16px]" /> Join Position</a>
        </div>
      </header>

      {/* ── mobile drawer (hamburger) ── */}
      {menuOpen && (
        <div className="chero__drawer" onClick={() => setMenuOpen(false)}>
          <div className="chero__drawer-panel" onClick={(e) => e.stopPropagation()}>
            <button className="chero__drawer-x" onClick={() => setMenuOpen(false)} aria-label="Close"><MaterialIcon icon="close" className="text-[24px]" /></button>
            <a href="/#explore" onClick={() => setMenuOpen(false)}>Explore</a>
            <a href="/#move" onClick={() => setMenuOpen(false)}>Move</a>
            <a href="/listings" onClick={() => setMenuOpen(false)}>Real Estate</a>
            <a href="/#about" onClick={() => setMenuOpen(false)}>About</a>
            <a href="/position" onClick={() => setMenuOpen(false)} className="chero__drawer-join"><MaterialIcon icon="person" className="text-[18px]" /> Join Position</a>
            <button className="chero__drawer-signin" onClick={() => (user ? router.push('/home') : signInWithGoogle('/home'))}>{user ? 'Home' : 'Sign in'}</button>
          </div>
        </div>
      )}

      {/* ── the title sequence: brand + marquee + search + CTAs ── */}
      <div className="chero__stage">
        <div className="chero__brand">
          {/* plotmaps-logo.svg has a TIGHT viewBox (crops to the wordmark);
              plotmaps-wordmark.svg is a full 3840x2160 artboard that blows up
              when sized — do not use it inline. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" className="chero__wordmark" />
          {/* the REAL Position wordmark (Position Black.svg, tight 1920x1080
              viewBox) — dotless i's are the identifying mark. fill is #000 so
              invert(1) makes it white on the dark hero. NOT typed text. */}
          <span className="chero__by">
            <span className="chero__by-label">by</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/position-wordmark.svg" alt="Position Realty" className="chero__by-mark" />
          </span>
        </div>

        {/* wonder marquee */}
        <div className="chero__marquee">
          <div className="chero__marquee-track">
            {[...MARQUEE, ...MARQUEE].map((p, i) => (
              <button key={`${p.slug}-${i}`} className="chero__chip" onClick={() => fly(p.slug)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/assets/destinations/${p.slug}.jpg`} alt="" className="chero__chip-img" loading="lazy" />
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* search */}
        <div className="chero__search">
          <MaterialIcon icon="search" className="text-[20px] chero__search-ic" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={PLACEHOLDERS[phIdx]}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              if (searchMatches[0]) fly(searchMatches[0].slug);
              else if (placeHits[0]) flyPlace(placeHits[0]);
            }}
          />
          <span className="chero__search-go"><MaterialIcon icon="explore" className="text-[18px]" /></span>
          {hasResults && (
            <div className="chero__search-menu">
              {searchMatches.map((m) => (
                <button key={m.slug} onClick={() => fly(m.slug)}>
                  <b>{m.name}</b><span>{m.region}</span>
                </button>
              ))}
              {placeHits.map((p) => (
                <button key={p.placeId} onClick={() => flyPlace(p)}>
                  <MaterialIcon icon="public" className="text-[15px] chero__search-globe" />
                  <b>{p.label}</b>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTAs — three doors. Start flying is the gamepad DEFAULT focus
            (data-gamepad-primary): pad in → highlight lands here (the white
            one), cycle right → Find a home → Post your move, A activates. */}
        <div className="chero__ctas">
          <button className="chero__cta chero__cta--primary" onClick={() => fly('lemoore')}
            data-gamepad-focusable data-gamepad-primary>
            <MaterialIcon icon="flight_takeoff" className="text-[18px]" /> Start flying
          </button>
          <button className="chero__cta chero__cta--ghost" onClick={goHomes} data-gamepad-focusable>
            <MaterialIcon icon="home" className="text-[18px]" /> Find a home
          </button>
          <button className="chero__cta chero__cta--ghost" onClick={goPost} data-gamepad-focusable>
            <MaterialIcon icon="deployed_code" className="text-[17px]" /> Post your move
          </button>
        </div>

        <p className="chero__tag">
          <MaterialIcon icon="public" className="text-[14px]" /> Fly anywhere. Find homes. Move freely.
        </p>

        {/* controller chip — plug in a gamepad and fly the map for real. Live
            status from usePlotPadStatus; click opens the Plot Pad download. */}
        <button
          type="button"
          className={`chero__pad chero__pad--${padStatus}`}
          onClick={() => setPadOpen(true)}
        >
          <MaterialIcon icon="stadia_controller" className="text-[18px]" />
          <span className="chero__pad-dot" aria-hidden />
          <span className="chero__pad-text">
            {padStatus === 'active'
              ? 'Plot Pad active — flight-ready'
              : padStatus === 'connected'
                ? 'Controller connected — get Plot Pad'
                : 'Plug in your controller — fly the map for real'}
          </span>
          <MaterialIcon icon="download" className="text-[15px] chero__pad-dl" />
        </button>

        {/* scroll cue — the fold is the hook; the doors + homes + team are the
            descent below. Signal there's more (no false floor). */}
        <a href="#doors" className="chero__more" aria-label="See what you can do">
          <span>What you can do here</span>
          <MaterialIcon icon="keyboard_arrow_down" className="text-[22px] chero__more-arrow" />
        </a>
      </div>

      {/* ══ THE DESCENT (memory/plotmaps_thesis fold doctrine): below the awe,
           each reservoir gets its moment — the doors, the buyer advantage, the
           free listing on-ramp, the weld. A sequence, not a museum. ══ */}
      <div id="doors" className="chero__descent">

      {/* ── FOUR DOORS — one for whoever arrives (explorer/buyer/buyer/owner).
           A two-sided marketplace: buyers are welcomed as loudly as sellers. ── */}
      <section className="chero__cards">
        {/* EXPLORER */}
        <HeroCard icon="public" title="Fly the world"
          body="Explore cities, coastlines, landmarks, and neighborhoods in stunning photoreal 3D."
          cta="Start flying" onClick={() => fly('lemoore')} />
        {/* BUYER — browse the homes */}
        <HeroCard icon="home" title="Find a home"
          body="Search listings by monthly payment, location, features, and real-time market context."
          cta="View homes" onClick={goHomes} />
        {/* BUYER — the buyer's platform (the pros come to YOU and introduce themselves) */}
        <HeroCard icon="groups" title="Build your buyer team"
          body="Lenders, inspectors, escrow, and local pros come to you and introduce themselves — numbers, terms, and how they work."
          cta="Build your team" onClick={goTeam} />
        {/* OWNER — the Interconnector */}
        <HeroCard icon="route" title="Post your move"
          body="Tell the map what would make a move work. Find direct connections and multi-step move paths."
          cta="Post your move" onClick={goPost} />
      </section>

      {/* ── BUYER ADVANTAGE band — the buyer reservoir the lead-selling portals
           structurally can't touch. We're a brokerage, so we give EVERY buyer
           real tools + a team that comes TO them (even if we're not your
           broker). "No lead fees" is the whole indirect shade — names no one,
           indicts the model everyone knows. Echoes the old /buyers copy. ── */}
      <section className="chero__buyerband">
        <div className="chero__buyerband-copy">
          <div className="chero__buyerband-eyebrow">The buyer&apos;s platform · free</div>
          <h2>The people you need, on your ground.</h2>
          <p>Say what you need once — and the right lenders and pros come to you to introduce themselves. Their estimate, their terms, and how they actually work — including how they protect you. You see each one as a whole, and you choose who fits.</p>
          <p className="chero__buyerband-agents"><MaterialIcon icon="badge" className="text-[16px]" /> Agents: a clean place for your buyer to meet the right professionals — you stay their guide.</p>
          <ul className="chero__buyerband-list">
            <li><MaterialIcon icon="check_circle" className="text-[17px]" /> Real numbers, terms, and fees — in the open, side by side.</li>
            <li><MaterialIcon icon="check_circle" className="text-[17px]" /> How each one operates — their process and the checks that protect you.</li>
            <li><MaterialIcon icon="check_circle" className="text-[17px]" /> Bring your own agent. You see the whole person, then choose.</li>
          </ul>
          <button className="chero__buyerband-cta" onClick={goTeam}>
            Build your team <MaterialIcon icon="arrow_forward" className="text-[16px]" />
          </button>
        </div>
        {/* the CONSTELLATION — the home-ground inversion, drawn: the buyer is
            the center; the professionals ORBIT and come inward to introduce
            themselves (arrows point AT the buyer). Ghost blueprint house behind
            = the goal you're building a team to reach. All CSS/SVG. Geometry:
            hub centered; 4 pros at the 4 corners, arrows drawn corner→center. */}
        <div className="chero__constel" aria-hidden>
          {/* inward arrows — from each corner card toward the hub center (280,230) */}
          <svg className="chero__constel-lines" viewBox="0 0 560 460" preserveAspectRatio="none">
            <defs>
              <marker id="chArrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto">
                <path d="M0,0 L6,3.5 L0,7 Z" fill="rgba(159,192,255,0.7)" />
              </marker>
            </defs>
            <g fill="none" stroke="rgba(159,192,255,0.32)" strokeWidth="1.4" strokeDasharray="4 5" markerEnd="url(#chArrow)">
              <path d="M120,70 C170,120 190,140 218,168" />
              <path d="M440,70 C390,120 370,140 342,168" />
              <path d="M120,390 C170,340 190,320 218,292" />
              <path d="M440,390 C390,340 370,320 342,292" />
            </g>
          </svg>

          {/* the professionals, at the four corners */}
          <div className="chero__pcard chero__pcard--tl">
            <span className="chero__pcard-ic"><MaterialIcon icon="account_balance" className="text-[18px]" /></span>
            <div><em>Lender · Maria</em><b>6.24%</b> <i>$2,140/mo</i><span className="chero__pchip"><MaterialIcon icon="verified" className="text-[12px]" /> Pre-qualified</span></div>
          </div>
          <div className="chero__pcard chero__pcard--tr">
            <span className="chero__pcard-ic"><MaterialIcon icon="shield" className="text-[18px]" /></span>
            <div><em>Insurance · Taylor</em><b>$85/mo</b> <i>homeowners</i><span className="chero__pchip"><MaterialIcon icon="verified" className="text-[12px]" /> Top rated</span></div>
          </div>
          <div className="chero__pcard chero__pcard--bl">
            <span className="chero__pcard-ic"><MaterialIcon icon="description" className="text-[18px]" /></span>
            <div><em>Escrow · Jamie</em><b>$900</b> <i>flat fee</i><span className="chero__pchip"><MaterialIcon icon="verified" className="text-[12px]" /> Transparent</span></div>
          </div>
          <div className="chero__pcard chero__pcard--br">
            <span className="chero__pcard-ic"><MaterialIcon icon="account_balance" className="text-[18px]" /></span>
            <div><em>Lender · David</em><b>6.11%</b> <i>$2,096/mo</i><span className="chero__pchip"><MaterialIcon icon="verified" className="text-[12px]" /> Pre-qualified</span></div>
          </div>

          {/* YOU — the center, on your ground */}
          <div className="chero__hub">
            <span className="chero__hub-badge">You</span>
            <b>You, the buyer</b>
            <i>In control. On your ground.</i>
            <ul>
              <li><MaterialIcon icon="check_circle" className="text-[14px]" /> Your goals</li>
              <li><MaterialIcon icon="check_circle" className="text-[14px]" /> Your terms</li>
              <li><MaterialIcon icon="check_circle" className="text-[14px]" /> Your protection</li>
            </ul>
          </div>
        </div>
      </section>

      {/* trust strip — uplifts everyone; lands the no-pressure/dignity promise */}
      <section className="chero__truststrip">
        <span><MaterialIcon icon="verified_user" className="text-[16px]" /> Professionals you can trust</span>
        <span><MaterialIcon icon="lock" className="text-[16px]" /> Your info stays private</span>
        <span><MaterialIcon icon="visibility" className="text-[16px]" /> You choose who moves forward</span>
        <span><MaterialIcon icon="favorite" className="text-[16px]" /> No pressure. Ever.</span>
      </section>

      {/* ── seller band: put your property on the map, free (improvements,
           condition, timing intake). The open on-ramp — indirect shade only. ── */}
      <section className="chero__sellerband">
        <div className="chero__sellerband-media" aria-hidden />
        <div className="chero__sellerband-copy">
          <h2>Have a property? Put it on the map for free.</h2>
          <p>Owners and agents can post listings, add photos, improvements, condition, and timing. Get discovered by motivated buyers around the world.</p>
        </div>
        <button className="chero__sellerband-cta" onClick={goListing}>
          List a property <MaterialIcon icon="arrow_forward" className="text-[16px]" />
        </button>
      </section>

      {/* ── the weld: PlotMaps (platform) + Position (brokerage engine) as ONE
           assemblage, stated plainly. (Trust lives in the trust strip above,
           so no duplicate chip row here.) ── */}
      <footer className="chero__weld">
        <span className="chero__weld-by">
          <span className="chero__weld-by-label">Built by</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/position-wordmark.svg" alt="Position Realty" className="chero__weld-mark" />
        </span>
        <p className="chero__weld-line">PlotMaps is the platform. Position is the brokerage and operating engine behind it.</p>
      </footer>
      </div>{/* /chero__descent */}

      {/* ── mobile bottom tab bar ── */}
      <nav className="chero__tabbar">
        <a href="/#explore" className="is-active"><MaterialIcon icon="public" className="text-[22px]" /><span>Explore</span></a>
        <button onClick={goPost}><MaterialIcon icon="explore" className="text-[22px]" /><span>Move</span></button>
        <a href="/listings"><MaterialIcon icon="apartment" className="text-[22px]" /><span>Real Estate</span></a>
        <button onClick={goPost}><MaterialIcon icon="deployed_code" className="text-[22px]" /><span>Post</span></button>
      </nav>

      {/* Plot Pad download / trust modal (shared with the rest of the app) */}
      <PlotPadModal open={padOpen} onClose={() => setPadOpen(false)} />

      <style>{`
        /* THE FOLD DOCTRINE (memory/plotmaps_thesis): the fold is awe-first —
           the hook that gets a "reservoir" visitor over the dam. The doors +
           buyer band + seller band + weld are a DELIBERATE descent below, each
           reservoir its own moment. A reasoned scroll, not a crammed viewport.
           The Earth video is a FIXED backdrop behind the whole descent. */
        .chero { position: relative; width: 100%; background: #000; color: #fff; overflow-x: hidden;
          min-height: 100svh; display: flex; flex-direction: column;
          font-family: var(--font-geist-sans), Inter, system-ui, sans-serif; }
        .chero button, .chero input, .chero a { font-family: inherit; }
        /* FIXED backdrop — the Earth stays put as the descent scrolls over it. */
        .chero__video { position: fixed; inset: 0; width: 100vw; height: 100svh; object-fit: cover; z-index: 0; }
        .chero__scrim { position: fixed; inset: 0; height: 100svh; z-index: 1; pointer-events: none;
          background:
            linear-gradient(180deg, rgba(2,4,10,0.82) 0%, rgba(2,4,10,0.35) 24%, rgba(2,4,10,0.12) 44%, rgba(2,4,10,0.1) 58%),
            linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.6) 82%, #000 100%),
            rgba(0,0,0,0.22); }  /* the flat 0.22 = the overall darken */

        /* nav */
        .chero__nav { position: relative; z-index: 5; display: flex; align-items: center; gap: 24px;
          padding: 22px clamp(20px, 4vw, 52px); }
        .chero__navlogo { display: block; width: 128px; height: auto; filter: brightness(0) invert(1); }
        .chero__hamburger { display: none; background: none; border: none; color: #fff; cursor: pointer; padding: 4px; }
        /* mobile drawer */
        .chero__drawer { position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.55); backdrop-filter: blur(4px); }
        .chero__drawer-panel { position: absolute; top: 0; left: 0; bottom: 0; width: min(78vw, 320px);
          background: #0a1020; border-right: 1px solid rgba(255,255,255,0.1); padding: 68px 24px 24px;
          display: flex; flex-direction: column; gap: 4px; animation: drawerIn .25s cubic-bezier(0.22,1,0.36,1); }
        @keyframes drawerIn { from { transform: translateX(-100%); } to { transform: none; } }
        .chero__drawer-x { position: absolute; top: 18px; right: 18px; background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; }
        .chero__drawer-panel a { color: #fff; font-size: 18px; font-weight: 600; text-decoration: none; padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .chero__drawer-join { display: inline-flex; align-items: center; gap: 8px; margin-top: 14px; border-bottom: none !important;
          padding: 13px 18px !important; border-radius: 12px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2) !important; }
        .chero__drawer-signin { margin-top: 8px; padding: 13px; border-radius: 12px; background: #fff; color: #0a1330; border: none; font-size: 16px; font-weight: 700; cursor: pointer; }
        /* mobile bottom tab bar */
        .chero__tabbar { display: none; position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
          background: rgba(8,12,24,0.9); backdrop-filter: blur(16px); border-top: 1px solid rgba(255,255,255,0.1);
          padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); }
        .chero__tabbar a, .chero__tabbar button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
          background: none; border: none; color: rgba(255,255,255,0.55); font-size: 10.5px; font-weight: 600; text-decoration: none; cursor: pointer; }
        .chero__tabbar .is-active { color: #fff; }
        .chero__navlinks { display: flex; gap: 30px; margin: 0 auto; }
        .chero__navlinks a { color: rgba(255,255,255,0.86); font-size: 15px; font-weight: 500; text-decoration: none; transition: color .15s; }
        .chero__navlinks a:hover { color: #fff; }
        .chero__navright { display: flex; align-items: center; gap: 16px; }
        .chero__signin { background: none; border: none; color: rgba(255,255,255,0.86); font-size: 15px; font-weight: 500; cursor: pointer; }
        .chero__signin:hover { color: #fff; }
        .chero__join { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.28); color: #fff; font-size: 14px; font-weight: 600; text-decoration: none;
          background: rgba(255,255,255,0.04); transition: background .15s, border-color .15s; }
        .chero__join:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.5); }

        /* ── MOBILE (matches the mobile mockup): hamburger, chip carousel with
           More, stacked CTAs, stacked cards, bottom tab bar ── */
        @media (max-width: 760px) {
          .chero__nav { padding: 16px 18px; }
          .chero__hamburger { display: block; order: -1; }
          .chero__navlinks { display: none; }
          .chero__navlogo { display: none; }          /* brand shows big in the stage, not the nav */
          .chero__navright { margin-left: auto; }
          .chero__join { display: none; }               /* Join lives in the drawer on mobile */
          .chero__tabbar { display: flex; }
          .chero__stage { min-height: calc(100svh - 64px); padding: 12px 16px 28px; }
          .chero__wordmark { width: min(76vw, 340px); }
          /* chips: a horizontal swipe carousel (no auto-scroll on mobile) */
          .chero__marquee { width: 100%; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch;
            border-radius: 20px; padding: 8px 12px; mask-image: none; scrollbar-width: none; }
          .chero__marquee::-webkit-scrollbar { display: none; }
          .chero__marquee-track { animation: none; gap: 6px; }
          .chero__ctas { flex-direction: column; width: min(360px, 90vw); gap: 10px; }
          .chero__cta { justify-content: center; width: 100%; padding: 12px 22px; }
          .chero__buyerband { text-align: center; }
          .chero__buyerband-copy { text-align: center; }
          .chero__buyerband-copy p { margin-left: auto; margin-right: auto; }
          .chero__buyerband-list { align-items: flex-start; width: max-content; max-width: 100%; margin-inline: auto; }
          .chero__sellerband { flex-direction: column; text-align: center; align-items: stretch; }
          .chero__sellerband-media { height: 140px; width: 100%; }
          .chero__weld { padding-bottom: calc(84px + env(safe-area-inset-bottom)); } /* clear the tab bar */
        }

        /* THE FOLD — fills the first viewport (minus nav), awe-first, breathing.
           Just wordmark + marquee + search + 3 doors + chip + a scroll cue. */
        .chero__stage { position: relative; z-index: 4; flex: none;
          min-height: calc(100svh - 92px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: clamp(8px, 2vh, 24px) 20px clamp(16px, 3vh, 32px); }
        .chero__brand { display: flex; flex-direction: column; align-items: center; }
        .chero__wordmark { display: block; width: clamp(260px, 34vw, 460px); height: auto; filter: brightness(0) invert(1) drop-shadow(0 6px 44px rgba(120,170,255,0.4)); }
        .chero__by { display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; }
        .chero__by-label { color: rgba(255,255,255,0.72); font-size: clamp(15px, 1.8vw, 20px); line-height: 1; }
        /* Position Black.svg: fill #000 → invert to white. The viewBox has
           generous vertical padding, so the glyphs sit in the MIDDLE of the
           img box — a negative margin pulls the optical baseline up to align
           with "by". Tune the -0.32em if it drifts. */
        .chero__by-mark { display: block; height: clamp(40px, 5vw, 60px); width: auto; margin: -0.55em 0;
          filter: brightness(0) invert(1) drop-shadow(0 2px 12px rgba(0,0,0,0.5)); }

        /* marquee */
        .chero__marquee { width: min(1000px, 96vw); margin-top: clamp(10px, 1.6vh, 18px); overflow: hidden;
          border-radius: 999px; padding: 8px 22px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(10px);
          /* fade only the very edges so no chip label gets clipped mid-word */
          mask-image: linear-gradient(90deg, transparent 0, #000 4%, #000 96%, transparent 100%); }
        .chero__marquee-track { display: inline-flex; gap: 8px; animation: cmarquee 55s linear infinite; white-space: nowrap; }
        .chero__marquee:hover .chero__marquee-track { animation-play-state: paused; }
        @keyframes cmarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .chero__chip { display: inline-flex; align-items: center; gap: 9px; padding: 6px 16px 6px 6px; border-radius: 999px;
          background: transparent; border: none; color: rgba(255,255,255,0.92); font-size: 13.5px; font-weight: 600; cursor: pointer;
          transition: background .15s; white-space: nowrap; }
        .chero__chip:hover { background: rgba(255,255,255,0.12); }
        .chero__chip-img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex: none;
          border: 1px solid rgba(255,255,255,0.25); }

        /* search */
        .chero__search { position: relative; display: flex; align-items: center; gap: 12px; width: min(620px, 92vw);
          margin-top: clamp(10px, 1.6vh, 18px); padding: 0 8px 0 20px; height: 54px;
          background: rgba(20,28,50,0.55); border: 1px solid rgba(255,255,255,0.16); border-radius: 16px; backdrop-filter: blur(14px); }
        .chero__search:focus-within { border-color: rgba(140,180,255,0.6); box-shadow: 0 0 0 3px rgba(63,125,255,0.2); }
        .chero__search-ic { color: rgba(255,255,255,0.55); }
        .chero__search input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; color: #fff; font-size: 16px; }
        .chero__search input::placeholder { color: rgba(255,255,255,0.5); }
        .chero__search-go { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 11px;
          background: rgba(255,255,255,0.08); color: #cfe0ff; }
        .chero__search-menu { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 6;
          background: rgba(12,20,44,0.97); border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; overflow: hidden;
          backdrop-filter: blur(12px); box-shadow: 0 24px 56px -24px rgba(0,0,0,0.7); }
        .chero__search-menu button { display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left;
          padding: 12px 18px; background: none; border: none; cursor: pointer; color: #fff; }
        .chero__search-menu button:hover { background: rgba(63,125,255,0.25); }
        .chero__search-menu b { font-size: 14px; font-weight: 600; } .chero__search-menu span { font-size: 12px; color: #9db4e6; }
        .chero__search-globe { color: #7fa8ff; flex: none; }

        /* CTAs */
        .chero__ctas { display: flex; gap: 12px; margin-top: clamp(10px, 1.6vh, 18px); flex-wrap: wrap; justify-content: center; }
        .chero__cta { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 14px;
          font-size: 15px; font-weight: 700; cursor: pointer; border: 1px solid transparent; transition: transform .15s, background .15s; }
        .chero__cta:hover { transform: translateY(-2px); }
        .chero__cta--primary { background: #fff; color: #0a1330; }
        .chero__cta--primary:hover { background: #eaf1ff; }
        .chero__cta--ghost { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.28); backdrop-filter: blur(8px); }
        .chero__cta--ghost:hover { background: rgba(255,255,255,0.16); }
        /* gamepad focus ring (useGamepadNav adds .gp-focus to the cycled item).
           Start flying carries data-gamepad-primary so the pad lands there first. */
        .chero .gp-focus { outline: none; box-shadow: 0 0 0 3px rgba(19,73,212,0.5), 0 0 20px rgba(19,73,212,0.5); border-radius: 14px; }

        .chero__tag { display: inline-flex; align-items: center; gap: 8px; margin-top: clamp(8px, 1.4vh, 14px);
          color: rgba(255,255,255,0.82); font-size: 13.5px; font-weight: 500; text-shadow: 0 1px 8px rgba(0,0,0,0.6); }

        /* controller chip — quiet dark affordance under the tagline. The dot
           reflects live gamepad status (off / connected / active). */
        .chero__pad { display: inline-flex; align-items: center; gap: 9px; margin-top: clamp(8px, 1.4vh, 14px);
          padding: 7px 15px; border-radius: 999px; cursor: pointer;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.16);
          color: rgba(255,255,255,0.82); font-size: 13px; font-weight: 600; backdrop-filter: blur(8px);
          transition: background .15s, border-color .15s, color .15s; }
        .chero__pad:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.34); color: #fff; }
        .chero__pad-dot { width: 7px; height: 7px; border-radius: 50%; flex: none;
          background: rgba(255,255,255,0.35); box-shadow: none; transition: background .2s, box-shadow .2s; }
        .chero__pad-dl { color: rgba(255,255,255,0.5); }
        /* connected/active: the dot goes live green + glows */
        .chero__pad--connected .chero__pad-dot,
        .chero__pad--active .chero__pad-dot { background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,0.8); }
        .chero__pad--active { border-color: rgba(52,211,153,0.5); color: #d7f7ea; }

        /* scroll cue — quiet 'more below', gently bobbing (no false floor) */
        .chero__more { display: inline-flex; flex-direction: column; align-items: center; gap: 0;
          margin-top: clamp(14px, 3vh, 30px); color: rgba(255,255,255,0.55); text-decoration: none;
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .chero__more:hover { color: #fff; }
        .chero__more-arrow { animation: chBob 1.8s ease-in-out infinite; }
        @keyframes chBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }

        /* THE DESCENT — solid dark below the fold so the doors/bands read on
           black once the fixed Earth scrolls away above. */
        .chero__descent { position: relative; z-index: 4;
          background: linear-gradient(180deg, rgba(3,5,12,0) 0%, #03050c 6%, #03050c 100%); }

        /* FOUR doors — one row, part of the single viewport. */
        .chero__cards { position: relative; z-index: 4; flex: none; display: grid; gap: 12px;
          grid-template-columns: repeat(4, 1fr); width: 100%; max-width: 1320px; margin: 0 auto;
          padding: 0 clamp(20px, 4vw, 52px) clamp(8px, 1.4vh, 16px); }
        @media (max-width: 1080px) { .chero__cards { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .chero__cards { grid-template-columns: 1fr; } }

        /* seller band — the free property on-ramp, one full-width row */
        .chero__sellerband { position: relative; z-index: 4; flex: none; display: flex; align-items: center; gap: 18px;
          width: 100%; max-width: 1320px; margin: 0 auto; padding: 12px clamp(20px, 4vw, 52px); }
        .chero__sellerband::before { content: ''; position: absolute; inset: 0 clamp(20px, 4vw, 52px);
          border-radius: 16px; background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.1); z-index: -1; }
        .chero__sellerband-media { flex: none; width: 168px; height: 78px; border-radius: 10px;
          background: url('/assets/landing/home-dusk.jpg') center/cover, #0a1330; }
        .chero__sellerband-copy { flex: 1; min-width: 0; text-align: left; }
        .chero__sellerband-copy h2 { font-family: var(--font-headline, inherit); font-size: 1.15rem; font-weight: 800; color: #fff; }
        .chero__sellerband-copy p { font-size: 12.5px; line-height: 1.45; color: rgba(255,255,255,0.66); margin-top: 3px; }
        .chero__sellerband-cta { flex: none; display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px;
          border-radius: 11px; background: #fff; color: #0a1330; border: none; font-size: 13.5px; font-weight: 700; cursor: pointer;
          transition: background .15s, transform .15s; }
        .chero__sellerband-cta:hover { background: #eaf1ff; transform: translateY(-2px); }

        /* BUYER ADVANTAGE band — the buyer reservoir. Two columns:
           the promise + a live-feeling stack of pros introducing themselves. */
        .chero__buyerband { position: relative; z-index: 4; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; align-items: center;
          width: 100%; max-width: 1240px; margin: 0 auto; padding: clamp(28px, 5vh, 56px) clamp(20px, 4vw, 52px); }
        .chero__buyerband-copy { text-align: left; }
        .chero__buyerband-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #7fa8ff; }
        .chero__buyerband-copy h2 { font-family: var(--font-headline, inherit); font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 800; color: #fff; margin-top: 8px; line-height: 1.1; }
        .chero__buyerband-copy p { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.7); margin-top: 12px; max-width: 520px; }
        .chero__buyerband-agents { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px !important;
          padding: 9px 14px; border-radius: 10px; background: rgba(19,73,212,0.14); border: 1px solid rgba(19,73,212,0.4);
          color: #cfe0ff !important; font-size: 13px !important; font-weight: 600; max-width: none !important; }
        .chero__buyerband-agents .material-symbols-outlined { color: #7fa8ff; flex: none; }
        .chero__buyerband-list { list-style: none; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 9px; }
        .chero__buyerband-list li { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: rgba(255,255,255,0.82); }
        .chero__buyerband-list .material-symbols-outlined { color: #34d399; flex: none; }
        .chero__buyerband-cta { display: inline-flex; align-items: center; gap: 8px; margin-top: 22px; padding: 13px 24px;
          border-radius: 12px; background: #1349d4; color: #fff; border: none; font-size: 14.5px; font-weight: 700; cursor: pointer;
          transition: background .15s, transform .15s; }
        .chero__buyerband-cta:hover { background: #0f3cb0; transform: translateY(-2px); }
        /* ── the CONSTELLATION — buyer at center, 4 pros at the corners ── */
        .chero__constel { position: relative; height: 440px; max-width: 560px; margin: 0 auto; width: 100%; }
        /* ghost blueprint house behind (the goal). line-art-on-black PNG →
           screen blend lifts only the white lines, drop opacity way down. */
        .chero__constel::before { content: ''; position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);
          width: 96%; height: 260px; z-index: 0; pointer-events: none;
          background: url('/assets/landing/blueprint-house.png') center/contain no-repeat;
          mix-blend-mode: screen; opacity: 0.16; }
        .chero__constel-lines { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
        /* corner professional cards (compact) */
        .chero__pcard { position: absolute; z-index: 2; display: flex; align-items: flex-start; gap: 10px;
          padding: 11px 13px; width: 190px; border-radius: 13px;
          background: rgba(12,18,38,0.95); border: 1px solid rgba(255,255,255,0.12);
          box-shadow: 0 18px 44px -20px rgba(0,0,0,0.85); backdrop-filter: blur(8px); }
        .chero__pcard-ic { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; flex: none;
          background: rgba(19,73,212,0.14); border: 1px solid rgba(255,255,255,0.14); color: #9dc0ff; }
        .chero__pcard em { display: block; font-style: normal; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.62); }
        .chero__pcard b { font-size: 15px; font-weight: 800; color: #fff; }
        .chero__pcard i { font-size: 11px; font-style: normal; color: #9dc0ff; }
        .chero__pchip { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 3px 8px; border-radius: 999px;
          background: rgba(52,211,153,0.14); color: #6ee7b7; font-size: 10px; font-weight: 700; }
        .chero__pchip .material-symbols-outlined { color: #34d399; }
        /* four corners, well clear of the centered hub */
        .chero__pcard--tl { top: 0; left: 0; }
        .chero__pcard--tr { top: 0; right: 0; }
        .chero__pcard--bl { bottom: 0; left: 0; }
        .chero__pcard--br { bottom: 0; right: 0; }
        /* the buyer HUB — the center, on their ground (brand-blue framed) */
        .chero__hub { position: absolute; z-index: 3; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 196px; padding: 15px 17px; border-radius: 15px; text-align: left;
          background: rgba(10,16,34,0.97); border: 1px solid rgba(19,73,212,0.7);
          box-shadow: 0 0 0 4px rgba(19,73,212,0.14), 0 24px 60px -24px rgba(0,0,0,0.85); }
        .chero__hub-badge { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%;
          background: #1349d4; color: #fff; font-size: 13px; font-weight: 800; margin-bottom: 8px; }
        .chero__hub b { display: block; font-size: 15px; font-weight: 800; color: #fff; }
        .chero__hub i { display: block; font-style: normal; font-size: 11.5px; color: #9dc0ff; margin-top: 2px; }
        .chero__hub ul { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
        .chero__hub li { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.85); }
        .chero__hub li .material-symbols-outlined { color: #7fa8ff; }

        /* trust strip */
        .chero__truststrip { position: relative; z-index: 4; flex: none; display: flex; flex-wrap: wrap; justify-content: center; gap: clamp(18px, 4vw, 48px);
          width: 100%; max-width: 1120px; margin: 0 auto; padding: 16px clamp(20px, 4vw, 52px);
          border-top: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08); }
        .chero__truststrip span { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.62); }
        .chero__truststrip span .material-symbols-outlined { color: #7fa8ff; }

        @media (max-width: 900px) {
          .chero__buyerband { grid-template-columns: 1fr; gap: 28px; }
          /* on mobile the constellation is fiddly — collapse to a simple stack:
             hub on top, pro cards flow below in normal order. */
          .chero__constel { height: auto; display: flex; flex-direction: column; gap: 10px; max-width: 360px; margin: 0 auto; }
          .chero__constel::before, .chero__constel-lines { display: none; }
          .chero__pcard, .chero__hub { position: static; transform: none; width: 100%; }
          .chero__hub { order: -1; }
        }

        /* the weld — PlotMaps (platform) + Position (engine) as one assemblage */
        .chero__weld { position: relative; z-index: 4; flex: none; display: flex; flex-direction: column; align-items: center; gap: 7px;
          text-align: center; padding: clamp(10px, 1.6vh, 18px) 24px clamp(12px, 2vh, 20px); }
        .chero__weld-by { display: inline-flex; align-items: center; gap: 8px; }
        .chero__weld-by-label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
        .chero__weld-mark { height: 20px; width: auto; filter: brightness(0) invert(1); opacity: 0.9; }
        .chero__weld-line { font-size: 12.5px; color: rgba(255,255,255,0.6); max-width: 640px; }
        .chero__weld-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 18px; margin-top: 2px; }
        .chero__weld-chips span { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.55); }
        .chero__weld-chips span .material-symbols-outlined { color: #7fa8ff; }

        @media (prefers-reduced-motion: reduce) {
          .chero__video { display: none; }
          .chero__scrim { background: linear-gradient(180deg, rgba(2,4,10,0.7), rgba(2,4,10,0.9)),
            url('/hero/earth-space-poster.jpg') center/cover no-repeat; }
          .chero__marquee-track { animation: none; }
        }
      `}</style>
    </div>
  );
}

function HeroCard({ icon, title, body, cta, onClick }: {
  icon: string; title: string; body: string; cta: string; onClick: () => void;
}) {
  return (
    <button className="hcard" onClick={onClick} data-gamepad-focusable>
      <span className="hcard__icon"><MaterialIcon icon={icon} className="text-[24px]" /></span>
      <span className="hcard__title">{title}</span>
      <span className="hcard__body">{body}</span>
      <span className="hcard__go">{cta} <MaterialIcon icon="arrow_forward" className="text-[16px]" /></span>
      <style>{`
        .hcard { position: relative; text-align: left; display: flex; flex-direction: column; gap: 7px;
          padding: 16px 18px 16px; border-radius: 16px; cursor: pointer;
          background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(8px); transition: background .15s, border-color .15s, transform .15s; }
        .hcard:hover { background: rgba(255,255,255,0.07); border-color: rgba(19,73,212,0.55); transform: translateY(-3px); }
        /* outline icon tile, monochrome + ONE coordinated brand-blue accent (no
           four-hue AI-generic tiles). memory/feedback_brand_fidelity */
        .hcard__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px;
          border: 1px solid rgba(255,255,255,0.18); background: rgba(19,73,212,0.10); color: #9dc0ff; }
        .hcard:hover .hcard__icon { border-color: rgba(19,73,212,0.7); color: #cfe0ff; }
        .hcard__title { font-family: var(--font-headline, inherit); font-size: 1.12rem; font-weight: 800; color: #fff; line-height: 1.1; }
        .hcard__body { font-size: 12.5px; line-height: 1.45; color: rgba(255,255,255,0.66); flex: 1; }
        .hcard__go { display: inline-flex; align-items: center; gap: 6px; margin-top: 4px; padding: 7px 14px; align-self: flex-start;
          border-radius: 999px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.16);
          color: #fff; font-size: 12.5px; font-weight: 700; }
        .hcard:hover .hcard__go { background: #fff; color: #0a1330; }
      `}</style>
    </button>
  );
}
