'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// NO BUTTONS, NO DIVIDER, FULL-PAGE map (Greg, 2026-07-12). Control is the
// TOUCHES themselves on a transparent full-screen gesture pad:
//   1 finger  = PAN (floating throttle: forward/back/strafe)
//   2 fingers = PAN + LOOK
//   3 fingers = PAN + CLIMB
// (Handled by useGestureFlight in the map page, attached to #mfh-gesture.)
//
// This HUD is just the top-left HAMBURGER (nav + flight controls) + the
// transparent gesture pad. NOTHING on the map surface. memory/project_tilt_to_fly

import { useState } from 'react';
import type { CSSProperties } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

// Flight-speed slider range (mirrors useFlightTuning AXIS_RANGES.multiplier:
// 0.52..11 — top end ≈ 1000 mph ground speed, altitude-scaled).
const SPEED_MIN = 0.52;
const SPEED_MAX = 11;

export type FlightControlMode = 'gesture' | 'google';

interface Props {
  flightControlMode: FlightControlMode;
  onFlightControlMode: (m: FlightControlMode) => void;
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

export default function MobileFlightHUD({
  flightControlMode, onFlightControlMode, speedMultiplier, onSpeedMultiplier,
}: Props) {
  const [menu, setMenu] = useState(false);
  const speedFill = { '--fill': `${((speedMultiplier - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100}%` } as CSSProperties;
  // a friendly speed label: multiplier → rough "top ground speed" feel
  const speedLabel = speedMultiplier < 1 ? 'Slow' : speedMultiplier < 2.5 ? 'Cruise' : speedMultiplier < 6 ? 'Fast' : 'Warp';

  return (
    <>
      {/* ── HAMBURGER (top-left, floats over the map, above the gesture pad) ── */}
      <button className="mtb-burger mtb-burger--solo" aria-label="Menu" onClick={() => setMenu(true)}>
        <MaterialIcon icon="menu" className="text-[22px]" />
      </button>

      {/* ── slide-down menu: search + nav ── */}
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

            {/* ── FLIGHT CONTROLS ── */}
            <div className="mtb-menu__section">Flying</div>
            <div className="mtb-menu__seg">
              <button
                className={`mtb-menu__segbtn ${flightControlMode === 'gesture' ? 'is-on' : ''}`}
                onClick={() => onFlightControlMode('gesture')}
              >
                <MaterialIcon icon="flight" className="text-[17px]" /> Gesture flight
              </button>
              <button
                className={`mtb-menu__segbtn ${flightControlMode === 'google' ? 'is-on' : ''}`}
                onClick={() => onFlightControlMode('google')}
              >
                <MaterialIcon icon="map" className="text-[17px]" /> Google controls
              </button>
            </div>

            {flightControlMode === 'gesture' && (
              <div className="mtb-menu__speed">
                <div className="mtb-menu__speed-row">
                  <span>Flight speed</span>
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
            )}
          </div>
        </div>
      )}

      {/* ── GESTURE PAD — transparent full-screen overlay over the map.
           useGestureFlight (map page) owns its touch:
           1 finger = pan · 2 = pan+look · 3 = pan+climb. ── */}
      <div className="mfh mfh-gesture" id="mfh-gesture" />
    </>
  );
}
