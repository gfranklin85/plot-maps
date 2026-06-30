'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotPadModal from '@/components/landing/PlotPadModal';

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
// The browser CAN detect a connected gamepad (Gamepad API), so the banner
// reacts live: "controller detected" vs "plug one in" — and always offers
// the download. memory/project_plot_pad_os_click_helper,
// project_gamepad_is_os_layer.

export default function PlotPadBanner() {
  const [padConnected, setPadConnected] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Reflect whether any gamepad is currently visible to the browser.
    const refresh = () => {
      const pads = navigator.getGamepads?.() ?? [];
      setPadConnected(Array.from(pads).some((p) => p && p.connected));
    };
    refresh();
    window.addEventListener('gamepadconnected', refresh);
    window.addEventListener('gamepaddisconnected', refresh);
    // Chrome only populates getGamepads() after an input event, so poll
    // a few times early to catch an already-plugged pad.
    const iv = window.setInterval(refresh, 1000);
    return () => {
      window.removeEventListener('gamepadconnected', refresh);
      window.removeEventListener('gamepaddisconnected', refresh);
      window.clearInterval(iv);
    };
  }, []);

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
            <span className={`ppad__status ${padConnected ? 'is-on' : ''}`}>
              <span className="ppad__dot" aria-hidden />
              {padConnected ? 'Controller detected' : 'Plug in a controller'}
            </span>
          </div>
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
