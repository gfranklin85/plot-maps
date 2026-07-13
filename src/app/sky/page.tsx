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

import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotMark from '@/components/ui/PlotMark';
import AppHeader from '@/components/layout/AppHeader';

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
  const dots = arcDots(11);

  return (
    <div className="sky-page">
      {/* the shared marketing chrome — same header as every public surface */}
      <AppHeader variant="public" />

      {/* ════ 1. HERO — the world, alive (ambient motion only) ════ */}
      <section className="sky-hero">
        {/* sunlight */}
        <div className="sky-sun" />

        {/* clouds — different shapes, gentle sway; ALL behind the islands */}
        <img src="/sky/cloud.png" alt="" className="sky-cloud far c1" />
        <img src="/sky/cloud-chunky.png" alt="" className="sky-cloud far c2" />
        <img src="/sky/cloud-long.png" alt="" className="sky-cloud mid c3" />

        {/* the two plots */}
        <img src="/sky/island-home.png" alt="" className="sky-island home" />
        <img src="/sky/island-pin.png" alt="" className="sky-island dest" />

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

        {/* the message — the REAL /post copy, word for word */}
        <div className="sky-copy">
          <span className="sky-badge">
            <PlotMark size={15} /> Real Estate Interconnector
          </span>
          <h1 className="font-headline sky-h1">Post your move.</h1>
          <p className="sky-sub">
            For owners ready to make a move: tell us where you&apos;d go and what
            you&apos;ve got, and we&apos;ll work the map for a real connection — a direct
            match or a multi-home move path. Private until you say otherwise.
          </p>
          <a href="/post" className="sky-cta">
            <MaterialIcon icon="login" className="text-[18px]" /> Continue with Google
          </a>
          <p className="sky-fine">
            <MaterialIcon icon="lock" className="text-[13px]" />
            We ask you to sign in so every request is real — no spam, no selling your info.
          </p>
          <p className="sky-buyer">
            Looking to buy but don&apos;t own yet? <a href="/position">That&apos;s the buyers path →</a>
          </p>
        </div>

        {/* the pin-grammar cards — pinned to the bottom of the SAME viewport
            (one screen, no scroll) as compact strips */}
        <div className="sky-cards">
          <div className="sky-card">
            <img src="/sky/pin-want.png" alt="" className="sky-card-img bob-a" />
            <div className="sky-card-txt">
              <h2 className="font-headline sky-card-h">A move, declared.</h2>
              <p className="sky-card-p">
                The blue pin is a posted intention — someone real wants to be
                here. Not a listing. A want.
              </p>
            </div>
          </div>
          <div className="sky-card">
            <img src="/sky/pin-active.png" alt="" className="sky-card-img bob-b" />
            <div className="sky-card-txt">
              <h2 className="font-headline sky-card-h">A home, live.</h2>
              <p className="sky-card-p">
                The house-pin is an Active — posted by its agent, offers
                welcome, deal room attached.
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        /* ONE VIEWPORT, NO SCROLL — the whole page is a single held frame:
           header + world + cards locked to 100svh. */
        .sky-page {
          height: 100svh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, #bfd4f2 0%, #d4e3f9 46%, #e9f1fc 100%);
          overflow: hidden;
        }

        /* ── hero world — fills everything under the header ── */
        .sky-hero {
          --mx: 0; --my: 0;
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        .sky-sun {
          position: absolute; inset: 0;
          background:
            radial-gradient(26vw 26vw at 86% 6%, rgba(255,240,210,0.42), rgba(255,240,210,0) 68%),
            radial-gradient(60vw 36vh at 84% 0%, rgba(255,248,232,0.22), rgba(255,248,232,0) 58%);
          pointer-events: none;
        }

        .sky-island { position: absolute; pointer-events: none; }
        .sky-island.home {
          left: 2%; bottom: 16%;
          width: clamp(190px, 24vw, 360px);
          opacity: 0.96;
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
        .sky-cloud.mid.c3 {
          /* open air low-right, below the destination island — clear of the
             copy, the cards, and (crucially) not "weather over the house" */
          right: 6%; bottom: 7%;
          width: clamp(170px, 19vw, 320px);
          opacity: 0.9;
          animation: sway 44s ease-in-out 8s infinite;
        }

        /* ── the message ── */
        .sky-copy {
          position: relative; z-index: 5;
          max-width: 560px;
          margin: 0 auto;
          padding: max(7svh, 48px) 24px 0;
          text-align: center;
        }
        .sky-badge {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 18px; border-radius: 999px;
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(19,73,212,0.22);
          font-size: 11.5px; font-weight: 800;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--plot-brand, #1349d4);
          backdrop-filter: blur(4px);
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
          display: inline-flex; align-items: center; gap: 9px;
          margin-top: 26px;
          padding: 15px 34px; border-radius: 14px;
          background: var(--plot-brand, #1349d4); color: #fff;
          font-weight: 700; font-size: 15px; text-decoration: none;
          box-shadow: 0 14px 30px -12px rgba(19,73,212,0.65);
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .sky-cta:hover {
          transform: translateY(-2px);
          background: var(--plot-brand-deep, #122d8d);
          box-shadow: 0 18px 34px -12px rgba(19,73,212,0.7);
        }
        .sky-fine {
          display: flex; align-items: flex-start; justify-content: center; gap: 6px;
          margin-top: 18px;
          font-size: 12.5px; line-height: 1.55; color: #7a86a0;
          max-width: 400px; margin-left: auto; margin-right: auto;
        }
        .sky-buyer { margin-top: 16px; font-size: 13.5px; color: #46536b; }
        .sky-buyer a { color: var(--plot-brand, #1349d4); font-weight: 700; text-decoration: none; }
        .sky-buyer a:hover { text-decoration: underline; }

        /* ── cards ── */
        /* cards: compact strips pinned to the bottom of the same frame */
        .sky-cards {
          position: absolute;
          left: 50%; transform: translateX(-50%);
          bottom: max(16px, 2.5svh);
          width: min(880px, calc(100% - 32px));
          display: grid; gap: 14px;
          grid-template-columns: 1fr 1fr;
          z-index: 6;
        }
        .sky-card {
          display: flex; align-items: center; gap: 14px;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(19,73,212,0.10);
          border-radius: 18px;
          padding: 12px 18px;
          text-align: left;
          backdrop-filter: blur(6px);
          box-shadow: 0 18px 40px -30px rgba(20,50,120,0.45);
        }
        .sky-card-img { width: 62px; flex: none; display: block; }
        .bob-a { animation: bob 6s ease-in-out infinite; }
        .bob-b { animation: bob 7s ease-in-out 0.8s infinite; }
        .sky-card-txt { min-width: 0; }
        .sky-card-h { font-size: 1.02rem; font-weight: 800; color: var(--plot-ink, #0c1322); }
        .sky-card-p { margin-top: 2px; font-size: 0.8rem; line-height: 1.45; color: #46536b; }

        /* ── motion ── */
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-14px); }
        }
        @keyframes sway {
          0%, 100% { transform: translateX(0); }
          50%      { transform: translateX(3.5vw); }
        }
        @keyframes travel {
          0%, 100% { opacity: 0.45; transform: translate(-50%,-50%) scale(0.7); }
          18%      { opacity: 1;    transform: translate(-50%,-50%) scale(1.1); }
          40%      { opacity: 0.55; transform: translate(-50%,-50%) scale(0.8); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sky-island, .sky-cloud, .sky-dot, .sky-card-img { animation: none !important; }
          .sky-dot { opacity: 0.8; transform: translate(-50%,-50%) scale(1); }
        }

        /* mobile: same single frame — compact copy, title-only cards */
        @media (max-width: 640px) {
          .sky-island.home { left: -4%; bottom: 26%; width: 44vw; }
          .sky-island.dest { right: -6%; top: 8%; width: 32vw; }
          .sky-copy { padding-top: max(5svh, 32px); }
          .sky-h1 { font-size: 2.1rem; }
          .sky-card { padding: 10px 12px; gap: 10px; }
          .sky-card-img { width: 40px; }
          .sky-card-h { font-size: 0.88rem; }
          .sky-card-p { display: none; }
        }
      `}</style>
    </div>
  );
}
