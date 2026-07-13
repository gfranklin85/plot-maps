'use client';

// ── AffordabilityCalc — monthly-first, play-and-learn ─────────────────
//
// Replaces 5 interrogation questions (price, monthly, down, income, debts)
// with ONE tool the buyer plays with. They anchor on a MONTHLY payment (the
// thing they can judge), set a rate (with historical teaching context), and
// SEE the home price it reaches. Optional income + debts add a DTI health
// note — the lowballer catch. No rate is hardcoded as "the answer"; real
// numbers come from lenders (and later Plot's own financing).
//
// Reports up via onChange({ monthly, price, down, income, debts }) so
// StatePosition's existing /api/bullpen payload is unchanged.
// memory: project_two_doors_to_qualify, feedback_brand_fidelity (navy ink,
// #1349d4 interactive), feedback_one_viewport_pages.

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/buyer-settings/piti';
import {
  affordablePrice, backEndDTI, rateNote, RATE_TODAY_BAND,
} from '@/lib/finance/affordability';

const BRAND = 'var(--plot-brand, #1349d4)';
const INK = 'var(--plot-brand-deep, #122d8d)';
const MUTED = '#6b7699';

export interface AffordabilityValues {
  monthly: string;   // "$2,400"
  price: string;     // "$390,000" (the discovered estimate)
  down: string;      // "$80,000"
  income: string;    // optional — "$95,000"
  debts: string;     // optional — "$650"
}

