'use client';

// ── BuyingPanel — the map's docked left rail ──────────────────────────
//
// "When we load the map, it needs to come out like this" (Greg 2026-07-14,
// from the mockup): Your Buying Settings + the live Market Snapshot +
// Payment Fit, docked on the left OVER the full-bleed map, OPEN by default.
// Composes the listings-build components (BuyerSettingsPanel + MarketSidebar
// — the snapshot computes live from the real sold_comps MLS records), so the
// listings page and the map read from ONE settings store (localStorage) and
// one market API. Collapsible to a slim edge tab; state persists per device.

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import BuyerSettingsPanel from '@/components/listings/BuyerSettingsPanel';
import MarketSidebar from '@/components/listings/MarketSidebar';
import { loadSettings, DEFAULT_SETTINGS, type BuyerSettings } from '@/lib/listings/buyerSettings';

const OPEN_KEY = 'plotmaps.mapBuyPanel.open';

export default function BuyingPanel({
  city = 'Lemoore',
  selected = null,
}: {
  city?: string;
  selected?: { price: number; sqft: number | null } | null;
}) {
  const [settings, setSettings] = useState<BuyerSettings>(DEFAULT_SETTINGS);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setSettings(loadSettings());
    try {
      const raw = localStorage.getItem(OPEN_KEY);
      if (raw != null) setOpen(raw === '1');
    } catch { /* default open */ }
  }, []);

  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(OPEN_KEY, o ? '0' : '1'); } catch { /* noop */ }
      return !o;
    });
  };

  if (!open) {
    return (
      <button className="bp-tab" onClick={toggle} aria-label="Open buying settings">
        <MaterialIcon icon="tune" className="text-[18px]" />
        <span>Buying settings</span>
        <style>{`
          .bp-tab { position: absolute; left: 0; top: 50%; transform: translateY(-50%); z-index: 24;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            padding: 14px 9px; border: 1px solid rgba(19,73,212,0.18); border-left: none;
            border-radius: 0 14px 14px 0; background: rgba(255,255,255,0.92); backdrop-filter: blur(6px);
            color: var(--plot-brand, #1349d4); cursor: pointer;
            box-shadow: 6px 0 24px -12px rgba(20,50,120,0.4); }
          .bp-tab span { writing-mode: vertical-rl; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; }
          .bp-tab:hover { color: var(--plot-brand-deep, #122d8d); }
        `}</style>
      </button>
    );
  }

  return (
    <aside className="bp">
      <button className="bp__collapse" onClick={toggle} aria-label="Collapse buying settings">
        <MaterialIcon icon="chevron_left" className="text-[18px]" />
      </button>
      <div className="bp__scroll">
        <BuyerSettingsPanel settings={settings} onChange={setSettings} />
        <MarketSidebar city={city} settings={settings} selected={selected} />
      </div>
      <style>{`
        .bp { position: absolute; left: 12px; top: 12px; bottom: 12px; width: min(336px, 86vw); z-index: 24;
          display: flex; flex-direction: column;
          border-radius: 18px; background: rgba(255,255,255,0.94); backdrop-filter: blur(8px);
          border: 1px solid rgba(19,73,212,0.12);
          box-shadow: 0 24px 56px -30px rgba(20,50,120,0.5); overflow: hidden; }
        .bp__collapse { position: absolute; top: 10px; right: 10px; z-index: 2;
          width: 28px; height: 28px; display: grid; place-items: center;
          border: 1px solid rgba(19,73,212,0.16); border-radius: 8px; background: #fff;
          color: #6b7699; cursor: pointer; }
        .bp__collapse:hover { color: var(--plot-brand-deep, #122d8d); }
        .bp__scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px;
          display: flex; flex-direction: column; gap: 14px; }
        /* mobile / touch-fly: hide the rail — the map needs the full glass */
        @media (max-width: 760px) { .bp, .bp-tab { display: none; } }
      `}</style>
    </aside>
  );
}
