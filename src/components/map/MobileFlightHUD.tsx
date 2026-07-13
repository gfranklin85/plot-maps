'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// NO BUTTONS (Greg, 2026-07-12). Control is the TOUCHES themselves (Windows
// Precision-Touchpad style) on the gesture pad below the letterbox map:
//   1 finger  = PAN (floating throttle)
//   2 fingers = PAN + LOOK
//   3 fingers = PAN + CLIMB
// (Handled by useGestureFlight in the map page, attached to .mfh-gesture.)
//
// This HUD is now just: the top-left HAMBURGER (nav), the SIZE DIVIDER (drag
// the map/control split), and the gesture PAD surface + a fading hint.
// memory/project_tilt_to_fly

import { useEffect, useRef, useState } from 'react';
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

const LS_MAPFRAC = 'plotmaps.mobileMapFrac2';

// portrait size divider: the MAP's height as a fraction of viewport (from the
// top). Default 0.35 = a YouTube-style landscape letterbox; drag DOWN to open
// the map bigger, up to shrink back. The gesture pad fills below it.
const MIN_FRAC = 0.28, MAX_FRAC = 0.75, DEFAULT_FRAC = 0.35;

export default function MobileFlightHUD() {
  const [menu, setMenu] = useState(false);
  const [frac, setFrac] = useState(DEFAULT_FRAC);
  const [hintGone, setHintGone] = useState(false);

  useEffect(() => {
    try {
      const f = parseFloat(localStorage.getItem(LS_MAPFRAC) || '');
      if (Number.isFinite(f)) setFrac(Math.min(MAX_FRAC, Math.max(MIN_FRAC, f)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--map-h', `${(frac * 100).toFixed(1)}vh`);
    try { localStorage.setItem(LS_MAPFRAC, String(frac)); } catch { /* ignore */ }
  }, [frac]);

  // ── size divider: drag DOWN → map grows; up → back toward letterbox ──
  const dragging = useRef(false);
  const startY = useRef(0);
  const startFrac = useRef(DEFAULT_FRAC);
  const onGripDown = (e: React.PointerEvent) => {
    dragging.current = true; startY.current = e.clientY; startFrac.current = frac;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId); e.preventDefault();
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = e.clientY - startY.current; // DOWN (dy>0) = grow the map
    setFrac(Math.min(MAX_FRAC, Math.max(MIN_FRAC, startFrac.current + dy / window.innerHeight)));
    e.preventDefault();
  };
  const onGripUp = () => { dragging.current = false; };

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

      {/* ── SIZE DIVIDER — sits on the map/gesture-pad seam; drag DOWN to grow
           the map, up to shrink toward letterbox. ── */}
      <div
        className="mfh-grip"
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        aria-label="Resize map"
      >
        <div className="mfh-grip__bar" />
      </div>

      {/* ── GESTURE PAD — the invisible control surface below the map.
           useGestureFlight (in the map page) attaches to this element:
           1 finger = pan · 2 = pan+look · 3 = pan+climb. No buttons. ── */}
      <div className="mfh mfh-gesture" id="mfh-gesture" onPointerDown={() => setHintGone(true)}>
        {!hintGone && (
          <div className="mfh-hint">
            <span><b>1 finger</b> — fly &amp; strafe</span>
            <span><b>2 fingers</b> — look around</span>
            <span><b>3 fingers</b> — climb / descend</span>
          </div>
        )}
      </div>
    </>
  );
}
