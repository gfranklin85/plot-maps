'use client';

// ── PlatTile — the branded no-photo placeholder ───────────────────────
//
// A listing with no photos used to be a dead gray box. Now it's a little
// SURVEYOR'S PLAT — lot lines, one highlighted parcel, the PlotMaps reticle
// at its center. Literally what "PlotMaps" means, so the empty state is
// on-brand instead of broken-looking. Three variants seeded from the listing
// id (plus a mirror flip) so a list of comps doesn't repeat. Greg 2026-07-13.

const INK = 'rgba(19,73,212,0.15)';       // faint lot lines
const INK_HI = 'rgba(19,73,212,0.5)';     // highlighted parcel stroke
const FILL_HI = 'rgba(19,73,212,0.07)';   // highlighted parcel fill

function Reticle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g stroke={INK_HI} strokeWidth="1.3" fill="none">
      <circle cx={cx} cy={cy} r="7" fill="rgba(255,255,255,0.55)" />
      <circle cx={cx} cy={cy} r="1.7" fill="rgba(19,73,212,0.6)" stroke="none" />
      <line x1={cx} y1={cy - 11} x2={cx} y2={cy - 7} />
      <line x1={cx} y1={cy + 7} x2={cx} y2={cy + 11} />
      <line x1={cx - 11} y1={cy} x2={cx - 7} y2={cy} />
      <line x1={cx + 7} y1={cy} x2={cx + 11} y2={cy} />
    </g>
  );
}

// survey ticks along a horizontal edge
function Ticks({ y, x1, x2 }: { y: number; x1: number; x2: number }) {
  const xs = [0.25, 0.5, 0.75].map((t) => x1 + (x2 - x1) * t);
  return (
    <g stroke={INK_HI} strokeWidth="1" opacity="0.55">
      {xs.map((x, i) => <line key={i} x1={x} y1={y - 2.5} x2={x} y2={y + 2.5} />)}
    </g>
  );
}

export default function PlatTile({ seed = '' }: { seed?: string }) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const variant = Math.abs(h) % 3;
  const flip = Math.abs(h >> 3) % 2 === 1;

  return (
    <div className="plat" aria-hidden>
      <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice"
        style={flip ? { transform: 'scaleX(-1)' } : undefined}>
        {variant === 0 && (
          <>
            {/* vertical road, lots to the right */}
            <g stroke={INK} strokeWidth="1" fill="none">
              <line x1="52" y1="0" x2="52" y2="150" />
              <line x1="66" y1="0" x2="66" y2="150" />
              <line x1="66" y1="36" x2="200" y2="36" />
              <line x1="66" y1="74" x2="200" y2="74" />
              <line x1="66" y1="112" x2="200" y2="112" />
              <line x1="0" y1="50" x2="52" y2="50" />
              <line x1="0" y1="100" x2="52" y2="100" />
              <line x1="148" y1="36" x2="148" y2="74" />
            </g>
            <rect x="66" y="36" width="82" height="38" fill={FILL_HI} stroke={INK_HI} strokeWidth="1.4" />
            <Ticks y={36} x1={66} x2={148} />
            <Reticle cx={107} cy={55} />
          </>
        )}
        {variant === 1 && (
          <>
            {/* horizontal road, lots above + below */}
            <g stroke={INK} strokeWidth="1" fill="none">
              <line x1="0" y1="64" x2="200" y2="64" />
              <line x1="0" y1="78" x2="200" y2="78" />
              <line x1="44" y1="0" x2="44" y2="64" />
              <line x1="92" y1="0" x2="92" y2="64" />
              <line x1="144" y1="0" x2="144" y2="64" />
              <line x1="64" y1="78" x2="64" y2="150" />
              <line x1="128" y1="78" x2="128" y2="150" />
            </g>
            <rect x="92" y="8" width="52" height="56" fill={FILL_HI} stroke={INK_HI} strokeWidth="1.4" />
            <Ticks y={8} x1={92} x2={144} />
            <Reticle cx={118} cy={36} />
          </>
        )}
        {variant === 2 && (
          <>
            {/* road on the right, one odd diagonal lot line */}
            <g stroke={INK} strokeWidth="1" fill="none">
              <line x1="140" y1="0" x2="140" y2="150" />
              <line x1="154" y1="0" x2="154" y2="150" />
              <line x1="0" y1="40" x2="140" y2="40" />
              <line x1="0" y1="80" x2="140" y2="80" />
              <line x1="0" y1="118" x2="140" y2="118" />
              <line x1="88" y1="40" x2="140" y2="12" />
              <line x1="88" y1="40" x2="88" y2="80" />
            </g>
            <rect x="0" y="40" width="88" height="40" fill={FILL_HI} stroke={INK_HI} strokeWidth="1.4" />
            <Ticks y={40} x1={0} x2={88} />
            <Reticle cx={44} cy={60} />
          </>
        )}
      </svg>
      <style>{`
        .plat { position: relative; width: 100%; height: 100%; min-height: 150px; overflow: hidden;
          background: linear-gradient(160deg, #f2f7ff 0%, #e5eefc 55%, #d9e7fa 100%); }
        .plat svg { position: absolute; inset: 0; width: 100%; height: 100%; }
      `}</style>
    </div>
  );
}
