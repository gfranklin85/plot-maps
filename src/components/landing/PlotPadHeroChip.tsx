'use client';

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotPadModal from '@/components/landing/PlotPadModal';
import { usePlotPadStatus } from '@/lib/usePlotPadStatus';

// ── PlotPadHeroChip ───────────────────────────────────────────────────
//
// Compact in-hero Plot Pad control (replaces the removed top blue strip).
// A blue gamepad-outlined chip that: shows live controller/Plot-Pad status,
// and opens the download (trust modal) on click. Sits in the hero CTA area.
// memory/project_plot_pad_os_click_helper, project_fused_hero_flight_brokerage

const STATUS = {
  none:      { dot: 'is-off',  text: 'Gamepad flight — download Plot Pad' },
  connected: { dot: 'is-on',   text: 'Controller connected — get Plot Pad' },
  active:    { dot: 'is-on',   text: 'Plot Pad active — flight-ready' },
} as const;

export default function PlotPadHeroChip() {
  const [open, setOpen] = useState(false);
  const { status } = usePlotPadStatus();
  const s = STATUS[status];

  return (
    <>
      <button
        type="button"
        className={`ppchip ${s.dot}`}
        onClick={() => setOpen(true)}
        data-gamepad-focusable
      >
        <span className="ppchip__pad"><MaterialIcon icon="stadia_controller" /></span>
        <span className="ppchip__dot" aria-hidden />
        <span className="ppchip__text">{s.text}</span>
        <MaterialIcon icon="download" className="ppchip__dl" />
      </button>
      <PlotPadModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
