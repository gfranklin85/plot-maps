'use client';

// ── /sky — the Floating Plots world, in motion ────────────────────────
//
// Demo surface for the brand theme built in Blender (scratchpad
// pin_family.blend): floating plot-islands, the want-pin / active-pin
// family, and the move-arc. Composed from transparent renders in
// /public/sky so each layer can MOVE — bobbing islands, drifting clouds,
// a traveling pulse along the dotted path, pointer parallax on desktop,
// golden sunlight as a soft glow. memory: project_pin_grammar.
//
// Two patterns shown:
//   1. HERO — the common background world (usable across bare pages)
//   2. CARDS — close-up asset encapsulating a message (want vs active)

import { useEffect, useRef } from 'react';

// the move-arc: a quadratic bezier in viewport-% space, home → destination.
// Routed HIGH so the arc flies over the copy, never through it.
function arcDots(n: number) {
  const p0 = { x: 13, y: 48 }, p1 = { x: 48, y: -8 }, p2 = { x: 87, y: 20 };
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
    return { x, y, t };
  });
}

export default function SkyPage() {
  const worldRef = useRef<HTMLDivElement>(null);

  // pointer parallax (desktop) — sets CSS vars the layers read
  useEffect(() => {
    const el = worldRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: MouseEvent) => {
      const mx = (e.clientX / window.innerWidth - 0.5) * 2;
      const my = (e.clientY / window.innerHeight - 0.5) * 2;
      el.style.setProperty('--mx', mx.toFixed(3));
      el.style.setProperty('--my', my.toFixed(3));
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const dots = arcDots(11);

  return (
    <div className="sky-page">
      {/* ════ 1. HERO — the world, alive ════ */}
      <section className="sky-hero" ref={worldRef}>
        {/* sunlight */}
        <div className="sky-sun" />

        {/* far clouds — slow sway, each a different shape */}
        <img src="/sky/cloud.png" alt="" className="sky-cloud far c1" />
        <img src="/sky/cloud-chunky.png" alt="" className="sky-cloud far c2" />

        {/* the two plots */}
        <div className="sky-par" style={{ ['--depth' as string]: '14' }}>
          <img src="/sky/island-home.png" alt="" className="sky-island home" />
        </div>
        <div className="sky-par" style={{ ['--depth' as string]: '26' }}>
          <img src="/sky/island-pin.png" alt="" className="sky-island dest" />
        </div>

        {/* the move-arc — pulse travels home → destination */}
        {dots.map((d, i) => (
          <span
            key={i}
            className="sky-dot"
            style={{
              left: `${d.x}%`,
              top: `${d.y}%`,
              width: 7 + 4 * Math.sin(d.t * Math.PI),
              height: 7 + 4 * Math.sin(d.t * Math.PI),
              animationDelay: `${i * 0.22}s`,
            }}
          />
        ))}

        {/* near cloud — crosses the scene */}
        <img src="/sky/cloud-long.png" alt="" className="sky-cloud near c3" />

        {/* the message */}
        <div className="sky-copy">
          <div className="sky-eyebrow">Real estate interconnector</div>
          <h1 className="font-headline sky-h1">Post your move.</h1>
          <p className="sky-sub">
            Tell us where you&apos;d go and what you&apos;ve got. We&apos;ll work
            the map for a real connection.
          </p>
          <a href="/post" className="sky-cta">Get started</a>
        </div>
      </section>

      {/* ════ 2. CARDS — asset encapsulates the message ════ */}
      <section className="sky-cards">
        <div className="sky-card">
          <img src="/sky/pin-want.png" alt="" className="sky-card-img bob-a" />
          <h2 className="font-headline sky-card-h">A move, declared.</h2>
          <p className="sky-card-p">
            The blue pin is a person&apos;s posted intention — someone real wants
            to be here. Not a listing. A want.
          </p>
        </div>
        <div className="sky-card">
          <img src="/sky/pin-active.png" alt="" className="sky-card-img bob-b" />
          <h2 className="font-headline sky-card-h">A home, live.</h2>
          <p className="sky-card-p">
            The house-pin is an Active — a property its agent put on the map,
            offers welcome, deal room attached.
          </p>
        </div>
      </section>

      <style>{`
        .sky-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #bfd4f2 0%, #d4e3f9 46%, #e9f1fc 100%);
          overflow-x: hidden;
        }

        /* ── hero world ── */
        .sky-hero {
          --mx: 0; --my: 0;
          position: relative;
          /* 86svh, not 100 — the cards PEEK above the fold and invite the scroll */
          height: max(86svh, 540px);
          overflow: hidden;
        }
        .sky-sun {
          position: absolute; inset: 0;
          background:
            radial-gradient(26vw 26vw at 86% 6%, rgba(255,240,210,0.42), rgba(255,240,210,0) 68%),
            radial-gradient(60vw 36vh at 84% 0%, rgba(255,248,232,0.22), rgba(255,248,232,0) 58%);
          pointer-events: none;
        }

        /* parallax wrapper: outer moves with pointer, inner floats */
        .sky-par {
          position: absolute; inset: 0;
          transform: translate(calc(var(--mx) * var(--depth) * 1px),
                               calc(var(--my) * var(--depth) * 0.6px));
          transition: transform 0.25s ease-out;
          pointer-events: none;
        }

        .sky-island { position: absolute; }
        .sky-island.home {
          left: -4%; bottom: -2%;
          width: clamp(280px, 42vw, 620px);
          animation: bob 7s ease-in-out infinite;
        }
        .sky-island.dest {
          right: -1%; top: 14%;
          width: clamp(170px, 24vw, 360px);
          animation: bob 9s ease-in-out 1.2s infinite;
        }

        .sky-dot {
          position: absolute;
          border-radius: 50%;
          background: #3565e0;
          box-shadow: 0 2px 8px rgba(19,73,212,0.28);
          transform: translate(-50%, -50%) scale(0.7);
          opacity: 0.45;
          animation: travel 2.6s ease-in-out infinite;
          pointer-events: none;
        }

        .sky-cloud { position: absolute; pointer-events: none; }
        .sky-cloud.far { opacity: 0.85; }
        .sky-cloud.c1 { left: 6%; top: 8%; width: clamp(110px, 14vw, 220px); animation: sway 26s ease-in-out infinite; }
        .sky-cloud.c2 { right: 14%; top: 44%; width: clamp(80px, 10vw, 150px); opacity: 0.75; animation: sway 34s ease-in-out 4s infinite reverse; }
        .sky-cloud.near {
          bottom: 10%; width: clamp(220px, 26vw, 420px);
          filter: blur(0.6px); opacity: 0.95;
          animation: cross 110s linear infinite;
        }

        /* ── the message ── */
        .sky-copy {
          position: relative; z-index: 5;
          max-width: 560px;
          margin: 0 auto;
          padding: max(24svh, 180px) 24px 0;
          text-align: center;
        }
        .sky-eyebrow {
          font-size: 11px; font-weight: 800;
          letter-spacing: 0.35em; text-transform: uppercase;
          color: var(--plot-brand, #1349d4);
        }
        .sky-h1 {
          margin-top: 10px;
          font-size: clamp(2.4rem, 6vw, 4rem);
          font-weight: 800; line-height: 1.05;
          color: var(--plot-ink, #0c1322);
        }
        .sky-sub {
          margin-top: 14px;
          font-size: clamp(0.95rem, 1.6vw, 1.1rem);
          line-height: 1.6; color: #46536b;
        }
        .sky-cta {
          display: inline-block; margin-top: 26px;
          padding: 14px 34px; border-radius: 999px;
          background: var(--plot-brand, #1349d4); color: #fff;
          font-weight: 700; font-size: 15px; text-decoration: none;
          box-shadow: 0 14px 30px -12px rgba(19,73,212,0.65);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .sky-cta:hover { transform: translateY(-2px); box-shadow: 0 18px 34px -12px rgba(19,73,212,0.7); }

        /* ── cards ── */
        .sky-cards {
          display: grid; gap: 22px;
          grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
          max-width: 860px; margin: 0 auto;
          padding: 26px 24px 96px;
        }
        .sky-card {
          background: rgba(255,255,255,0.75);
          border: 1px solid rgba(19,73,212,0.10);
          border-radius: 28px;
          padding: 30px 28px 34px;
          text-align: center;
          backdrop-filter: blur(6px);
          box-shadow: 0 20px 48px -32px rgba(20,50,120,0.45);
        }
        .sky-card-img { width: 170px; margin: -66px auto 4px; display: block; }
        .bob-a { animation: bob 6s ease-in-out infinite; }
        .bob-b { animation: bob 7s ease-in-out 0.8s infinite; }
        .sky-card-h { font-size: 1.35rem; font-weight: 800; color: var(--plot-ink, #0c1322); }
        .sky-card-p { margin-top: 8px; font-size: 0.92rem; line-height: 1.55; color: #46536b; }

        /* ── motion ── */
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }
        @keyframes sway {
          0%, 100% { transform: translateX(0); }
          50%      { transform: translateX(3.5vw); }
        }
        @keyframes cross {
          from { left: -26vw; }
          to   { left: 110vw; }
        }
        @keyframes travel {
          0%, 100% { opacity: 0.45; transform: translate(-50%,-50%) scale(0.7); }
          18%      { opacity: 1;    transform: translate(-50%,-50%) scale(1.1); }
          40%      { opacity: 0.55; transform: translate(-50%,-50%) scale(0.8); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sky-island, .sky-cloud, .sky-dot, .sky-card-img { animation: none !important; }
          .sky-par { transform: none !important; }
          .sky-dot { opacity: 0.8; transform: translate(-50%,-50%) scale(1); }
        }

        /* mobile: let the world breathe around the copy */
        @media (max-width: 640px) {
          .sky-island.home { left: -18%; bottom: -4%; width: 78vw; }
          .sky-island.dest { right: -8%; top: 10%; width: 44vw; }
          .sky-copy { padding-top: 38svh; }
          .sky-card-img { width: 140px; margin-top: -56px; }
        }
      `}</style>
    </div>
  );
}
