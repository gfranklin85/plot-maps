'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// THE mobile flight HUD (Greg, 2026-07-15): the top-left HAMBURGER (nav +
// flight-mode picker + fullscreen + speed slider). The map itself has TWO
// modes, picked here:
//   • 'google' — bare Google native controls (one-finger look/pan/rotate,
//     pinch-zoom). THE main method.
//   • 'cruise' — invisible bottom thumb-zones (rendered by FlightZones in
//     page.tsx) fly ON TOP of Google's native look.
// Nothing else on the map. memory/project_mobile_map_google_native

import { useState } from 'react';
import type { CSSProperties } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

// Flight-speed slider range (mirrors useFlightTuning AXIS_RANGES.multiplier:
// 0.52..11 — top end ≈ 1000 mph ground speed, altitude-scaled).
const SPEED_MIN = 0.52;
const SPEED_MAX = 11;

interface Props {
  mode: 'google' | 'cruise';            // which flight mode is active
  onSelectMode: (m: 'google' | 'cruise') => void;
  isFullscreen?: boolean;
  onFullscreen?: () => void;
  speedMultiplier: number;
  onSpeedMultiplier: (v: number) => void;
}

const NAV = [
  { href: '/home', icon: 'home', label: 'Home' },
  { href: '/map?view=3d', icon: 'map', label: 'Map' },
  { href: '/post', icon: 'add_location_alt', label: 'Post a Move' },
  { href: '/connections', icon: 'hub', label: 'Connections' },
  { href: '/documents', icon: 'description', label: 'Documents' },
  { href: '/my-request', icon: 'explore', label: 'My Requests' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

export default function MobileFlightHUD({ mode, onSelectMode, isFullscreen, onFullscreen, speedMultiplier, onSpeedMultiplier }: Props) {
  const [menu, setMenu] = useState(false);
  const nativeGoogle = mode === 'google';
  const speedFill = { '--fill': `${((speedMultiplier - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%` } as CSSProperties;
  const speedLabel = speedMultiplier < 1 ? 'Slow' : speedMultiplier < 2.5 ? 'Cruise' : speedMultiplier < 6 ? 'Fast' : 'Warp';

  return (
    <>
      {/* ── HAMBURGER (top-left) ── */}
      <button className="mtb-burger mtb-burger--solo" aria-label="Menu" onClick={() => setMenu(true)}>
        <MaterialIcon icon="menu" className="text-[22px]" />
      </button>

      {/* ── slide-down menu: search + nav + flight speed ── */}
      {menu && (
        <div className="mtb-menu" onClick={() => setMenu(false)}>
          <div className="mtb-menu__sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mtb-menu__head">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/plotmaps-logo.svg" alt="PlotMaps" className="mtb-menu__logo" />
              <button className="mtb-menu__x" aria-label="Close" onClick={() => setMenu(false)}>
                <MaterialIcon icon="close" className="text-[22px]" />
              </button>
            </div>
            <div className="mtb-menu__search">
              <MaterialIcon icon="search" className="text-[18px] mtb-menu__search-ic" />
              <input className="mtb-menu__search-in" placeholder="Search a place" inputMode="search" />
            </div>
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="mtb-menu__item">
                <MaterialIcon icon={n.icon} className="text-[20px]" />
                <span>{n.label}</span>
              </a>
            ))}

            {/* ── FLIGHT MODE ── Google native (main method) + Cruise flight. ── */}
            <div className="mtb-menu__section">Flight mode</div>
            <button
              className={`mtb-menu__item mtb-menu__mode ${nativeGoogle ? 'is-on' : ''}`}
              onClick={() => { onSelectMode('google'); setMenu(false); }}
            >
              <MaterialIcon icon="explore" className="text-[20px]" />
              <span className="mtb-menu__mode-txt">
                <span>Explore (Google)</span>
                <span className="mtb-menu__mode-sub">One finger to look &amp; move · pinch to zoom</span>
              </span>
              {nativeGoogle && <MaterialIcon icon="check" className="text-[18px] mtb-menu__check" />}
            </button>
            <button
              className={`mtb-menu__item mtb-menu__mode ${!nativeGoogle ? 'is-on' : ''}`}
              onClick={() => { onSelectMode('cruise'); setMenu(false); }}
            >
              <MaterialIcon icon="flight" className="text-[20px]" />
              <span className="mtb-menu__mode-txt">
                <span>Cruise (Plot flight)</span>
                <span className="mtb-menu__mode-sub">Press bottom-left to fly · bottom-right to climb</span>
              </span>
              {!nativeGoogle && <MaterialIcon icon="check" className="text-[18px] mtb-menu__check" />}
            </button>

            {/* ── VIEW ── fullscreen lives here after the one-time prompt ── */}
            <div className="mtb-menu__section">View</div>
            <button className="mtb-menu__item" onClick={() => { onFullscreen?.(); setMenu(false); }}>
              <MaterialIcon icon={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} className="text-[20px]" />
              <span>{isFullscreen ? 'Exit fullscreen' : 'Go fullscreen'}</span>
            </button>

            {/* flight speed — only relevant to OUR flight loop, not Google's */}
            {!nativeGoogle && (
              <>
                <div className="mtb-menu__section">Flight speed</div>
                <div className="mtb-menu__speed">
                  <div className="mtb-menu__speed-row">
                    <span>Slow → Warp</span>
                    <span className="mtb-menu__speed-val">{speedLabel}</span>
                  </div>
                  <input
                    className="mtb-menu__slider" type="range"
                    min={SPEED_MIN} max={SPEED_MAX} step={0.05}
                    value={speedMultiplier} style={speedFill}
                    onChange={(e) => onSpeedMultiplier(+e.target.value)}
                  />
                  <div className="mtb-menu__speed-ticks"><span>Slow</span><span>Cruise</span><span>Warp</span></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* The Cruise flight controls are INVISIBLE bottom thumb-zones, rendered
          by <FlightZones> in page.tsx — nothing on-screen here. */}
    </>
  );
}
