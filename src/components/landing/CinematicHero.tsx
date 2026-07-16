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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signInWithGoogle } from '@/lib/signIn';
import MaterialIcon from '@/components/ui/MaterialIcon';
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

export default function CinematicHero() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const fly = (slug: string) => {
    const path = `/map?destination=${slug}&view=3d`;
    if (user) router.push(path); else signInWithGoogle(path);
  };
  const goPost = () => {
    if (user) router.push('/post'); else signInWithGoogle('/post');
  };
  const searchMatches = q.trim().length > 0
    ? DESTINATIONS.filter((d) =>
        d.name.toLowerCase().includes(q.toLowerCase()) || d.region.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 6)
    : [];

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
            placeholder="Where do you want to go?"
            onKeyDown={(e) => { if (e.key === 'Enter' && searchMatches[0]) fly(searchMatches[0].slug); }}
          />
          <span className="chero__search-go"><MaterialIcon icon="explore" className="text-[18px]" /></span>
          {searchMatches.length > 0 && (
            <div className="chero__search-menu">
              {searchMatches.map((m) => (
                <button key={m.slug} onClick={() => fly(m.slug)}>
                  <b>{m.name}</b><span>{m.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="chero__ctas">
          <button className="chero__cta chero__cta--primary" onClick={() => fly('lemoore')}>
            Start flying <MaterialIcon icon="north_east" className="text-[17px]" />
          </button>
          <button className="chero__cta chero__cta--ghost" onClick={goPost}>
            Post your move <MaterialIcon icon="deployed_code" className="text-[17px]" />
          </button>
        </div>

        <p className="chero__tag">
          <MaterialIcon icon="public" className="text-[14px]" /> Explore the world. Find your place. Begin your move.
        </p>
      </div>

      {/* ── three cards below the hero ── */}
      <section className="chero__cards">
        <HeroCard eyebrow="Fly the world" title="Explore without limits"
          body="Spin the globe, discover iconic places, and uncover new possibilities everywhere."
          onClick={() => fly('lemoore')} />
        <HeroCard eyebrow="Build your position" title="Post your move"
          body="Share your move, tell your story, and let the right opportunities find you."
          onClick={goPost} />
        <HeroCard eyebrow="Real estate. Reimagined." title="Tools for every move"
          body="From searching to closing, Position gives you the platform to move smarter."
          onClick={() => router.push('/listings')} />
      </section>

      {/* ── mobile bottom tab bar ── */}
      <nav className="chero__tabbar">
        <a href="/#explore" className="is-active"><MaterialIcon icon="public" className="text-[22px]" /><span>Explore</span></a>
        <button onClick={goPost}><MaterialIcon icon="explore" className="text-[22px]" /><span>Move</span></button>
        <a href="/listings"><MaterialIcon icon="apartment" className="text-[22px]" /><span>Real Estate</span></a>
        <button onClick={goPost}><MaterialIcon icon="deployed_code" className="text-[22px]" /><span>Post</span></button>
      </nav>

      <style>{`
        /* the hero holds ONE viewport — nav+brand+marquee+search+CTAs+Earth */
        .chero { position: relative; width: 100%; background: #000; color: #fff; overflow: hidden;
          min-height: 100svh; display: flex; flex-direction: column;
          font-family: var(--font-geist-sans), Inter, system-ui, sans-serif; }
        .chero button, .chero input, .chero a { font-family: inherit; }
        .chero__video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
        /* darker + easier on the eyes: a global dim over the whole video + the
           top/bottom scrims for text legibility. */
        .chero__scrim { position: absolute; inset: 0; z-index: 1; pointer-events: none;
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
          .chero__stage { padding: 8px 16px 84px; justify-content: flex-start; padding-top: clamp(12px, 3vh, 28px); }
          .chero__wordmark { width: min(78vw, 360px); }
          /* chips: a horizontal swipe carousel (no auto-scroll on mobile) */
          .chero__marquee { width: 100%; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch;
            border-radius: 20px; padding: 8px 12px; mask-image: none; scrollbar-width: none; }
          .chero__marquee::-webkit-scrollbar { display: none; }
          .chero__marquee-track { animation: none; gap: 6px; }
          .chero__ctas { flex-direction: column; width: min(360px, 90vw); }
          .chero__cta { justify-content: center; width: 100%; }
          .chero__cards { grid-template-columns: 1fr; margin-top: 0; padding-bottom: 100px; }
        }

        /* the title stage — grows to fill the viewport under the nav so the
           whole hero is ONE screen; cards sit below the fold. */
        .chero__stage { position: relative; z-index: 4; flex: 1; min-height: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; padding: 0 20px clamp(16px, 5vh, 56px); }
        .chero__brand { display: flex; flex-direction: column; align-items: center; }
        .chero__wordmark { display: block; width: clamp(320px, 52vw, 680px); height: auto; filter: brightness(0) invert(1) drop-shadow(0 6px 44px rgba(120,170,255,0.4)); }
        .chero__by { display: inline-flex; align-items: center; gap: 8px; margin-top: 8px; }
        .chero__by-label { color: rgba(255,255,255,0.72); font-size: clamp(15px, 1.8vw, 20px); line-height: 1; }
        /* Position Black.svg: fill #000 → invert to white. The viewBox has
           generous vertical padding, so the glyphs sit in the MIDDLE of the
           img box — a negative margin pulls the optical baseline up to align
           with "by". Tune the -0.32em if it drifts. */
        .chero__by-mark { display: block; height: clamp(40px, 5vw, 60px); width: auto; margin: -0.55em 0;
          filter: brightness(0) invert(1) drop-shadow(0 2px 12px rgba(0,0,0,0.5)); }

        /* marquee */
        .chero__marquee { width: min(1000px, 96vw); margin-top: clamp(16px, 3vh, 30px); overflow: hidden;
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
          margin-top: clamp(16px, 3vh, 26px); padding: 0 8px 0 20px; height: 60px;
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
        .chero__search-menu b { font-size: 14px; } .chero__search-menu span { font-size: 12px; color: #9db4e6; }

        /* CTAs */
        .chero__ctas { display: flex; gap: 14px; margin-top: clamp(16px, 3vh, 24px); flex-wrap: wrap; justify-content: center; }
        .chero__cta { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; border-radius: 14px;
          font-size: 15.5px; font-weight: 700; cursor: pointer; border: 1px solid transparent; transition: transform .15s, background .15s; }
        .chero__cta:hover { transform: translateY(-2px); }
        .chero__cta--primary { background: #fff; color: #0a1330; }
        .chero__cta--primary:hover { background: #eaf1ff; }
        .chero__cta--ghost { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.28); backdrop-filter: blur(8px); }
        .chero__cta--ghost:hover { background: rgba(255,255,255,0.16); }

        .chero__tag { display: inline-flex; align-items: center; gap: 8px; margin-top: clamp(14px, 2.5vh, 22px);
          color: rgba(255,255,255,0.82); font-size: 14px; font-weight: 500; text-shadow: 0 1px 8px rgba(0,0,0,0.6); }

        /* three cards */
        .chero__cards { position: relative; z-index: 4; display: grid; gap: 18px;
          grid-template-columns: repeat(3, 1fr); max-width: 1240px; margin: clamp(40px, 8vh, 90px) auto 0;
          padding: 0 clamp(20px, 4vw, 52px) clamp(40px, 8vh, 90px); }
        @media (max-width: 900px) { .chero__cards { grid-template-columns: 1fr; } }

        @media (prefers-reduced-motion: reduce) {
          .chero__video { display: none; }
          .chero { background: #05070f url('/hero/earth-space-poster.jpg') center/cover no-repeat; }
          .chero__marquee-track { animation: none; }
        }
      `}</style>
    </div>
  );
}

function HeroCard({ eyebrow, title, body, onClick }: {
  eyebrow: string; title: string; body: string; onClick: () => void;
}) {
  return (
    <button className="hcard" onClick={onClick}>
      <span className="hcard__eyebrow">{eyebrow}</span>
      <span className="hcard__title">{title}</span>
      <span className="hcard__body">{body}</span>
      <span className="hcard__go"><MaterialIcon icon="arrow_forward" className="text-[18px]" /></span>
      <style>{`
        .hcard { position: relative; text-align: left; display: flex; flex-direction: column; gap: 8px;
          padding: 26px 26px 64px; border-radius: 20px; cursor: pointer;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(8px); transition: background .15s, border-color .15s, transform .15s; }
        .hcard:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.24); transform: translateY(-3px); }
        .hcard__eyebrow { font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #7fa8ff; }
        .hcard__title { font-family: var(--font-headline, inherit); font-size: 1.5rem; font-weight: 800; color: #fff; }
        .hcard__body { font-size: 14px; line-height: 1.55; color: rgba(255,255,255,0.68); }
        .hcard__go { position: absolute; left: 26px; bottom: 22px; width: 40px; height: 40px; border-radius: 999px;
          display: grid; place-items: center; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.16); color: #fff; }
        .hcard:hover .hcard__go { background: #fff; color: #0a1330; }
      `}</style>
    </button>
  );
}
