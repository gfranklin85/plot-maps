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
// This HUD is just the top-left HAMBURGER (nav) + the gesture pad + a fading
// legend. memory/project_tilt_to_fly

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

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
