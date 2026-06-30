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

const STATUS_COPY = {
  none:      { dot: 'is-off',  text: 'Plug in a controller' },
  connected: { dot: 'is-wait', text: 'Controller found — install Plot Pad to fly' },
  active:    { dot: 'is-on',   text: 'Plot Pad active — flight-ready' },
} as const;

export default function PlotPadBanner() {
  const [modalOpen, setModalOpen] = useState(false);
  const { status } = usePlotPadStatus();

  return (
    <section className="ppad">
      <div className="fp__wrap ppad__wrap">
        {/* left — the pitch */}
        <div className="ppad__copy">
          <div className="ppad__eyebrow">
            <MaterialIcon icon="sports_esports" className="ppad__eyebrow-i" />
            FULL GAMEPAD FLIGHT
          </div>
          <h2 className="ppad__h font-headline">
            Plug in your controller.<br />
            <span className="ppad__accent">Fly the map for real.</span>
          </h2>
          <p className="ppad__sub">
            Download <b>Plot Pad</b> — the free helper that turns your controller
            into the cockpit. True full-screen the moment you take off,
            pixel-perfect targeting, every button live. The website can&apos;t do
            this alone; this is the key.
          </p>
          <ul className="ppad__feats">
            <li><MaterialIcon icon="my_location" className="ppad__feat-i" /> Pixel-perfect property targeting</li>
            <li><MaterialIcon icon="fullscreen" className="ppad__feat-i" /> Auto full-screen on takeoff</li>
            <li><MaterialIcon icon="stadia_controller" className="ppad__feat-i" /> Every button, every time</li>
          </ul>

          <div className="ppad__cta-row">
            <button type="button" onClick={() => setModalOpen(true)} className="ppad__dl">
              <MaterialIcon icon="download" className="ppad__dl-i" />
              Download Plot Pad
              <span className="ppad__dl-os">Windows · free</span>
            </button>
            <span className={`ppad__status ${STATUS_COPY[status].dot}`}>
              <span className="ppad__dot" aria-hidden />
              {status === 'active' && <MaterialIcon icon="check" className="ppad__status-i" />}
              {STATUS_COPY[status].text}
            </span>
          </div>

          {/* Controller plugged in but no Plot Pad input seen → nudge install. */}
          {status === 'connected' && (
            <button type="button" className="ppad__nudge" onClick={() => setModalOpen(true)}>
              <MaterialIcon icon="bolt" className="ppad__nudge-i" />
              Controller detected — get Plot Pad to fly it.
              <span className="ppad__nudge-go">Install →</span>
            </button>
          )}
        </div>

        {/* right — controller mark */}
        <div className="ppad__art" aria-hidden>
          <div className="ppad__art-glow" />
          <MaterialIcon icon="stadia_controller" className="ppad__art-pad" />
        </div>
      </div>

      {/* pre-download trust flow */}
      <PlotPadModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  );
}
