'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// The mobile flight HUD, leaned all the way out (Greg, 2026-07-11/12):
//
//   • a single HAMBURGER (top-left) → menu with SEARCH, the app nav, and the
//     FLIGHT STYLE picker (kept off the map surface, remembered per device).
//   • the BOTTOM CONTROLS: FlightControls in the chosen style, transparent
//     over the full-bleed map.
//
// Flight styles: 'two-stick' (PAN + LOOK) · 'one-hand' (one PAN stick + TILT
// for climb/turn, hands-free after a touch calibration) · 'zones' (zone pad).
//
// SELECT is just TAP — a real touch on the map fires a trusted gmp-click → the
// parcel awakens, the blue polygon draws, the card opens.
// memory/project_phone_as_controller, project_tilt_to_fly

import { useEffect, useRef, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import FlightControls, { type FlightStyle } from './FlightControls';
import DragLookControls from './DragLookControls';
import TiltEdgeIndicator from './TiltEdgeIndicator';
import { useTiltFly } from '@/lib/useTiltFly';
import { useDragLook } from '@/lib/useDragLook';

const NAV = [
  { href: '/home', icon: 'home', label: 'Home' },
  { href: '/map?view=3d', icon: 'map', label: 'Map' },
  { href: '/post', icon: 'add_location_alt', label: 'Post a Move' },
  { href: '/connections', icon: 'hub', label: 'Connections' },
  { href: '/documents', icon: 'description', label: 'Documents' },
  { href: '/my-request', icon: 'explore', label: 'My Requests' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

const STYLES: { id: FlightStyle; icon: string; label: string; sub: string }[] = [
  { id: 'drag-look', icon: 'pan_tool_alt', label: 'Move to look', sub: 'Pan stick + swipe to look around' },
  { id: 'two-stick', icon: 'sports_esports', label: 'Two sticks', sub: 'Pan + Look' },
  { id: 'one-hand', icon: 'front_hand', label: 'One hand', sub: 'Pan + tilt to climb & turn' },
  { id: 'zones', icon: 'grid_view', label: 'Zone pad', sub: 'Full-width strips' },
];
const VALID_STYLES = new Set(STYLES.map((s) => s.id));

const LS_STYLE = 'plotmaps.mobileFlightStyle';
const LS_HAND = 'plotmaps.mobileHand';
// v2 key — the old frac saved big values that pushed the grip mid-screen.
// Bumping the key resets everyone to the new small default (grip at bottom).
const LS_MAPFRAC = 'plotmaps.mobileMapFrac2';
type Hand = 'right' | 'left';

// portrait size divider: control-band height as a fraction of viewport.
// Default is SMALL — the band hugs the bottom, the grip sits low, and you
// drag it UP to shrink the map into a wider landscape letterbox.
const MIN_FRAC = 0.18, MAX_FRAC = 0.6, DEFAULT_FRAC = 0.22;

export default function MobileFlightHUD() {
  const [menu, setMenu] = useState(false);
  const [flightStyle, setFlightStyle] = useState<FlightStyle>('drag-look');
  const [hand, setHand] = useState<Hand>('right');
  const [frac, setFrac] = useState(DEFAULT_FRAC);

  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_STYLE);
      if (s && VALID_STYLES.has(s as FlightStyle)) setFlightStyle(s as FlightStyle);
      const h = localStorage.getItem(LS_HAND);
      if (h === 'right' || h === 'left') setHand(h);
      const f = parseFloat(localStorage.getItem(LS_MAPFRAC) || '');
      if (Number.isFinite(f)) setFrac(Math.min(MAX_FRAC, Math.max(MIN_FRAC, f)));
    } catch { /* ignore */ }
  }, []);

  // push the size split to the shell so the map re-flows (--tzp-h drives it).
  useEffect(() => {
    document.documentElement.style.setProperty('--tzp-h', `${(frac * 100).toFixed(1)}vh`);
    try { localStorage.setItem(LS_MAPFRAC, String(frac)); } catch { /* ignore */ }
  }, [frac]);

  const chooseStyle = (s: FlightStyle) => {
    setFlightStyle(s);
    try { localStorage.setItem(LS_STYLE, s); } catch { /* ignore */ }
  };
  const chooseHand = (h: Hand) => {
    setHand(h);
    try { localStorage.setItem(LS_HAND, h); } catch { /* ignore */ }
  };

  // Tilt-fly is active only in one-hand style; its RAF owns the pad frame then.
  const tilt = useTiltFly(flightStyle === 'one-hand');
  // Default style: pan ball + climb ball drive the flight loop; LOOK is
  // Google's native control (we don't touch the map's finger gestures).
  const dragLook = useDragLook(flightStyle === 'drag-look');

  // ── portrait size divider (drag up = shrink map to landscape letterbox) ──
  const dragging = useRef(false);
  const startY = useRef(0);
  const startFrac = useRef(DEFAULT_FRAC);
  const onGripDown = (e: React.PointerEvent) => {
    dragging.current = true; startY.current = e.clientY; startFrac.current = frac;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId); e.preventDefault();
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = startY.current - e.clientY; // up = grow controls / shrink map
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

      {/* ── slide-down menu: search + nav + flight style ── */}
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

            {/* Flight style picker */}
            <div className="mtb-menu__section">Flying</div>
            {STYLES.map((s) => (
              <button
                key={s.id}
                className={`mtb-menu__item mtb-menu__style ${flightStyle === s.id ? 'is-on' : ''}`}
                onClick={() => { chooseStyle(s.id); setMenu(false); }}
              >
                <MaterialIcon icon={s.icon} className="text-[20px]" />
                <span className="mtb-menu__style-txt">
                  <span>{s.label}</span>
                  <span className="mtb-menu__style-sub">{s.sub}</span>
                </span>
                {flightStyle === s.id && <MaterialIcon icon="check" className="text-[18px] mtb-menu__check" />}
              </button>
            ))}

            {/* Handedness — which side the PAN stick sits on (tilt + drag-look) */}
            {(flightStyle === 'one-hand' || flightStyle === 'drag-look') && (
              <>
                <div className="mtb-menu__section">Stick side</div>
                <div className="mtb-menu__hand">
                  <button
                    className={`mtb-menu__handbtn ${hand === 'left' ? 'is-on' : ''}`}
                    onClick={() => chooseHand('left')}
                  >
                    <MaterialIcon icon="back_hand" className="text-[18px] mtb-menu__handbtn-flip" /> Left
                  </button>
                  <button
                    className={`mtb-menu__handbtn ${hand === 'right' ? 'is-on' : ''}`}
                    onClick={() => chooseHand('right')}
                  >
                    <MaterialIcon icon="back_hand" className="text-[18px]" /> Right
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── edge-line tilt feedback (one-hand only) ── */}
      {flightStyle === 'one-hand' && tilt.calibrated && <TiltEdgeIndicator tilt={tilt} />}

      {/* ── SIZE DIVIDER (portrait) — drag up to shrink the map into a wider
           landscape letterbox; drag down for a bigger map. Hidden in landscape
           (the band is already slim there). ── */}
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

      {/* ── BOTTOM CONTROLS (transparent over the full-bleed map) ── */}
      <div className="mfh">
        <div className="mfh-controls">
          {flightStyle === 'drag-look'
            ? <DragLookControls dragLook={dragLook} hand={hand} />
            : <FlightControls flightStyle={flightStyle} tilt={tilt} hand={hand} />}
        </div>
      </div>

      {/* ── TILT CALIBRATION countdown (one-hand): 3 · 2 · 1 · Set ── */}
      {tilt.countdown !== null && (
        <div className="mfh-tiltcal">
          <div className="mfh-tiltcal__card">
            <MaterialIcon icon="screen_rotation_alt" className="text-[26px]" />
            <div className="mfh-tiltcal__num">{tilt.countdown === 0 ? 'Set' : tilt.countdown}</div>
            <div className="mfh-tiltcal__hint">
              {tilt.countdown === 0 ? 'Level locked — tilt to fly' : 'Hold your phone comfortably…'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
