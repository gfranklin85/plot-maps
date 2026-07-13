'use client';

// ── MarketSidebar — the right rail (Greg's mockup) ────────────────────
//
// Market Snapshot (computed live from sold_comps) · How this listing compares
// (per-selected $/sqft + DOM vs market) · Payment Fit (target vs estimate +
// what price/down hits the target). Buyer context, not an appraisal.

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { type BuyerSettings, paymentFor, downDollars } from '@/lib/listings/buyerSettings';
import { priceForTarget, downForTarget, fmtMo } from '@/lib/finance/payment';

interface Snapshot {
  city: string;
  counts: { sold: number; active: number; pending: number };
  sold: { medianPrice: number | null; medianDom: number | null; medianPpsf: number | null; saleToListPct: number | null };
  active: { medianPrice: number | null; medianDom: number | null; medianPpsf: number | null };
  pending: { medianPrice: number | null; medianDom: number | null; medianPpsf: number | null };
}

const money = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);
const ppsf = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(n)}/sqft`);

export default function MarketSidebar({ city, settings, selected }: {
  city: string; settings: BuyerSettings; selected: { price: number; sqft: number | null } | null;
}) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/listings/market?city=${encodeURIComponent(city)}`)
      .then((r) => r.json())
      .then((j) => setSnap(j.snapshot ?? null))
      .catch(() => setSnap(null))
      .finally(() => setLoading(false));
  }, [city]);

  // per-selected comparison
  const selPpsf = selected && selected.price > 0 && selected.sqft ? selected.price / selected.sqft : null;
  const soldPpsf = snap?.sold.medianPpsf ?? null;
  const ppsfDelta = selPpsf != null && soldPpsf != null ? selPpsf - soldPpsf : null;

  // payment fit — uses the buyer's settings on the SELECTED listing (or target)
  const price = selected?.price ?? 0;
  const pay = price > 0 ? paymentFor(settings, price) : null;
  const diff = pay ? pay.total - settings.targetMonthly : null;
  const priceToHit = priceForTarget({
    target: settings.targetMonthly,
    downPayment: downDollars(settings, price || snap?.active.medianPrice || 450000),
    annualRatePct: settings.loanType === 'cash' ? 0 : settings.ratePct,
    termYears: settings.termYears,
    annualTaxRate: settings.annualTaxRate,
    monthlyInsurance: settings.monthlyInsurance,
    monthlyHOA: settings.monthlyHOA,
    monthlyPMI: 0,
  });
  const extraDown = price > 0 ? downForTarget({
    target: settings.targetMonthly, price,
    annualRatePct: settings.loanType === 'cash' ? 0 : settings.ratePct, termYears: settings.termYears,
    annualTaxes: price * settings.annualTaxRate, monthlyInsurance: settings.monthlyInsurance, monthlyHOA: settings.monthlyHOA,
  }) - downDollars(settings, price) : 0;

  return (
    <div className="ms">
      {/* Market Snapshot */}
      <div className="ms__card">
        <div className="ms__h"><MaterialIcon icon="monitoring" className="text-[18px]" /> {city} Market Snapshot</div>
        {loading ? <div className="ms__loading">Loading…</div> : !snap || snap.counts.sold + snap.counts.active === 0 ? (
          <div className="ms__loading">No market data for {city} yet.</div>
        ) : (
          <>
            <Stat icon="task_alt" label={`Sold records (${snap.counts.sold})`} value={money(snap.sold.medianPrice)} sub="median" />
            <Stat icon="square_foot" label="Median sold $/sqft" value={ppsf(snap.sold.medianPpsf)} />
            <Stat icon="schedule" label="Median DOM" value={snap.sold.medianDom != null ? `${Math.round(snap.sold.medianDom)} days` : '—'} />
            <Stat icon="sell" label="Sold-to-list ratio" value={snap.sold.saleToListPct != null ? `${snap.sold.saleToListPct}%` : '—'} />
            <div className="ms__sep" />
            <Stat icon="trending_up" label={`Active median list (${snap.counts.active})`} value={money(snap.active.medianPrice)} />
            <Stat icon="schedule" label="Active median DOM" value={snap.active.medianDom != null ? `${Math.round(snap.active.medianDom)} days` : '—'} />
          </>
        )}
      </div>

      {/* How this listing compares */}
      {selected && selPpsf != null && soldPpsf != null && (
        <div className="ms__card">
          <div className="ms__h"><MaterialIcon icon="insights" className="text-[18px]" /> How this listing compares</div>
          <ul className="ms__compare">
            <li><b className="dot dot--b" />This home is listed at <b>${Math.round(selPpsf)}/sqft</b></li>
            <li><b className="dot dot--l" />Recent sold median is <b>${Math.round(soldPpsf)}/sqft</b></li>
            {ppsfDelta != null && Math.abs(ppsfDelta) >= 1 && (
              <li><b className={`dot ${ppsfDelta > 0 ? 'dot--o' : 'dot--g'}`} />About <b>${Math.abs(Math.round(ppsfDelta))}/sqft {ppsfDelta > 0 ? 'above' : 'below'}</b> the sold median</li>
            )}
            {snap?.active.medianDom != null && (
              <li><b className="dot dot--o" />Active homes median <b>{Math.round(snap.active.medianDom)} days</b> on market — leverage may improve as DOM rises</li>
            )}
          </ul>
        </div>
      )}

      {/* Payment Fit */}
      <div className="ms__card">
        <div className="ms__h"><MaterialIcon icon="track_changes" className="text-[18px]" /> Payment Fit</div>
        <div className="ms__fit"><span>Target</span><b>{fmtMo(settings.targetMonthly)}</b></div>
        {pay ? (
          <>
            <div className="ms__fit"><span>Estimated</span><b className="ms__fit-est">{fmtMo(pay.total)}</b></div>
            <div className="ms__fit"><span>Difference</span>
              <b className={diff != null && diff > 0 ? 'ms__over' : 'ms__under'}>{diff != null ? `${diff > 0 ? '+' : ''}${fmtMo(diff)}` : '—'}</b></div>
            {diff != null && Math.abs(diff) > 20 && (
              <div className="ms__guide">
                <MaterialIcon icon="lightbulb" className="text-[15px]" />
                <span>To reach your target, price would need to be about <b>{money(priceToHit)}</b>{extraDown > 500 ? <> or down payment increased by about <b>{money(extraDown)}</b></> : null}.</span>
              </div>
            )}
          </>
        ) : (
          <div className="ms__guide"><MaterialIcon icon="lightbulb" className="text-[15px]" /><span>Select a listing to see how it fits your target. At your settings, a home around <b>{money(priceToHit)}</b> lands near {fmtMo(settings.targetMonthly)}.</span></div>
        )}
      </div>

      <style>{`
        .ms { display: flex; flex-direction: column; gap: 16px; }
        .ms__card { background: #fff; border: 1px solid rgba(19,73,212,0.08); border-radius: 18px; padding: 16px;
          box-shadow: 0 8px 26px -18px rgba(20,50,120,0.4); }
        .ms__h { display: flex; align-items: center; gap: 7px; font-weight: 800; color: #0d1b3e; font-size: 14.5px; }
        .ms__h .material-symbols-rounded, .ms__h .material-icons { color: #1349d4; }
        .ms__loading { padding: 14px 2px; color: #9aa4bc; font-size: 13px; }
        .ms__stat { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; }
        .ms__stat-l { display: flex; align-items: center; gap: 8px; color: #5a6a8c; font-size: 13px; }
        .ms__stat-l .material-symbols-rounded, .ms__stat-l .material-icons { color: rgba(19,73,212,0.55); font-size: 18px !important; }
        .ms__stat-v { font-weight: 800; color: #1a2333; font-size: 14px; }
        .ms__stat-v small { font-weight: 600; color: #9aa4bc; margin-left: 4px; }
        .ms__sep { height: 1px; background: rgba(19,73,212,0.08); margin: 14px 0 2px; }
        .ms__compare { list-style: none; margin-top: 10px; display: flex; flex-direction: column; gap: 9px; }
        .ms__compare li { display: flex; align-items: baseline; gap: 8px; font-size: 13px; color: #3a4a72; line-height: 1.4; }
        .ms__compare b { color: #1a2333; font-weight: 700; }
        .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; margin-top: 5px; }
        .dot--b { background: #1349d4; } .dot--l { background: #7aa3ea; } .dot--o { background: #e0821b; } .dot--g { background: #1a8f4c; }
        .ms__fit { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-size: 14px; color: #3a4a72; }
        .ms__fit b { color: #0d1b3e; }
        .ms__fit-est { color: #1349d4 !important; }
        .ms__over { color: #c0721a !important; } .ms__under { color: #1a8f4c !important; }
        .ms__guide { display: flex; align-items: flex-start; gap: 7px; margin-top: 14px; padding: 12px; border-radius: 11px;
          background: rgba(19,73,212,0.06); font-size: 12.5px; color: #3a4a72; line-height: 1.45; }
        .ms__guide .material-symbols-rounded, .ms__guide .material-icons { color: #1349d4; }
        .ms__guide b { color: #0d1b3e; }
      `}</style>
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="ms__stat">
      <span className="ms__stat-l"><MaterialIcon icon={icon} /> {label}</span>
      <span className="ms__stat-v">{value}{sub && <small>{sub}</small>}</span>
    </div>
  );
}
