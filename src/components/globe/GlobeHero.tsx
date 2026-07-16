'use client';

// ── GlobeHero — the front door: a flyable Earth of wonders, in space ──
//
// Greg's vision (2026-07-15): deep space + stars, "PlotMaps" big up top, the
// globe CLOSE and LARGE below it — grab and spin it, click a place (real
// selectable country/state SHAPES) and fly down into it. Plus a scrolling
// marquee of cool locations. The D3 polygon globe (vendored globeEngine) is
// used precisely because its shapes are clickable — and its colors are OURS
// to control (glowing brand tones in space, not real Earth colors).
//
// Selection → /map?destination=<slug>&view=3d (the CONFIRMED cinematic-fly
// pipeline). memory: the front-door breakthrough (flyable Earth of wonders),
// project_pin_grammar, feedback_brand_fidelity.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signInWithGoogle } from '@/lib/signIn';
import GlobeApp from '@/lib/globe/globeEngine';
import * as topojson from 'topojson-client';
import { DESTINATIONS } from '@/lib/destinations';

// the marquee — cool places to fly (cities + wonders as we add them)
const MARQUEE = DESTINATIONS.map((d) => ({ slug: d.slug, name: d.name, region: d.region }));

// the vendored engine's market ids differ from our destination slugs — map them.
const MARKET_TO_SLUG: Record<string, string> = {
  newyork: 'new-york', vegas: 'las-vegas', paris: 'paris', acapulco: 'acapulco', sydney: 'sydney',
};

// our globe palette — NOT real Earth colors. Deep space ocean, glowing
// brand-blue land, brighter highlight on hover/selection.
const PALETTE = {
  ocean: 'rgba(9,16,44,0.0)',       // transparent — the space bg shows through the sphere edge
  sphere: '#0b1836',                 // the globe disc (deep navy)
  land: '#1b3a86',                   // country fill (brand-deep glow)
  landStroke: 'rgba(120,170,255,0.35)',
  highlight: '#3f7dff',              // hover/selected
  highlightStroke: '#9dc2ff',
  graticule: 'rgba(120,160,255,0.12)',
  marker: '#63b3ff',
};

