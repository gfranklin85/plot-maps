'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// The mobile flight HUD, leaned all the way out (Greg, 2026-07-11). Two
// pieces, nothing else:
//
//   • a single HAMBURGER button (top-left) → a slide-down menu holding
//     SEARCH + the app nav. The always-on search bar was eating the map,
//     so it lives in the menu now.
//   • the BOTTOM CONTROLS: the two sticks (PAN · CLIMB/DIP · LOOK),
//     transparent so the map shows through.
//
// SELECT is just TAP — people know to tap. A real touch on the map fires a
// trusted gmp-click → the parcel awakens, the blue polygon draws, and the
// property card opens (same path desktop uses). No reticle, no laser, no
// shoot button, no mode chip. memory/project_phone_as_controller

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import FlightControls from './FlightControls';
import { useTiltFly } from '@/lib/useTiltFly';

const NAV = [
  { href: '/home', icon: 'home', label: 'Home' },
  { href: '/map?view=3d', icon: 'map', label: 'Map' },
  { href: '/post', icon: 'add_location_alt', label: 'Post a Move' },
  { href: '/connections', icon: 'hub', label: 'Connections' },
  { href: '/documents', icon: 'description', label: 'Documents' },
  { href: '/my-request', icon: 'explore', label: 'My Requests' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

export default function MobileFlightHUD() {
  const [menu, setMenu] = useState(false);
  const tilt = useTiltFly();

  return (
    <>
      {/* ── HAMBURGER (top-left, floats over the map) ── */}
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
          </div>
        </div>
      )}

      {/* ── BOTTOM CONTROLS (transparent over the full-bleed map) ── */}
      <div className="mfh">
        <div className="mfh-controls">
          <FlightControls style="sticks" tilt={tilt} />
        </div>
      </div>

      {/* ── TILT CALIBRATION countdown ("set your level": 3 · 2 · 1 · Set) ──
          Fires on first stick touch, or a double-tap on a knob. */}
      {tilt.countdown !== null && (
        <div className="mfh-tiltcal">
          <div className="mfh-tiltcal__card">
            <MaterialIcon icon="screen_rotation_alt" className="text-[26px]" />
            <div className="mfh-tiltcal__num">{tilt.countdown === 0 ? 'Set' : tilt.countdown}</div>
            <div className="mfh-tiltcal__hint">
              {tilt.countdown === 0 ? 'Level locked — tilt to climb' : 'Hold your phone comfortably…'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
