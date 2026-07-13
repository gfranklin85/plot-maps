'use client';

// ── SkyWorld — the reusable Floating Plots background ─────────────────
//
// The brand world built on /sky, extracted so any gate/hero can wear it:
// two edge islands (current home ← path → next move) linked by a flowing
// beaded path, floating label chips, drifting clouds, golden sun glow.
// Coordinated blues (interactive #1349d4, ink #122d8d). Renders BEHIND
// its children (the copy/CTA sit in .sky-world__stage). One-viewport ready.
// memory: project_pin_grammar, feedback_brand_fidelity.

import type { ReactNode } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function SkyWorld({ children }: { children: ReactNode }) {
  return (
    <div className="sky-world">
      <div className="sky-world__sun" />

      <img src="/sky/cloud.png" alt="" className="sky-world__cloud c1" />
      <img src="/sky/cloud-chunky.png" alt="" className="sky-world__cloud c2" />
      <img src="/sky/cloud-long.png" alt="" className="sky-world__cloud c3" />

      <svg className="sky-world__path" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden>
        <path
          id="skyMovePath"
          d="M 55 180 C 250 130, 360 250, 500 225 S 770 130, 945 120"
          fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.85"
        />
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} r="6" fill="#ffffff">
            <animateMotion dur="7s" begin={`${i * 1.75}s`} repeatCount="indefinite" rotate="auto">
              <mpath href="#skyMovePath" />
            </animateMotion>
          </circle>
        ))}
      </svg>

      <div className="sky-world__side left">
        <span className="sky-world__label">
          <span className="sky-world__label-ic"><MaterialIcon icon="home" className="text-[16px]" /></span>
          <span className="sky-world__label-txt"><b>Current home</b>Your current position</span>
        </span>
        <img src="/sky/island-home.png" alt="" className="sky-world__island home" />
      </div>

      <div className="sky-world__side right">
        <span className="sky-world__label">
          <span className="sky-world__label-ic"><MaterialIcon icon="location_on" className="text-[16px]" /></span>
          <span className="sky-world__label-txt"><b>Next move</b>Your destination</span>
        </span>
        <img src="/sky/island-pin.png" alt="" className="sky-world__island dest" />
      </div>

      <div className="sky-world__stage">{children}</div>

      <style>{`
        .sky-world {
          position: relative; flex: 1; min-height: 0; overflow: hidden;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .sky-world__sun {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(24vw 24vw at 88% 4%, rgba(255,243,218,0.4), rgba(255,243,218,0) 68%);
        }
        .sky-world__path { position: absolute; left: 0; right: 0; top: 42%; width: 100%; height: 40%; pointer-events: none; z-index: 1; }

        .sky-world__side { position: absolute; pointer-events: none; z-index: 2; }
        .sky-world__side.left  { left: 0;  top: 30%; }
        .sky-world__side.right { right: 0; top: 34%; }
        .sky-world__island { display: block; }
        .sky-world__island.home { width: clamp(230px, 27vw, 430px); margin-left: -5%; animation: skyBob 7s ease-in-out infinite; }
        .sky-world__island.dest { width: clamp(190px, 22vw, 350px); margin-right: -4%; margin-left: auto; animation: skyBob 9s ease-in-out 1.2s infinite; }

        .sky-world__label {
          position: absolute; z-index: 3;
          display: inline-flex; align-items: center; gap: 10px;
          padding: 9px 14px 9px 10px; border-radius: 14px;
          background: rgba(255,255,255,0.92);
          box-shadow: -8px 16px 30px -16px rgba(20,50,120,0.5);
          backdrop-filter: blur(4px); white-space: nowrap;
          animation: skyBob 7s ease-in-out infinite;
        }
        .sky-world__side.left  .sky-world__label { top: 14%; left: 20%; }
        .sky-world__side.right .sky-world__label { top: 6%; right: 10%; }
        .sky-world__label-ic { width: 30px; height: 30px; border-radius: 9px; flex: none; display: flex; align-items: center; justify-content: center; background: var(--plot-brand-soft, #e0e7fb); color: var(--plot-brand, #1349d4); }
        .sky-world__label-txt { display: flex; flex-direction: column; line-height: 1.2; font-size: 11px; color: #6b7699; }
        .sky-world__label-txt b { font-size: 12.5px; color: var(--plot-brand-deep, #122d8d); font-weight: 800; }

        .sky-world__cloud { position: absolute; pointer-events: none; z-index: 0; }
        .sky-world__cloud.c1 { left: 18%; top: 14%; width: clamp(90px, 11vw, 170px); opacity: 0.85; animation: skySway 30s ease-in-out infinite; }
        .sky-world__cloud.c2 { right: 24%; top: 10%; width: clamp(70px, 8vw, 130px); opacity: 0.7; animation: skySway 38s ease-in-out 5s infinite reverse; }
        .sky-world__cloud.c3 { left: 4%; bottom: 6%; width: clamp(150px, 17vw, 290px); opacity: 0.9; animation: skySway 46s ease-in-out 8s infinite; }

        .sky-world__stage { position: relative; z-index: 5; max-width: 560px; padding: 0 24px; text-align: center; }

        @keyframes skyBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-13px); } }
        @keyframes skySway { 0%,100% { transform: translateX(0); } 50% { transform: translateX(3vw); } }
        @media (prefers-reduced-motion: reduce) {
          .sky-world__island, .sky-world__cloud, .sky-world__label { animation: none !important; }
          .sky-world__path circle { display: none; }
        }
        @media (max-width: 720px) {
          .sky-world__side.left  { top: auto; bottom: 4%; }
          .sky-world__side.right { top: 9%; }
          .sky-world__island.home { width: 52vw; margin-left: -14%; }
          .sky-world__island.dest { width: 40vw; margin-right: -10%; }
          .sky-world__label { display: none; }
          .sky-world__path { top: 46%; }
        }
      `}</style>
    </div>
  );
}
