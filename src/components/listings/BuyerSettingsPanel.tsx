'use client';

// ── BuyerSettingsPanel — the left sidebar (Greg's mockup) ─────────────
//
// Loan type · down payment · rate · term · taxes/insurance/HOA · target
// monthly. Every change re-translates the listing cards. Persisted per device.

import { useEffect } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { saveSettings, downDollars, type BuyerSettings, type LoanType } from '@/lib/listings/buyerSettings';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function BuyerSettingsPanel({ settings, onChange }: {
  settings: BuyerSettings; onChange: (s: BuyerSettings) => void;
}) {
  useEffect(() => { saveSettings(settings); }, [settings]);
  const set = <K extends keyof BuyerSettings>(k: K, v: BuyerSettings[K]) => onChange({ ...settings, [k]: v });

  // for display: down payment in $ at a reference price = target-derived, but
  // we show the % + a representative $ using a nominal $489k so it reads real.
  const refPrice = 489000;
  const downRef = downDollars(settings, refPrice);
  const taxesMo = Math.round((refPrice * settings.annualTaxRate) / 12);

  const LOANS: { id: LoanType; label: string }[] = [
    { id: 'conventional', label: 'Conventional' },
    { id: 'fha', label: 'FHA' },
    { id: 'va', label: 'VA' },
  ];

  return (
    <div className="bs">
      <div className="bs__head"><MaterialIcon icon="tune" className="text-[20px]" /> Your Buying Settings</div>

      <div className="bs__label">Loan type</div>
      <div className="bs__seg">
        {LOANS.map((l) => (
          <button key={l.id} className={`bs__segbtn ${settings.loanType === l.id ? 'is-on' : ''}`} onClick={() => set('loanType', l.id)}>{l.label}</button>
        ))}
      </div>

      <div className="bs__row"><span className="bs__label">Down payment</span><span className="bs__val">{settings.downPercent}% or {money(downRef)}</span></div>
      <input className="bs__slider" type="range" min={0} max={30} step={1}
        value={settings.downPercent} onChange={(e) => onChange({ ...settings, downType: 'percent', downPercent: +e.target.value })} />
      <div className="bs__ticks"><span>0%</span><span>10%</span><span>20%</span><span>30%</span></div>

      <div className="bs__row"><span className="bs__label">Interest rate</span><span className="bs__val">{settings.ratePct.toFixed(2)}%</span></div>
      <input className="bs__slider" type="range" min={4} max={9} step={0.05}
        value={settings.ratePct} onChange={(e) => set('ratePct', +e.target.value)} />
      <div className="bs__ticks"><span>4%</span><span>5%</span><span>6%</span><span>7%</span><span>8%</span><span>9%</span></div>

      <div className="bs__row"><span className="bs__label">Loan term</span>
        <select className="bs__select" value={settings.termYears} onChange={(e) => set('termYears', +e.target.value)}>
          <option value={30}>30 years</option>
          <option value={20}>20 years</option>
          <option value={15}>15 years</option>
        </select>
      </div>

      <div className="bs__divider" />

      <div className="bs__line"><span>Estimated taxes</span><span>{money(taxesMo)}/mo</span></div>
      <div className="bs__line"><span>Insurance</span>
        <span className="bs__inline"><span>$</span><input className="bs__mini" inputMode="numeric" value={settings.monthlyInsurance}
          onChange={(e) => set('monthlyInsurance', +e.target.value || 0)} />/mo</span></div>
      <div className="bs__line"><span>HOA</span>
        <span className="bs__inline"><span>$</span><input className="bs__mini" inputMode="numeric" value={settings.monthlyHOA}
          onChange={(e) => set('monthlyHOA', +e.target.value || 0)} />/mo</span></div>

      <div className="bs__divider" />

      <div className="bs__row"><span className="bs__label">Target monthly payment</span><span className="bs__val">{money(settings.targetMonthly)}/mo</span></div>
      <input className="bs__slider" type="range" min={1500} max={3500} step={50}
        value={settings.targetMonthly} onChange={(e) => set('targetMonthly', +e.target.value)} />
      <div className="bs__ticks"><span>$1,500</span><span>$2,500</span><span>$3,500</span></div>

      <div className="bs__target">
        <div className="bs__target-l">Your target payment</div>
        <div className="bs__target-v">{money(settings.targetMonthly)}<span> /mo</span></div>
        <div className="bs__target-note">Listings are translated into estimated monthly payments using the assumptions above.</div>
        <MaterialIcon icon="track_changes" className="bs__target-ic" />
      </div>

      <style>{`
        .bs { background: #fff; border: 1px solid rgba(19,73,212,0.08); border-radius: 18px; padding: 18px;
          box-shadow: 0 8px 26px -18px rgba(20,50,120,0.4); }
        .bs__head { display: flex; align-items: center; gap: 8px; font-weight: 800; color: #0d1b3e; font-size: 15px; }
        .bs__head .material-symbols-rounded, .bs__head .material-icons { color: #1349d4; }
        .bs__label { margin-top: 16px; font-size: 12.5px; font-weight: 700; color: #3a4a72; }
        .bs__row { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
        .bs__row .bs__label { margin-top: 0; }
        .bs__val { font-size: 13px; font-weight: 800; color: #1349d4; }
        .bs__seg { display: flex; gap: 6px; margin-top: 8px; background: #eef3fd; padding: 4px; border-radius: 11px; }
        .bs__segbtn { flex: 1; padding: 8px 0; border-radius: 8px; font-size: 12.5px; font-weight: 700; color: #5a6a8c; }
        .bs__segbtn.is-on { background: #fff; color: #1349d4; box-shadow: 0 2px 6px -2px rgba(20,50,120,0.3); }
        .bs__slider { width: 100%; margin-top: 10px; accent-color: #1349d4; }
        .bs__ticks { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10.5px; color: #9aa4bc; }
        .bs__select { border: 1.5px solid rgba(19,73,212,0.16); border-radius: 9px; padding: 6px 10px; font-size: 13px;
          font-weight: 700; color: #1349d4; background: #fff; }
        .bs__divider { height: 1px; background: rgba(19,73,212,0.08); margin: 18px 0 4px; }
        .bs__line { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-size: 13.5px; color: #3a4a72; }
        .bs__inline { display: inline-flex; align-items: center; gap: 1px; color: #1a2333; font-weight: 700; }
        .bs__mini { width: 52px; border: 1.5px solid rgba(19,73,212,0.16); border-radius: 7px; padding: 4px 6px;
          font-size: 13px; text-align: right; outline: none; color: #0f2b6b; }
        .bs__mini:focus { border-color: rgba(19,73,212,0.5); }
        .bs__target { position: relative; margin-top: 18px; padding: 16px; border-radius: 14px;
          background: linear-gradient(180deg, rgba(19,73,212,0.07), rgba(19,73,212,0.03)); overflow: hidden; }
        .bs__target-l { font-size: 12.5px; font-weight: 700; color: #3a4a72; }
        .bs__target-v { font-size: 1.9rem; font-weight: 800; color: #1349d4; line-height: 1.1; }
        .bs__target-v span { font-size: 0.95rem; color: #5a6a8c; }
        .bs__target-note { margin-top: 6px; font-size: 11.5px; color: #6b7699; line-height: 1.4; max-width: 82%; }
        .bs__target-ic { position: absolute; top: 14px; right: 14px; color: rgba(19,73,212,0.35); font-size: 40px !important; }
      `}</style>
    </div>
  );
}
