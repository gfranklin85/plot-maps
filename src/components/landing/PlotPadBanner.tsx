'use client';

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotPadModal from '@/components/landing/PlotPadModal';
import { usePlotPadStatus } from '@/lib/usePlotPadStatus';

// ── PlotPadBanner ─────────────────────────────────────────────────────
//
// Front-and-center hero strip on the landing page: the download that
// unlocks FULL GAMEPAD FLIGHT. A website is sandboxed; the Plot Pad helper
// is an OS-level instrument that unlocks:
//   • A button → a real OS click → Google Map3D's exact ground raycast
//     (pixel-perfect property selection at any flight angle).
//   • Flight start → true full-screen (F11), chrome off.
//   • Every controller button, reliably (the browser misses A/B/X/Y).
//   • Right-stick aim, rumble, one-button launch.
//
// The chip is a live THREE-STATE flight-readiness light (usePlotPadStatus):
//   none → "plug in a controller" · connected → "install Plot Pad to fly"
//   (nudges the download) · active → "Plot Pad active" (flight-ready, the
//   installed-correctly indicator, proven by live gamepad input).
// memory/project_plot_pad_os_click_helper, project_gamepad_is_os_layer.

// Controller status chip. `connected` = a pad is plugged in and the page can
// now be driven with the D-pad (useGamepadNav is live site-wide) — we tell
// the user that directly. `active` = Plot Pad's OS-click layer is running too.
const STATUS_COPY = {
  none:      { dot: 'is-off',  icon: 'sports_esports', text: 'Plug in a controller' },
  connected: { dot: 'is-on',   icon: 'stadia_controller', text: 'Controller connected' },
  active:    { dot: 'is-on',   icon: 'check', text: 'Plot Pad active — flight-ready' },
} as const;

export default function PlotPadBanner() {
  const [modalOpen, setModalOpen] = useState(false);
  const { status } = usePlotPadStatus();

  return (
    <section className="ppad">
      {/* PlotMaps flying identity — the old isometric floating island +
          drifting clouds return here, in the sky band. This banner IS the
          "fly the map" front door (the hero below is the Position brokerage
          door). Full-frame self-aligning SVGs on the shared 1920×1080
          canvas. memory/project_plot_pad_os_click_helper, feedback_screen_is_always_2d */}
      <div className="ppad__scene" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dashboard/hero/cloud-2.svg" alt="" className="ppad__cloud ppad__cloud--back" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dashboard/hero/island.svg" alt="" className="ppad__island" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dashboard/hero/cloud-1.svg" alt="" className="ppad__cloud ppad__cloud--front" draggable={false} />
      </div>
      <div className="fp__wrap ppad__wrap">
        {/* compact strip: motif + short title on the left; download +
            live status on the right. No giant hero type, no big art —
            the full pitch lives in the pre-download modal. */}
        <div className="ppad__copy">
          <div className="ppad__eyebrow">
            <MaterialIcon icon="sports_esports" className="ppad__eyebrow-i" />
            FULL GAMEPAD FLIGHT
          </div>
          <h2 className="ppad__h font-headline">
            Plug in your controller.<span className="ppad__accent">Fly the map for real.</span>
          </h2>
        </div>

        <div className="ppad__cta-row">
          <span className={`ppad__status ${STATUS_COPY[status].dot} ${status !== 'none' ? 'is-live' : ''}`}>
            <span className="ppad__dot" aria-hidden />
            <MaterialIcon icon={STATUS_COPY[status].icon} className="ppad__status-i" />
            {STATUS_COPY[status].text}
          </span>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="ppad__dl"
            data-gamepad-focusable
            data-gamepad-primary
          >
            <MaterialIcon icon="download" className="ppad__dl-i" />
            Download Plot Pad
            <span className="ppad__dl-os">Windows · free</span>
          </button>
        </div>
      </div>

      {/* pre-download trust flow */}
      <PlotPadModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}
