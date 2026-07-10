'use client';

// ── MobileHero ────────────────────────────────────────────────────────
//
// The mobile landing hero (< 640px). Built from Greg's Claude Design handoff
// "Mobile Hero.dc.html" — take 1b (full-bleed flying world + bottom sheet)
// with 1a's staged text entrance grafted in, per the design's own note
// ("make 1b the one, with 1a's staged text entrance").
//
// The island IS the screen; the camera auto-flies city to city (pans the
// island art to center the active pin) every ~3.4s, pausing 9s on any tap.
// A white bottom sheet holds the pitch + search + chip row + CTA and expands
// on tap/focus. Chips/CTA route to the REAL map through the auth-aware fly
// (signed-in → /map?destination=<slug>; signed-out → Google OAuth carrying
// the destination), same as the desktop HeroCitySearch.
//
// Recreated as React from the design's visual output (not its DCLogic/
// IOSDevice internals) — pixel-matched to the mock, wired to the real flow.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signInWithGoogle } from '@/lib/signIn';

const IMG = '/assets/landing/mobilehero';

// The five cities from the design — x/y are positions on the island art
// (island-cut.png), slug drives the REAL map fly.
const CITIES = [
  { slug: 'new-york', name: 'New York', sub: 'Manhattan, NY', x: 39, y: 33, thumb: `${IMG}/thumb-newyork.png` },
  { slug: 'paris', name: 'Paris', sub: 'Île-de-France', x: 68, y: 31, thumb: `${IMG}/thumb-paris.png` },
  { slug: 'acapulco', name: 'Acapulco', sub: 'Guerrero, MX', x: 14, y: 42, thumb: `${IMG}/thumb-acapulco.png` },
  { slug: 'vegas', name: 'Las Vegas', sub: 'Nevada, USA', x: 44, y: 58, thumb: `${IMG}/thumb-vegas.png` },
  { slug: 'sydney', name: 'Sydney', sub: 'New South Wales', x: 75, y: 57, thumb: `${IMG}/thumb-sydney.png` },
];

const FLY_MS = 3400; // auto-tour cadence
const PAUSE_MS = 9000; // pause the tour after a tap

export default function MobileHero() {
  const router = useRouter();
  const { user } = useAuth();
  const [idx, setIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [cardKey, setCardKey] = useState(0); // retrigger the card pop per city
  const pausedUntil = useRef(0);

  // Auto-fly: advance to the next city on the cadence unless paused.
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setIdx((i) => (i + 1) % CITIES.length);
    }, FLY_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setCardKey((k) => k + 1); }, [idx]);

  const city = CITIES[idx];

  // Auth-aware fly to the real map (identical contract to HeroCitySearch).
  const fly = (slug: string) => {
    const path = `/map?destination=${slug}&view=3d`;
    if (user) router.push(path);
    else signInWithGoogle(path);
  };

  const selectCity = (i: number) => {
    setIdx(i);
    pausedUntil.current = Date.now() + PAUSE_MS;
    setSheetOpen(true);
  };

  // Camera pan: translate the (190%-wide) island so the active city's pin
  // sits centered-ish. Mirrors the design's clamp math (1b).
  const S = 1.9;
  let tx = 50 / S - city.x;
  tx = Math.max(-(1 - 1 / S) * 100, Math.min(0, tx));
  let ty = (35 - city.y) * 0.9;       // bias to upper-middle, per design
  ty = Math.max(-26, Math.min(14, ty));
  const islandTransform = `translate(${tx.toFixed(1)}%, ${(ty + 18).toFixed(1)}%)`;

  return (
    <div className="mh">
      {/* ── the flying world (island IS the screen) ── */}
      <div className="mh-world">
        <div className="mh-island" style={{ transform: islandTransform }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG}/island-cut.png`} alt="" className="mh-island__img" draggable={false} />
          {CITIES.map((c, i) => (
            <div key={c.slug} className="mh-pin" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
              {i === idx && <span className="mh-pin__ring" />}
              <span className="mh-pin__dot" style={{ background: i === idx ? '#1349d4' : '#fff' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── top scrim: brand + headline (staged entrance from 1a) ── */}
      <div className="mh-top">
        <div className="mh-topbar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" className="mh-logo" />
          <button className="mh-login" onClick={() => (user ? router.push('/home') : signInWithGoogle('/home'))}>
            {user ? 'Home' : 'Log in'}
          </button>
        </div>
        <div className="mh-pill">MAPS + BROKERAGE · BUILT FOR BUYERS</div>
        <h1 className="mh-head">Explore the Map.<br /><span>Before You Offer.</span></h1>
      </div>

      {/* ── floating active-city card (pops per city) ── */}
      <div className="mh-card" key={cardKey}>
        <div className="mh-card__inner" onClick={() => fly(city.slug)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={city.thumb} alt={city.name} className="mh-card__thumb" />
          <div className="mh-card__t">
            <b>{city.name}</b>
            <span>{city.sub}</span>
          </div>
          <span className="mh-card__go">Explore →</span>
        </div>
      </div>

      {/* ── bottom sheet: pitch + search + chips + CTA ── */}
      <div className={`mh-sheet ${sheetOpen ? 'is-open' : ''}`}>
        <button className="mh-sheet__grip" onClick={() => setSheetOpen((o) => !o)} aria-label="Expand">
          <span />
        </button>
        <div className="mh-sheet__body">
          <div className={`mh-search ${focused ? 'is-focus' : ''}`} onClick={() => setSheetOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#1349d4" strokeWidth="2.4" /><path d="M20 20l-3.2-3.2" stroke="#1349d4" strokeWidth="2.4" strokeLinecap="round" /></svg>
            <input
              placeholder="Search a city, neighborhood, or destination"
              onFocus={() => { setFocused(true); setSheetOpen(true); pausedUntil.current = Date.now() + PAUSE_MS; }}
              onBlur={() => setFocused(false)}
            />
          </div>
          <div className="mh-chips">
            {CITIES.map((c, i) => (
              <button key={c.slug} className={`mh-chip ${i === idx ? 'is-on' : ''}`} onClick={() => selectCity(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.thumb} alt="" />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          <button className="mh-cta" onClick={() => fly(city.slug)}>
            Explore the map <span aria-hidden>→</span>
          </button>
          <p className="mh-pitch">
            PlotMaps helps you explore places, discover the right destinations, and build
            the perfect team through <strong>Position</strong>.
          </p>
          <div className="mh-fine">
            <span className="mh-fine__ck">✓</span>
            <p><strong>Free for buyers. Free for agents.</strong> Built by Gregory M. Franklin · CA broker · DRE #02090737.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
