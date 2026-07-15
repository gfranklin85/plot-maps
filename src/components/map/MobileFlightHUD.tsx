'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// THE mobile flight surface (Greg, 2026-07-14): GOOGLE'S native controls own
// the whole screen (one-finger look/pan/rotate, pinch-zoom). We overlay only:
//   • the top-left HAMBURGER (nav + a flight-speed slider), and
//   • two BUNGEE-TETHER squares — PAN (2D: fwd/back + strafe) and CLIMB
//     (vertical) — that pull like rubber bands and snap home.
// Nothing else on the map. The squares capture only their own touch, so the
// hamburger and Google get everything else. memory/project_tilt_to_fly

import { useState } from 'react';
import type { CSSProperties } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import TetherSquare from './TetherSquare';

// Flight-speed slider range (mirrors useFlightTuning AXIS_RANGES.multiplier:
// 0.52..11 — top end ≈ 1000 mph ground speed, altitude-scaled).
const SPEED_MIN = 0.52;
const SPEED_MAX = 11;

interface Props {
  speedMultiplier: number;
  onSpeedMultiplier: (v: number) => void;
  onPan: (active: boolean, dx: number, dy: number) => void;
  onClimb: (active: boolean, dy: number) => void;
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

export default function MobileFlightHUD({ speedMultiplier, onSpeedMultiplier, onPan, onClimb }: Props) {
  const [menu, setMenu] = useState(false);
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

            {/* flight speed */}
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
          </div>
        </div>
      )}

      {/* ── TETHER SQUARES — the only flight controls on the map ── */}
      <TetherSquare axis="both" label="PAN" icon="open_with" className="tsq--pan"
        onChange={(a, dx, dy) => onPan(a, dx, dy)} />
      <TetherSquare axis="vertical" label="CLIMB" icon="height" className="tsq--climb"
        onChange={(a, _dx, dy) => onClimb(a, dy)} />
    </>
  );
}
