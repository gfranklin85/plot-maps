'use client';

// ── OfferInstrument — the offer builder you PLAY ──────────────────────
//
// THE KEYSTONE (memory/project_rate_not_scenario_keystone): the buyer solicits
// a RATE, not per-scenario quotes. A rate is ONE input; the slider computes the
// payment at EVERY price. So here, PRICE is the buyer's exploration slider (the
// thing they don't know yet — "$350k? $420k?"), and the lender's RATE is the
// KEY the market handed them. Drag price → the true monthly + cash-to-close
// answer instantly, at any hour, because the rate is already in hand. No
// "let me get back to you tomorrow." No fabricated estimates — rate/insurance
// are real provider keys (or clearly not-yet-supplied), never made up.

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import LiveBuyersStatement from './LiveBuyersStatement';
import { DEFAULT_INPUTS, type OfferInputs } from '@/lib/offer/types';

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function OfferInstrument({
  initial,
  providers = {},
  areaComps = null,
  onBuildTeam,
}: {
  initial?: Partial<OfferInputs>;
  providers?: Record<string, string>;
  areaComps?: { low: number; high: number } | null;
  /** "solicit a rate / build your team" — the path to real keys */
  onBuildTeam?: () => void;
}) {
  const [inputs, setInputs] = useState<OfferInputs>(() => ({ ...DEFAULT_INPUTS, ...initial }));

  const set = <K extends keyof OfferInputs>(k: K, v: OfferInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const downDollars = Math.round(inputs.purchasePrice * (inputs.downPaymentPct / 100));

  // Is the rate a real key a lender put in hand, or not yet supplied?
  const hasRate = inputs.interestRate.source === 'live-provider';
  const hasInsurance = inputs.annualInsurance.source === 'live-provider';

  return (
    <div className="oi">
      {/* ── the KEY the market gave you: the rate ── */}
      <div className={`oi-key ${hasRate ? 'is-live' : 'is-pending'}`}>
        <div className="oi-key__icon">
          <MaterialIcon icon={hasRate ? 'vpn_key' : 'key_off'} className="text-[20px]" />
        </div>
        <div className="oi-key__body">
          {hasRate ? (
            <>
              <div className="oi-key__label">Your rate — the key that answers every price</div>
              <div className="oi-key__val">
                {inputs.interestRate.value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%
                {inputs.rateValidUntil && <span className="oi-key__valid"> · good through {inputs.rateValidUntil}</span>}
              </div>
              <div className="oi-key__note">A lender put this in your hand. Slide the price below — it answers instantly, any hour.</div>
            </>
          ) : (
            <>
              <div className="oi-key__label">No rate in your slider yet</div>
              <div className="oi-key__note">
                A lender puts one real rate in your hand — then every price answers itself, at 7pm on a
                Wednesday, no callback. Solicit a rate to make this real.
              </div>
              {onBuildTeam && (
                <button className="oi-key__cta" onClick={onBuildTeam}>Get a rate → build your team</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── PRICE — the thing you don't know yet. Slide it. ── */}
      <div className="oi-controls">
        <Slider
          label="Home price — try any offer"
          value={inputs.purchasePrice}
          min={150000} max={900000} step={2500}
          format={usd}
          onChange={(v) => set('purchasePrice', v)}
          hint={inputs.listPrice ? `list ${usd(inputs.listPrice)}` : undefined}
          primary
        />
        <Slider
          label="Down payment — yours to set"
          value={inputs.downPaymentPct}
          min={0} max={50} step={0.5}
          format={(v) => `${v}%  ·  ${usd(downDollars)}`}
          onChange={(v) => set('downPaymentPct', v)}
        />
      </div>

      {/* the real supplied numbers, stated (not sliders — they're keys, not guesses) */}
      <div className="oi-keys-row">
        <KeyChip label="Rate" live={hasRate} value={hasRate ? `${inputs.interestRate.value}%` : 'awaiting lender'} />
        <KeyChip label="Insurance/yr" live={hasInsurance} value={hasInsurance ? usd(inputs.annualInsurance.value) : 'awaiting insurer'} />
      </div>

      {/* the statement, moving as you slide price */}
      <LiveBuyersStatement inputs={inputs} providers={providers} areaComps={areaComps} />
    </div>
  );
}

function KeyChip({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <div className={`oi-keychip ${live ? 'is-live' : ''}`}>
      <MaterialIcon icon={live ? 'verified' : 'pending'} className="text-[13px]" />
      <span className="oi-keychip__label">{label}</span>
      <span className="oi-keychip__val">{value}</span>
    </div>
  );
}

function Slider({
  label, value, min, max, step, format, onChange, hint, primary,
}: {
  label: string;
  value: number;
  min: number; max: number; step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
  primary?: boolean;
}) {
  return (
    <div className={`oi-slider ${primary ? 'is-primary' : ''}`}>
      <div className="oi-slider__top">
        <span className="oi-slider__label">{label}</span>
        <span className="oi-slider__value">
          {format(value)}
          {hint && <span className="oi-slider__hint"> · {hint}</span>}
        </span>
      </div>
      <input
        type="range"
        className="oi-slider__input"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