export default function AffordabilityCalc({
  onChange,
}: {
  onChange: (v: AffordabilityValues) => void;
}) {
  const [monthly, setMonthly] = useState(2400);
  const [rate, setRate] = useState(6.5);
  const [down, setDown] = useState(40000);
  const [showSharpen, setShowSharpen] = useState(false);
  const [income, setIncome] = useState(0);   // annual
  const [debts, setDebts] = useState(0);      // monthly

  const { homePrice } = useMemo(
    () => affordablePrice({ monthlyTarget: monthly, downPayment: down, rate, term: 30 }),
    [monthly, down, rate],
  );

  const dti = useMemo(() => {
    if (income <= 0) return null;
    return backEndDTI({ housingPayment: monthly, monthlyDebts: debts, monthlyIncome: income / 12 });
  }, [income, debts, monthly]);

  // report up on every change (keeps StatePosition's answers + payload in sync)
  useEffect(() => {
    onChange({
      monthly: formatMoney(monthly) + '/mo',
      price: formatMoney(homePrice),
      down: formatMoney(down),
      income: income > 0 ? formatMoney(income) + '/yr' : '',
      debts: debts > 0 ? formatMoney(debts) + '/mo' : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly, homePrice, down, income, debts]);

  // rate slider: highlight the realistic "today" band on the track
  const RATE_MIN = 2, RATE_MAX = 12;
  const bandLeft = ((RATE_TODAY_BAND.low - RATE_MIN) / (RATE_MAX - RATE_MIN)) * 100;
  const bandWidth = ((RATE_TODAY_BAND.high - RATE_TODAY_BAND.low) / (RATE_MAX - RATE_MIN)) * 100;

  return (
    <div className="afc">
      {/* the discovered price — the payoff, up top */}
      <div className="afc-out">
        <div className="afc-out__label">At about {formatMoney(monthly)}/mo, you could reach</div>
        <div className="afc-out__price">{formatMoney(homePrice)}</div>
        <div className="afc-out__note">
          An estimate to play with — lenders (and Plot&apos;s own financing) will bring you real numbers.
        </div>
      </div>

      {/* monthly — the anchor */}
      <label className="afc-row">
        <div className="afc-row__top">
          <span className="afc-row__label">A monthly payment you&apos;re comfortable with</span>
          <span className="afc-row__val">{formatMoney(monthly)}/mo</span>
        </div>
        <input type="range" min={800} max={8000} step={50} value={monthly}
          onChange={(e) => setMonthly(Number(e.target.value))} className="afc-slider" />
      </label>

      {/* rate — with historical teaching + highlighted "today" band */}
      <label className="afc-row">
        <div className="afc-row__top">
          <span className="afc-row__label">Interest rate</span>
          <span className="afc-row__val">{rate.toFixed(2)}%</span>
        </div>
        <div className="afc-rate">
          <div className="afc-rate__band" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
          <input type="range" min={RATE_MIN} max={RATE_MAX} step={0.1} value={rate}
            onChange={(e) => setRate(Number(e.target.value))} className="afc-slider afc-slider--rate" />
        </div>
        <p className="afc-rate__note">{rateNote(rate)}</p>
      </label>

      {/* down payment */}
      <label className="afc-row">
        <div className="afc-row__top">
          <span className="afc-row__label">Down payment</span>
          <span className="afc-row__val">{formatMoney(down)}</span>
        </div>
        <input type="range" min={0} max={200000} step={5000} value={down}
          onChange={(e) => setDown(Number(e.target.value))} className="afc-slider" />
      </label>

      {/* optional sharpen — DTI */}
      {!showSharpen ? (
        <button className="afc-sharpen__toggle" onClick={() => setShowSharpen(true)}>
          + Sharpen it (optional) — add income &amp; debts for a comfort check
        </button>
      ) : (
        <div className="afc-sharpen">
          <div className="afc-sharpen__grid">
            <div>
              <span className="afc-mini__label">Yearly income</span>
              <div className="afc-mini__field"><span>$</span>
                <input type="number" value={income || ''} placeholder="95,000"
                  onChange={(e) => setIncome(Math.max(0, Number(e.target.value)))} />
              </div>
            </div>
            <div>
              <span className="afc-mini__label">Monthly debts</span>
              <div className="afc-mini__field"><span>$</span>
                <input type="number" value={debts || ''} placeholder="650"
                  onChange={(e) => setDebts(Math.max(0, Number(e.target.value)))} />
              </div>
            </div>
          </div>
          {dti && (
            <p className={`afc-dti afc-dti--${dti.health}`}>
              {dti.health === 'comfortable' && `Looks comfortable — at ${formatMoney(income / 12)}/mo income, ${formatMoney(monthly)}/mo sits at ${Math.round(dti.ratio * 100)}%. You may qualify for more.`}
              {dti.health === 'workable' && `Workable — that's about ${Math.round(dti.ratio * 100)}% of your income. Right around where lenders look.`}
              {dti.health === 'stretched' && `A stretch — that's ~${Math.round(dti.ratio * 100)}% of your income, above the usual comfort zone. Lenders can talk options.`}
            </p>
          )}
        </div>
      )}

      <style>{`
        .afc { display: flex; flex-direction: column; gap: 20px; }

        .afc-out { text-align: center; padding: 6px 0 4px; }
        .afc-out__label { font-size: 13px; font-weight: 600; color: ${MUTED}; }
        .afc-out__price { font-family: var(--font-headline, inherit); font-weight: 800; font-size: clamp(34px, 6vw, 46px); letter-spacing: -0.02em; color: ${INK}; line-height: 1.05; margin-top: 2px; }
        .afc-out__note { font-size: 12px; color: ${MUTED}; margin-top: 8px; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.45; }

        .afc-row { display: block; }
        .afc-row__top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
        .afc-row__label { font-size: 13.5px; font-weight: 600; color: ${INK}; }
        .afc-row__val { font-size: 14px; font-weight: 800; color: ${BRAND}; font-variant-numeric: tabular-nums; }

        .afc-slider { width: 100%; cursor: pointer; accent-color: #1349d4; }

        .afc-rate { position: relative; }
        .afc-rate__band { position: absolute; top: 50%; transform: translateY(-50%); height: 8px; border-radius: 999px; background: rgba(19,73,212,0.14); pointer-events: none; }
        .afc-slider--rate { position: relative; z-index: 1; background: transparent; }
        .afc-rate__note { font-size: 12px; color: ${MUTED}; margin-top: 8px; line-height: 1.4; }

        .afc-sharpen__toggle { align-self: flex-start; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 700; color: ${BRAND}; padding: 4px 0; }
        .afc-sharpen__toggle:hover { color: ${INK}; }
        .afc-sharpen { border-top: 1px solid rgba(19,73,212,0.12); padding-top: 16px; display: flex; flex-direction: column; gap: 12px; }
        .afc-sharpen__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .afc-mini__label { display: block; font-size: 12px; font-weight: 600; color: ${INK}; margin-bottom: 5px; }
        .afc-mini__field { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-radius: 10px; background: #fff; border: 1px solid rgba(19,73,212,0.2); }
        .afc-mini__field span { color: ${MUTED}; font-size: 14px; font-weight: 600; }
        .afc-mini__field input { flex: 1; min-width: 0; border: none; outline: none; font-size: 15px; color: ${INK}; background: transparent; }

        .afc-dti { font-size: 12.5px; line-height: 1.5; padding: 10px 12px; border-radius: 10px; }
        .afc-dti--comfortable { background: rgba(27,158,106,0.09); color: #12734e; }
        .afc-dti--workable { background: rgba(19,73,212,0.07); color: ${INK}; }
        .afc-dti--stretched { background: rgba(214,120,20,0.1); color: #9a5410; }
      `}</style>
    </div>
  );
}