export default function GlobeHero() {
  const router = useRouter();
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<GlobeApp | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  // auth-aware fly (same contract as HeroCitySearch/MobileHero)
  const flyTo = (slug: string) => {
    const path = `/map?destination=${slug}&view=3d`;
    if (user) router.push(path);
    else signInWithGoogle(path);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    const app = new GlobeApp(canvasRef.current, {
      palette: PALETTE,
      onHover: (name: string | null) => setHover(name),
      // a market/area was entered on the globe → fly the real map. The engine
      // passes (areaName, market) where market has the engine's own id.
      onEnterArea: (_name: string | null, market: { id: string } | null) => {
        if (!market) return;
        flyTo(MARKET_TO_SLUG[market.id] ?? market.id);
      },
    });
    appRef.current = app;

    Promise.all([
      fetch('/geo/world-countries-110m.json').then((r) => r.json()),
      fetch('/geo/us-states-10m.json').then((r) => r.json()),
    ]).then(([wTopo, uTopo]) => {
      if (cancelled) return;
      const countries = topojson.feature(wTopo, wTopo.objects.countries);
      const land = topojson.feature(wTopo, wTopo.objects.land);
      const states = topojson.feature(uTopo, uTopo.objects.states);
      app.setData({ countries, land, states });
      app.resize();   // creates the d3 projection sized to the canvas — MUST run before start()
      app.start();
      setReady(true);
    });

    // keep the projection sized to the canvas on window resize
    const onResize = () => { try { app.resize(); } catch { /* noop */ } };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      try { if (app.destroy) app.destroy(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ghero">
      {/* star field (two layers, parallax drift) */}
      <div className="ghero__stars s1" />
      <div className="ghero__stars s2" />

      {/* PlotMaps, big, up top */}
      <div className="ghero__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/plotmaps-wordmark.svg" alt="PlotMaps" className="ghero__wordmark" />
        <p className="ghero__tag">Explore the Earth. Find your place.</p>
      </div>

      {/* the globe — close + large */}
      <div className="ghero__globe">
        <canvas ref={canvasRef} className="ghero__canvas" />
        {hover && <div className="ghero__hoverlabel">{hover}</div>}
        {!ready && <div className="ghero__loading">Spinning up the world…</div>}
      </div>

      {/* search — the other way in (type where you're going) */}
      <div className="ghero__searchwrap">
        <GlobeSearch onFly={flyTo} />
      </div>

      {/* scrolling marquee of cool locations */}
      <div className="ghero__marquee" aria-label="Places to explore">
        <div className="ghero__marquee-track">
          {[...MARQUEE, ...MARQUEE].map((p, i) => (
            <button key={`${p.slug}-${i}`} className="ghero__chip" onClick={() => flyTo(p.slug)}>
              <span className="ghero__chip-dot" />
              {p.name}<em>{p.region}</em>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .ghero {
          position: relative; width: 100%; min-height: 100svh; overflow: hidden;
          background: #000;   /* straight black space */
          display: flex; flex-direction: column; align-items: center;
        }
        /* stars */
        .ghero__stars { position: absolute; inset: -50% ; pointer-events: none; }
        .ghero__stars.s1 {
          background-image:
            radial-gradient(1.4px 1.4px at 20% 30%, #fff, transparent),
            radial-gradient(1.2px 1.2px at 70% 20%, #cfe0ff, transparent),
            radial-gradient(1.6px 1.6px at 40% 70%, #fff, transparent),
            radial-gradient(1px 1px at 85% 55%, #dbe6ff, transparent),
            radial-gradient(1.3px 1.3px at 55% 85%, #fff, transparent),
            radial-gradient(1px 1px at 10% 80%, #cfe0ff, transparent),
            radial-gradient(1.5px 1.5px at 90% 15%, #fff, transparent);
          background-size: 100% 100%; opacity: 0.9; animation: drift 140s linear infinite, twinkleA 4.2s ease-in-out infinite;
        }
        @keyframes twinkleA { 0%,100% { opacity: 0.9; } 50% { opacity: 0.45; } }
        @keyframes twinkleB { 0%,100% { opacity: 0.55; } 50% { opacity: 0.2; } }
        .ghero__stars.s2 {
          background-image:
            radial-gradient(1px 1px at 33% 45%, #fff, transparent),
            radial-gradient(1px 1px at 66% 65%, #bcd4ff, transparent),
            radial-gradient(1.2px 1.2px at 15% 55%, #fff, transparent),
            radial-gradient(1px 1px at 80% 78%, #fff, transparent),
            radial-gradient(0.8px 0.8px at 50% 25%, #cfe0ff, transparent);
          background-size: 100% 100%; opacity: 0.6; animation: drift 90s linear infinite reverse, twinkleB 3.1s ease-in-out infinite;
        }
        @keyframes drift { from { transform: translateY(0); } to { transform: translateY(40px); } }

        /* brand — HUGE, front and center */
        .ghero__brand { position: relative; z-index: 3; text-align: center; margin-top: clamp(36px, 8vh, 90px); }
        .ghero__wordmark { height: clamp(64px, 12vw, 150px); width: auto; filter: brightness(0) invert(1) drop-shadow(0 6px 40px rgba(90,150,255,0.55)); }
        .ghero__tag { margin-top: 16px; color: #c3d4f5; font-size: clamp(15px, 1.8vw, 20px); font-weight: 500; letter-spacing: 0.01em; }

        /* the globe, close + large, overlapping under the brand */
        .ghero__globe { position: relative; z-index: 2; flex: 1; width: 100%; display: flex; align-items: center; justify-content: center; min-height: 0; margin-top: -2vh; }
        .ghero__canvas { width: min(92vw, 78vh); height: min(92vw, 78vh); cursor: grab; touch-action: none; }
        .ghero__canvas:active { cursor: grabbing; }
        .ghero__hoverlabel {
          position: absolute; top: 8%; left: 50%; transform: translateX(-50%); z-index: 4;
          padding: 7px 16px; border-radius: 999px; background: rgba(10,20,50,0.7); backdrop-filter: blur(6px);
          border: 1px solid rgba(120,170,255,0.3); color: #cfe0ff; font-size: 13px; font-weight: 700; letter-spacing: 0.04em;
          pointer-events: none; white-space: nowrap;
        }
        .ghero__loading { position: absolute; color: #6f86c4; font-size: 13px; font-weight: 600; }

        /* search */
        .ghero__searchwrap { position: relative; z-index: 3; width: min(560px, 90vw); margin-top: 4px; }

        /* marquee */
        .ghero__marquee { position: relative; z-index: 3; width: 100%; margin: 18px 0 clamp(20px,4vh,40px); overflow: hidden;
          mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
        .ghero__marquee-track { display: inline-flex; gap: 10px; padding: 0 10px; animation: marquee 42s linear infinite; white-space: nowrap; }
        .ghero__marquee:hover .ghero__marquee-track { animation-play-state: paused; }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ghero__chip {
          display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px;
          background: rgba(30,54,120,0.5); border: 1px solid rgba(120,170,255,0.22); backdrop-filter: blur(6px);
          color: #eaf1ff; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: background .15s, border-color .15s, transform .15s;
        }
        .ghero__chip:hover { background: rgba(63,125,255,0.5); border-color: rgba(157,194,255,0.6); transform: translateY(-2px); }
        .ghero__chip em { font-style: normal; font-weight: 500; color: #9db4e6; font-size: 12px; }
        .ghero__chip-dot { width: 6px; height: 6px; border-radius: 50%; background: #63b3ff; box-shadow: 0 0 8px #63b3ff; }

        @media (prefers-reduced-motion: reduce) {
          .ghero__stars, .ghero__marquee-track { animation: none !important; }
        }
        @media (max-width: 640px) { .ghero__canvas { width: 94vw; height: 94vw; } }
      `}</style>
    </div>
  );
}

// the search — type a place, fly there
function GlobeSearch({ onFly }: { onFly: (slug: string) => void }) {
  const [q, setQ] = useState('');
  const matches = q.trim().length > 0
    ? DESTINATIONS.filter((d) =>
        d.name.toLowerCase().includes(q.toLowerCase()) || d.region.toLowerCase().includes(q.toLowerCase()),
      ).slice(0, 5)
    : [];

  return (
    <div className="gsearch">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="gsearch__ic">
        <circle cx="11" cy="11" r="7" stroke="#9db4e6" strokeWidth="2.2" />
        <path d="M20 20l-3.4-3.4" stroke="#9db4e6" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a city, place, or wonder…"
        onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) onFly(matches[0].slug); }}
      />
      {matches.length > 0 && (
        <div className="gsearch__menu">
          {matches.map((m) => (
            <button key={m.slug} onClick={() => onFly(m.slug)}>
              <b>{m.name}</b><span>{m.region}</span>
            </button>
          ))}
        </div>
      )}
      <style>{`
        .gsearch { position: relative; display: flex; align-items: center; gap: 10px; padding: 0 16px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(120,170,255,0.28); border-radius: 14px;
          backdrop-filter: blur(8px); }
        .gsearch:focus-within { border-color: rgba(157,194,255,0.6); box-shadow: 0 0 0 3px rgba(63,125,255,0.18); }
        .gsearch input { flex: 1; min-width: 0; background: transparent; border: none; outline: none; padding: 14px 0;
          color: #eaf1ff; font-size: 15px; }
        .gsearch input::placeholder { color: #7f93c4; }
        .gsearch__menu { position: absolute; top: calc(100% + 8px); left: 0; right: 0; z-index: 5;
          background: rgba(12,22,52,0.96); border: 1px solid rgba(120,170,255,0.22); border-radius: 14px; overflow: hidden;
          backdrop-filter: blur(10px); box-shadow: 0 20px 50px -20px rgba(0,0,0,0.6); }
        .gsearch__menu button { display: flex; align-items: baseline; gap: 8px; width: 100%; text-align: left;
          padding: 11px 16px; background: none; border: none; cursor: pointer; color: #eaf1ff; }
        .gsearch__menu button:hover { background: rgba(63,125,255,0.25); }
        .gsearch__menu b { font-size: 14px; font-weight: 700; }
        .gsearch__menu span { font-size: 12px; color: #9db4e6; }
      `}</style>
    </div>
  );
}
