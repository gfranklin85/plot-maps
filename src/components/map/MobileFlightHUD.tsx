'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// The mobile flight HUD, leaned out (Greg, 2026-07-11 — "lean it out, not
// full of half-ass shit"). Two pieces, nothing else:
//
//   • TOP BAR (floats over the map): a hamburger menu (holds the app nav —
//     Map / Post a Move / Connections / Documents / account) + a search
//     field + a Tap/Laser SELECT-MODE chip.
//   • BOTTOM CONTROLS: the two sticks (PAN · CLIMB/DIP · LOOK). That's it.
//
// SELECT on mobile (two modes):
//   • Tap  — tap the map like normal. A real touch fires a trusted
//            gmp-click → the parcel awakens and its card opens. No buttons.
//   • Laser — the fixed reticle + a single centered SHOOT button. Shoot
//            dispatches the synthetic gamepad A (buttons[0]) so the flight
//            loop's justPressed('a') runs fireOpenParcel at the reticle,
//            exactly like the controller/desktop path.
//
// CUT (were clutter): the Flight/Explore/fly/Layers/Saved mode row, the
// stick⇄zone-pad style toggle, the drag-grip divider, the floating A/B
// buttons, the PlotMaps bar. Walk mode is parked (design TBD).
// memory/project_phone_as_controller

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { NEUTRAL, pushTouchFrame } from '@/lib/touchPadBridge';
import FlightControls from './FlightControls';

export type SelectMode = 'tap' | 'laser';

// The controls own a fixed band at the bottom (--tzp-h). No longer resizable
// — one clean height. 42vh gives the sticks room without eating the map.
interface Props {
  selectMode: SelectMode;
  onSelectMode: (m: SelectMode) => void;
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

export default function MobileFlightHUD({ selectMode, onSelectMode }: Props) {
  const [menu, setMenu] = useState(false);

  // SHOOT (laser mode) — pulse the synthetic A so the flight loop's
  // justPressed('a') fires fireOpenParcel at the reticle, then release.
  const shoot = () => {
    pushTouchFrame({ ...NEUTRAL, a: true });
    // release next frame so the edge-trigger sees a down→up
    requestAnimationFrame(() => pushTouchFrame({ ...NEUTRAL, a: false }));
  };

  return (
    <>
      {/* ── TOP BAR (floats over the map) ── */}
      <div className="mtb">
        <button className="mtb-burger" aria-label="Menu" onClick={() => setMenu(true)}>
          <MaterialIcon icon="menu" className="text-[22px]" />
        </button>

        <div className="mtb-search">
          <MaterialIcon icon="search" className="text-[18px] mtb-search__ic" />
          <input className="mtb-search__in" placeholder="Search a place" inputMode="search" />
        </div>

        {/* select-mode chip: Tap ⇄ Laser */}
        <button
          className="mtb-mode"
          onClick={() => onSelectMode(selectMode === 'tap' ? 'laser' : 'tap')}
          aria-label="Toggle select mode"
        >
          <MaterialIcon icon={selectMode === 'laser' ? 'my_location' : 'touch_app'} className="text-[18px]" />
          <span>{selectMode === 'laser' ? 'Laser' : 'Tap'}</span>
        </button>
      </div>

      {/* ── slide-down nav menu ── */}
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
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="mtb-menu__item">
                <MaterialIcon icon={n.icon} className="text-[20px]" />
                <span>{n.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── BOTTOM CONTROLS ── */}
      <div className="mfh">
        {/* shoot button — only in laser mode; tap mode taps the map directly */}
        {selectMode === 'laser' && (
          <button
            className="mfh-shoot"
            aria-label="Select parcel at reticle"
            onPointerDown={(e) => { e.stopPropagation(); shoot(); }}
          >
            <MaterialIcon icon="my_location" className="text-[24px]" />
          </button>
        )}
        <div className="mfh-controls">
          <FlightControls style="sticks" />
        </div>
      </div>
    </>
  );
}
