'use client';

// ── MobileFlightHUD ───────────────────────────────────────────────────
//
// The mobile flight control sheet (Greg's mockups, 2026-07-11). A single
// translucent glass sheet at the bottom holding:
//   • a DRAG-GRIP (the map/control divider) — drag up for taller controls +
//     a shorter wider (landscape) map; drag down for a bigger map. The split
//     is saved to localStorage. This is the resizable-map control Greg asked
//     for — a wide letterbox map is often better than cramped full-portrait.
//   • the MODE ROW: Flight · Explore · (center fly) · Layers · Saved.
//   • the CONTROL STYLE toggle: sticks+slider (mockup) ⇄ zone pad (kept).
//   • the flight controls (FlightControls), whichever style is chosen.
//
// It writes the map/control split as a CSS var (--tzp-h) on the shell so the
// existing touch-fly layout re-flows live. All prefs persist per device.

import { useCallback, useEffect, useRef, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import FlightControls, { type ControlStyle } from './FlightControls';

// Sheet height clamps (as a fraction of viewport height).
const MIN_FRAC = 0.30;
const MAX_FRAC = 0.60;
const DEFAULT_FRAC = 0.42;

const LS_HEIGHT = 'plotmaps.mobileControlFrac';
const LS_STYLE = 'plotmaps.mobileControlStyle';

interface Props {
  onButton?: (k: 'a' | 'b', down: boolean) => void;
  walkMode?: boolean;
  onSetWalk?: (walk: boolean) => void;
  onLayers?: () => void;
  onSaved?: () => void;
}

export default function MobileFlightHUD({ onButton, walkMode, onSetWalk, onLayers, onSaved }: Props) {
  const [frac, setFrac] = useState(DEFAULT_FRAC);
  const [style, setStyle] = useState<ControlStyle>('sticks');
  const dragging = useRef(false);
  const startY = useRef(0);
  const startFrac = useRef(DEFAULT_FRAC);

  // restore saved prefs
  useEffect(() => {
    try {
      const h = parseFloat(localStorage.getItem(LS_HEIGHT) || '');
      if (Number.isFinite(h)) setFrac(Math.min(MAX_FRAC, Math.max(MIN_FRAC, h)));
      const s = localStorage.getItem(LS_STYLE);
      if (s === 'sticks' || s === 'zones') setStyle(s);
    } catch { /* ignore */ }
  }, []);

  // push the split to the shell so the map re-flows (--tzp-h drives the layout)
  useEffect(() => {
    document.documentElement.style.setProperty('--tzp-h', `${(frac * 100).toFixed(1)}vh`);
    try { localStorage.setItem(LS_HEIGHT, String(frac)); } catch { /* ignore */ }
  }, [frac]);

  const chooseStyle = useCallback((s: ControlStyle) => {
    setStyle(s);
    try { localStorage.setItem(LS_STYLE, s); } catch { /* ignore */ }
  }, []);

  // drag-grip → resize the split
  const onGripDown = (e: React.PointerEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startFrac.current = frac;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onGripMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dy = startY.current - e.clientY;              // up = grow controls
    const next = startFrac.current + dy / window.innerHeight;
    setFrac(Math.min(MAX_FRAC, Math.max(MIN_FRAC, next)));
    e.preventDefault();
  };
  const onGripUp = () => { dragging.current = false; };

  return (
    <div className="mfh">
      {/* drag-grip — the map/control divider */}
      <div className="mfh-grip" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}>
        <MaterialIcon icon="unfold_more" className="mfh-grip__ic" />
      </div>

      {/* mode row */}
      <div className="mfh-modes">
        <button className={`mfh-mode ${!walkMode ? 'is-on' : ''}`} onClick={() => onSetWalk?.(false)}>
          <MaterialIcon icon="flight" className="text-[20px]" /><span>Flight</span>
        </button>
        <button className={`mfh-mode ${walkMode ? 'is-on' : ''}`} onClick={() => onSetWalk?.(true)}>
          <MaterialIcon icon="directions_walk" className="text-[20px]" /><span>Explore</span>
        </button>
        <button className="mfh-fly" aria-label="Fly"><MaterialIcon icon="navigation" className="text-[22px]" /></button>
        <button className="mfh-mode" onClick={() => onLayers?.()}>
          <MaterialIcon icon="layers" className="text-[20px]" /><span>Layers</span>
        </button>
        <button className="mfh-mode" onClick={() => onSaved?.()}>
          <MaterialIcon icon="bookmark" className="text-[20px]" /><span>Saved</span>
        </button>
      </div>

      {/* control-style toggle (sticks ⇄ zone pad) */}
      <button
        className="mfh-styletoggle"
        onClick={() => chooseStyle(style === 'sticks' ? 'zones' : 'sticks')}
        aria-label="Switch control style"
      >
        <MaterialIcon icon={style === 'sticks' ? 'grid_view' : 'gamepad'} className="text-[16px]" />
        {style === 'sticks' ? 'Zone pad' : 'Sticks'}
      </button>

      {/* the flight controls */}
      {!walkMode && (
        <div className="mfh-controls">
          <FlightControls style={style} onButton={onButton} />
        </div>
      )}
    </div>
  );
}
