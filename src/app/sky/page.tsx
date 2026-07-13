'use client';

// ── /sky — the Floating Plots hero (the "Post your move" gate) ────────
//
// Two floating plot-islands — your CURRENT home (left) and your NEXT move
// (right) — LINKED by a flowing beaded path (the interconnector, drawn).
// Each island carries a floating label chip. One centered CTA + a buyer
// door beneath. Composed from Blender renders in /public/sky; every layer
// moves (islands bob, clouds sway, path beads travel). One viewport, no
// scroll. memory: project_pin_grammar, feedback_one_viewport_pages,
// feedback_brand_fidelity (coordinated blues: ink #122d8d, interactive #1349d4).

import PlotMarkLive from '@/components/ui/PlotMarkLive';
import MaterialIcon from '@/components/ui/MaterialIcon';
import AppHeader from '@/components/layout/AppHeader';

export default function SkyPage() {
  return (
    <div className="sky-page">
      <div className="fp" style={{ flex: 'none' }}>
        <AppHeader variant="public" />
      </div>

      <section className="sky-hero">
        <div className="sky-sun" />

        {/* clouds — behind everything */}
        <img src="/sky/cloud.png" alt="" className="sky-cloud c1" />
        <img src="/sky/cloud-chunky.png" alt="" className="sky-cloud c2" />
        <img src="/sky/cloud-long.png" alt="" className="sky-cloud c3" />

        {/* the connecting path — home → destination, beads travel it */}
        <svg className="sky-path" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden>
          <path
            id="movePath"
            d="M 55 180 C 250 130, 360 250, 500 225 S 770 130, 945 120"
            fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85"
          />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} r="6" fill="#ffffff">
              <animateMotion dur="7s" begin={`${i * 1.75}s`} repeatCount="indefinite" rotate="auto">
                <mpath href="#movePath" />
              </animateMotion>
            </circle>
          ))}
        </svg>

        {/* LEFT island — current home, with its floating label */}
        <div className="sky-side left">
          <span className="sky-label">
            <span className="sky-label__ic"><MaterialIcon icon="home" className="text-[16px]" /></span>
            <span className="sky-label__txt"><b>Current home</b>Your current position</span>
          </span>
          <img src="/sky/island-home.png" alt="" className="sky-island home" />
        </div>

        {/* RIGHT island — next move, with its floating label */}
        <div className="sky-side right">
          <span className="sky-label">
            <span className="sky-label__ic"><MaterialIcon icon="location_on" className="text-[16px]" /></span>
            <span className="sky-label__txt"><b>Next move</b>Your destination</span>
          </span>
          <img src="/sky/island-pin.png" alt="" className="sky-island dest" />
        </div>

        {/* the message — centered */}
        <div className="sky-copy">
          <span className="sky-eyebrow">
            <PlotMarkLive size={17} /> Real Estate Interconnector
          </span>
          <h1 className="font-headline sky-h1">Post your move.</h1>
          <p className="sky-sub">
            Tell us what you have and where you want to go. We&apos;ll work the
            map to uncover direct matches and multi-home move paths.
          </p>

          {/* single CTA (routes to /post → sign-in gate) + buyer door */}
          <a href="/post" className="sky-cta">
            Post your move <span aria-hidden>→</span>
          </a>
          <a href="/position" className="sky-buyer">
            Looking to buy without selling? Start here →
          </a>
        </div>
      </section>

      <style>{`
        .sky-page {
          height: 100svh;
          display: flex; flex-direction: column;
          background: linear-gradient(180deg, #cfe0f6 0%, #dbe8fa 50%, #eaf2fd 100%);
          overflow: hidden;
        }

        .sky-hero {
          position: relative;
          flex: 1; min-height: 0;
          overflow: hidden;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        .sky-sun {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(24vw 24vw at 88% 4%, rgba(255,243,218,0.4), rgba(255,243,218,0) 68%);
        }

        /* the linking path spans the mid-band behind the copy */
        .sky-path {
          position: absolute; left: 0; right: 0; top: 42%;
          width: 100%; height: 40%;
          pointer-events: none; z-index: 1;
        }

        /* island sides — anchored to the edges, vertically centered-ish */
        .sky-side { position: absolute; pointer-events: none; z-index: 2; }
        .sky-side.left  { left: 0;  top: 30%; }
        .sky-side.right { right: 0; top: 34%; }
        .sky-island { display: block; }
        .sky-island.home { width: clamp(230px, 27vw, 430px); margin-left: -5%; animation: bob 7s ease-in-out infinite; }
        .sky-island.dest { width: clamp(190px, 22vw, 350px); margin-right: -4%; margin-left: auto; animation: bob 9s ease-in-out 1.2s infinite; }

        /* floating label chips — shadow falls DOWN-LEFT to match the
           islands' upper-right sun (negative x = leftward). */
        .sky-label {
          position: absolute; z-index: 3;
          display: inline-flex; align-items: center; gap: 10px;
          padding: 9px 14px 9px 10px; border-radius: 14px;
          background: rgba(255,255,255,0.92);
          box-shadow: -8px 16px 30px -16px rgba(20,50,120,0.5);
          backdrop-filter: blur(4px);
          white-space: nowrap;
          animation: bob 7s ease-in-out infinite;
        }
        /* labels hug their islands — just above the top surface */
        .sky-side.left  .sky-label { top: 14%; left: 20%; }
        .sky-side.right .sky-label { top: 6%; right: 10%; }
        .sky-label__ic {
          width: 30px; height: 30px; border-radius: 9px; flex: none;
          display: flex; align-items: center; justify-content: center;
          background: var(--plot-brand-soft, #e0e7fb); color: var(--plot-brand, #1349d4);
        }
        .sky-label__txt { display: flex; flex-direction: column; line-height: 1.2; }
        .sky-label__txt b { font-size: 12.5px; color: var(--plot-brand-deep, #122d8d); font-weight: 800; }
        .sky-label__txt { font-size: 11px; color: #6b7699; }

        /* ── the message (coordinated blues: ink=deep navy, interactive=brand) ── */
        .sky-copy {
          position: relative; z-index: 5;
          max-width: 560px; padding: 0 24px; text-align: center;
        }
        .sky-eyebrow {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11.5px; font-weight: 800;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--plot-brand-deep, #122d8d);
        }
        .sky-h1 {
          margin-top: 10px;
          font-size: clamp(2.6rem, 6.5vw, 4.4rem);
          font-weight: 800; line-height: 1.02; letter-spacing: -0.02em;
          color: var(--plot-brand-deep, #122d8d);
        }
        .sky-sub {
          margin: 16px auto 0; max-width: 460px;
          font-size: clamp(0.98rem, 1.5vw, 1.15rem);
          line-height: 1.55; color: #3a4a72;
        }
        .sky-cta {
          display: inline-flex; align-items: center; gap: 10px;
          margin-top: 30px;
          padding: 16px 38px; border-radius: 14px;
          background: var(--plot-brand, #1349d4); color: #fff;
          font-weight: 700; font-size: 16px; text-decoration: none;
          box-shadow: 0 16px 32px -12px rgba(19,73,212,0.6);
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .sky-cta:hover {
          transform: translateY(-2px);
          background: var(--plot-brand-deep, #122d8d);
          box-shadow: 0 20px 38px -12px rgba(19,73,212,0.65);
        }
        .sky-buyer {
          display: block; margin-top: 20px;
          font-size: 14px; font-weight: 700; text-decoration: none;
          color: var(--plot-brand, #1349d4);
        }
        .sky-buyer:hover { color: var(--plot-brand-deep, #122d8d); }

        .sky-cloud { position: absolute; pointer-events: none; z-index: 0; }
        .sky-cloud.c1 { left: 18%; top: 14%; width: clamp(90px, 11vw, 170px); opacity: 0.85; animation: sway 30s ease-in-out infinite; }
        .sky-cloud.c2 { right: 24%; top: 10%; width: clamp(70px, 8vw, 130px); opacity: 0.7; animation: sway 38s ease-in-out 5s infinite reverse; }
        .sky-cloud.c3 { left: 4%; bottom: 6%; width: clamp(150px, 17vw, 290px); opacity: 0.9; animation: sway 46s ease-in-out 8s infinite; }

        @keyframes bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-13px); } }
        @keyframes sway { 0%,100% { transform: translateX(0); } 50% { transform: translateX(3vw); } }

        @media (prefers-reduced-motion: reduce) {
          .sky-island, .sky-cloud, .sky-label { animation: none !important; }
          .sky-path circle { display: none; }
        }

        /* mobile: islands shrink to the edges, path + labels simplify */
        @media (max-width: 720px) {
          .sky-side.left  { top: auto; bottom: 4%; }
          .sky-side.right { top: 9%; }
          .sky-island.home { width: 52vw; margin-left: -14%; }
          .sky-island.dest { width: 40vw; margin-right: -10%; }
          .sky-label { display: none; }
          .sky-path { top: 46%; }
          .sky-h1 { font-size: 2.3rem; }
        }
      `}</style>
    </div>
  );
}
