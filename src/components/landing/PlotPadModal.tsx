'use client';

import { useEffect, useRef } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

// ── PlotPadModal ──────────────────────────────────────────────────────
//
// The pre-download TRUST flow. Clicking "Download Plot Pad" opens this
// first. The OS SmartScreen warning lives outside the browser (only the EV
// cert removes it) — but the REASON warnings make people abandon is trust:
// they've been burned by software that sneaks in junk that won't go away.
// This modal disarms that by being radically specific and finite:
//   • exactly what it does (3 things)
//   • exactly what it does NOT do (no background junk, no autostart, no data)
//   • pre-warns the Windows prompt so it's expected, not a scary surprise
//   • proof: signed by Plot Solutions LLC + open source
// Then it triggers the real download.
// memory/project_plot_pad_os_click_helper

const DOWNLOAD_URL = '/download/PlotPad.exe';
// The Rust source — a real trust flex: anyone can read exactly what runs.
const SOURCE_URL =
  'https://github.com/gfranklin85/plot-maps/tree/master/tools/plot-pad';

export default function PlotPadModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  // Esc closes; lock background scroll while open; focus the close button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const startDownload = () => {
    // Trigger the actual file download without leaving the page.
    const a = document.createElement('a');
    a.href = DOWNLOAD_URL;
    a.download = 'PlotPad.exe';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      className="ppm__overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ppm-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ppm">
        <button
          ref={closeRef}
          type="button"
          className="ppm__close"
          onClick={onClose}
          aria-label="Close"
        >
          <MaterialIcon icon="close" />
        </button>

        {/* header */}
        <div className="ppm__head">
          <span className="ppm__badge">
            <MaterialIcon icon="sports_esports" className="ppm__badge-i" />
            FULL GAMEPAD FLIGHT
          </span>
          <h2 id="ppm-title" className="ppm__title font-headline">
            What you&apos;re about to download.
          </h2>
          <p className="ppm__lede">
            Plot Pad is a tiny free helper that lets your controller fly the
            map. We&apos;re telling you <b>exactly</b> what it does and
            doesn&apos;t do — nothing hidden, nothing that sticks around.
          </p>
        </div>

        <div className="ppm__cols">
          {/* DOES */}
          <div className="ppm__col">
            <div className="ppm__col-h ppm__col-h--does">
              <MaterialIcon icon="check_circle" /> It does exactly three things
            </div>
            <ul className="ppm__list">
              <li>
                <MaterialIcon icon="my_location" className="ppm__li-i" />
                <span><b>A button</b> selects the property under your reticle — pixel-perfect, at any angle.</span>
              </li>
              <li>
                <MaterialIcon icon="fullscreen" className="ppm__li-i" />
                <span><b>Takeoff</b> (push the stick) makes the browser full-screen so the map fills your glass.</span>
              </li>
              <li>
                <MaterialIcon icon="stadia_controller" className="ppm__li-i" />
                <span><b>The stick</b> aims your reticle. Every button works, every time.</span>
              </li>
            </ul>
          </div>

          {/* DOES NOT */}
          <div className="ppm__col">
            <div className="ppm__col-h ppm__col-h--not">
              <MaterialIcon icon="block" /> And nothing else
            </div>
            <ul className="ppm__list ppm__list--not">
              <li><MaterialIcon icon="close" className="ppm__li-i" /> No background services. It runs only while you fly.</li>
              <li><MaterialIcon icon="close" className="ppm__li-i" /> No auto-start. No startup entries.</li>
              <li><MaterialIcon icon="close" className="ppm__li-i" /> No data collected or sent. It never touches the network.</li>
              <li><MaterialIcon icon="close" className="ppm__li-i" /> Only acts while a Plot tab is focused — never elsewhere.</li>
              <li><MaterialIcon icon="close" className="ppm__li-i" /> Quit it anytime from the tray. Delete the one file — gone.</li>
            </ul>
          </div>
        </div>

        {/* warning pre-warn */}
        <div className="ppm__warn">
          <MaterialIcon icon="info" className="ppm__warn-i" />
          <div>
            <div className="ppm__warn-h">You may see a Windows prompt — that&apos;s normal for new software.</div>
            <p className="ppm__warn-p">
              Because Plot Pad is new, Windows might show a blue
              &ldquo;Windows protected your PC&rdquo; box. It&apos;s not a virus
              warning — it just means the file is new to Microsoft. Click
              <b> More info → Run anyway</b> to continue. It&apos;s signed by
              <b> Plot Solutions LLC</b>, and the full source is public so you
              can read every line that runs.
            </p>
          </div>
        </div>

        {/* proof + actions */}
        <div className="ppm__foot">
          <div className="ppm__proof">
            <span className="ppm__proof-item"><MaterialIcon icon="verified_user" /> Signed · Plot Solutions LLC</span>
            <a className="ppm__proof-item ppm__proof-link" href={SOURCE_URL} target="_blank" rel="noopener noreferrer">
              <MaterialIcon icon="code" /> View the source
            </a>
            <span className="ppm__proof-item"><MaterialIcon icon="memory" /> 119 KB · Windows · free</span>
          </div>
          <div className="ppm__actions">
            <button type="button" className="ppm__cancel" onClick={onClose} data-gamepad-focusable>Not now</button>
            <button type="button" className="ppm__dl" onClick={startDownload} data-gamepad-focusable data-gamepad-primary>
              <MaterialIcon icon="download" className="ppm__dl-i" />
              Download Plot Pad
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
