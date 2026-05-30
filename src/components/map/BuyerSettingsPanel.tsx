"use client";

// BuyerSettingsPanel — the persistent knob strip at the top of the map.
//
// The Plot moment: a visitor adjusts down payment / term / rate and EVERY
// visible property card recalculates its monthly headline in real time.
// Competitors don't have this on browse surfaces — Zillow's mortgage
// calculator lives in a separate page. Plot puts it where the shopping
// actually happens.
//
// Layout: floating pill bar, top-center of the viewport, just below the
// map toolbar. Collapsed by default (shows "$2,945/mo · 30yr · 6.8% ·
// 20% down"); expands into a knob row on click. Reset link.
//
// Headline mode toggle: choose "Monthly" (default) or "Price" to swap
// which number is the big one on the card. Some buyers think in monthly,
// some in price — Plot defaults to monthly but doesn't force it.

import { useState } from "react";
import { useBuyerSettings } from "@/lib/buyer-settings/context";
import { DEFAULT_BUYER_SETTINGS } from "@/lib/buyer-settings/piti";

export default function BuyerSettingsPanel() {
  const { settings, updateSettings, resetSettings } = useBuyerSettings();
  const [expanded, setExpanded] = useState(false);

  const ratePct = (settings.rate * 100).toFixed(2).replace(/\.?0+$/, '');
  const downPct = (settings.downPct * 100).toFixed(0);

  return (
    <div className="bsp-root">
      {!expanded ? (
        <button
          type="button"
          className="bsp-collapsed"
          onClick={() => setExpanded(true)}
          aria-label="Adjust mortgage assumptions"
        >
          <span className="bsp-collapsed-label">YOUR PAYMENT SETTINGS</span>
          <span className="bsp-collapsed-value">
            {settings.termYears}yr · {ratePct}% · {downPct}% down
          </span>
          <span className="bsp-collapsed-chev">▾</span>
        </button>
      ) : (
        <div className="bsp-expanded">
          <div className="bsp-header">
            <div className="bsp-title">YOUR PAYMENT SETTINGS</div>
            <div className="bsp-header-actions">
              <button type="button" className="bsp-reset" onClick={resetSettings}>
                Reset
              </button>
              <button
                type="button"
                className="bsp-close"
                onClick={() => setExpanded(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          <div className="bsp-knobs">
            <div className="bsp-knob">
              <label htmlFor="bsp-down">DOWN PAYMENT</label>
              <div className="bsp-knob-row">
                <input
                  id="bsp-down"
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={Math.round(settings.downPct * 100)}
                  onChange={(e) =>
                    updateSettings({ downPct: Number(e.target.value) / 100 })
                  }
                />
                <span className="bsp-knob-value">{downPct}%</span>
              </div>
            </div>

            <div className="bsp-knob">
              <label htmlFor="bsp-rate">INTEREST RATE</label>
              <div className="bsp-knob-row">
                <input
                  id="bsp-rate"
                  type="range"
                  min={20}
                  max={120}
                  step={1}
                  value={Math.round(settings.rate * 1000)}
                  onChange={(e) =>
                    updateSettings({ rate: Number(e.target.value) / 1000 })
                  }
                />
                <span className="bsp-knob-value">{ratePct}%</span>
              </div>
            </div>

            <div className="bsp-knob">
              <label>LOAN TERM</label>
              <div className="bsp-term-toggle">
                <button
                  type="button"
                  className={settings.termYears === 15 ? "is-on" : ""}
                  onClick={() => updateSettings({ termYears: 15 })}
                >
                  15 yr
                </button>
                <button
                  type="button"
                  className={settings.termYears === 30 ? "is-on" : ""}
                  onClick={() => updateSettings({ termYears: 30 })}
                >
                  30 yr
                </button>
              </div>
            </div>

            <div className="bsp-knob bsp-headline-knob">
              <label>HEADLINE</label>
              <div className="bsp-term-toggle">
                <button
                  type="button"
                  className={settings.headlineMode === 'monthly' ? "is-on" : ""}
                  onClick={() => updateSettings({ headlineMode: 'monthly' })}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={settings.headlineMode === 'price' ? "is-on" : ""}
                  onClick={() => updateSettings({ headlineMode: 'price' })}
                >
                  Price
                </button>
              </div>
            </div>
          </div>

          <div className="bsp-footnote">
            Estimates only. PITI = Principal + Interest + Taxes + Insurance.
            Tax estimated at {(DEFAULT_BUYER_SETTINGS.taxRate * 100).toFixed(1)}% county effective rate.
            Insurance estimated from baseline + dwelling value.
          </div>
        </div>
      )}

      <style jsx>{`
        .bsp-root {
          position: absolute;
          top: 84px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 40;
          pointer-events: auto;
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        }
        .bsp-collapsed {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: var(--plot-card-surface);
          color: var(--plot-card-ink);
          border: 1px solid var(--plot-card-divider);
          border-radius: 999px;
          box-shadow:
            0 6px 16px var(--plot-card-shadow),
            0 1px 0 var(--plot-card-shadow-inner) inset;
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
          letter-spacing: 0.2px;
          transition: box-shadow 120ms ease, transform 120ms ease;
        }
        .bsp-collapsed:hover {
          box-shadow:
            0 10px 22px var(--plot-card-shadow),
            0 1px 0 var(--plot-card-shadow-inner) inset;
          transform: translateY(-1px);
        }
        .bsp-collapsed-label {
          font-size: 9.5px;
          letter-spacing: 0.9px;
          color: var(--plot-card-ink-faint);
          font-weight: 600;
        }
        .bsp-collapsed-value {
          font-weight: 600;
          color: var(--plot-card-ink);
        }
        .bsp-collapsed-chev {
          color: var(--plot-card-ink-mid);
          font-size: 11px;
        }

        .bsp-expanded {
          width: min(820px, calc(100vw - 32px));
          padding: 18px 22px 14px;
          background: var(--plot-card-surface);
          color: var(--plot-card-ink);
          border: 1px solid var(--plot-card-divider);
          border-radius: 20px;
          box-shadow:
            0 16px 36px var(--plot-card-shadow),
            0 1px 0 var(--plot-card-shadow-inner) inset;
        }
        .bsp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }
        .bsp-title {
          font-size: 10px;
          letter-spacing: 1.1px;
          font-weight: 700;
          color: var(--plot-card-ink-faint);
        }
        .bsp-header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .bsp-reset {
          background: transparent;
          border: 0;
          color: var(--plot-blue);
          font-size: 12px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 8px;
          cursor: pointer;
        }
        .bsp-reset:hover {
          background: var(--plot-blue-soft);
        }
        .bsp-close {
          background: transparent;
          border: 0;
          color: var(--plot-card-ink-mid);
          font-size: 22px;
          line-height: 1;
          padding: 0 6px;
          cursor: pointer;
        }

        .bsp-knobs {
          display: grid;
          grid-template-columns: 1fr 1fr 0.7fr 0.7fr;
          gap: 18px;
        }
        @media (max-width: 720px) {
          .bsp-knobs {
            grid-template-columns: 1fr 1fr;
          }
        }
        .bsp-knob {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bsp-knob label {
          font-size: 9.5px;
          letter-spacing: 0.9px;
          font-weight: 700;
          color: var(--plot-card-ink-faint);
        }
        .bsp-knob-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bsp-knob input[type="range"] {
          flex: 1;
          accent-color: var(--plot-blue);
          height: 4px;
        }
        .bsp-knob-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--plot-card-ink);
          min-width: 42px;
          text-align: right;
        }

        .bsp-term-toggle {
          display: inline-flex;
          background: #efeee9;
          border-radius: 10px;
          padding: 2px;
        }
        .bsp-term-toggle button {
          flex: 1;
          background: transparent;
          border: 0;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          color: var(--plot-card-ink-mid);
          border-radius: 8px;
          cursor: pointer;
        }
        .bsp-term-toggle button.is-on {
          background: var(--plot-card-surface);
          color: var(--plot-card-ink);
          box-shadow: 0 1px 3px var(--plot-card-shadow);
        }

        .bsp-footnote {
          margin-top: 14px;
          font-size: 10.5px;
          color: var(--plot-card-ink-faint);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
