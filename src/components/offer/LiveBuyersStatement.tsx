'use client';

// ── LiveBuyersStatement — the room ────────────────────────────────────
//
// The buyer's Final Buyer's Statement, LIVE, BEFORE they offer — instead of
// certified after close. Mirrors the real Chicago Title statement section for
// section; every line carries its provider + a provenance tag; it computes the
// buyer's true monthly payment, cash-to-close, offer-vs-list, and how the
// offer's $/sqft sits in the area. Walk in → the true cost of THIS house is
// undeniable, before the signature.
// See memory/project_live_buyers_statement + project_rooms_presence_as_power.

import { useMemo } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import SourceTag from './SourceTag';
import { computeBreakdown } from '@/lib/offer/costEngine';
import { buildStatement, buildOfferPosition } from '@/lib/offer/statement';
import type { OfferInputs, StatementLine } from '@/lib/offer/types';

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usd2 = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function LiveBuyersStatement({
  inputs,
  providers = {},
  areaComps = null,
}: {
  inputs: OfferInputs;
  /** responsible party per line key: { lender, title, insurance } */
  providers?: Record<string, string>;
  /** area $/sqft range from PlotMaps sales data; null = not yet imported */
  areaComps?: { low: number; high: number } | null;
}) {
  const b = useMemo(() => computeBreakdown(inputs), [inputs]);
  const statement = useMemo(() => buildStatement(inputs, b, providers), [inputs, b, providers]);
  const pos = useMemo(() => buildOfferPosition(inputs, areaComps), [inputs, areaComps]);

  const monthly = b.monthly.total;
  const cashToClose = statement.balanceDueFromBuyer;

  return (
    <div className="lbs">
      {/* ── the four decision numbers, up top ── */}
      <div className="lbs-head">
        <Metric k="Your monthly payment" v={usd(monthly)} big />
        <Metric k="Cash to close" v={usd(cashToClose)} big />
        <Metric k="Purchase price" v={usd(pos.offerPrice)} />
        <Metric
          k="vs. list price"
          v={
            pos.vsListDollars == null
              ? '—'
              : `${pos.vsListDollars <= 0 ? '−' : '+'}${usd(Math.abs(pos.vsListDollars))}`
          }
          tone={pos.vsListDollars == null ? undefined : pos.vsListDollars <= 0 ? 'good' : 'warn'}
          sub={pos.vsListPct != null ? `${pos.vsListPct > 0 ? '+' : ''}${pos.vsListPct.toFixed(1)}% of list` : undefined}
        />
      </div>

      {/* ── market fit ($/sqft vs the area) ── */}
      <MarketFit pos={pos} />

      {/* ── the statement, section by section ── */}
      <div className="lbs-stmt">
        <div className="lbs-stmt__head">
          <MaterialIcon icon="receipt_long" className="text-[18px]" />
          <div>
            <div className="lbs-stmt__title">Your Buyer&apos;s Statement — live</div>
            <div className="lbs-stmt__sub">
              The same statement you&apos;d get at closing, before you offer. Every
              line shows who&apos;s responsible and whether it&apos;s real yet.
            </div>
          </div>
        </div>

        {statement.sections.map((s) => (
          <div key={s.id} className="lbs-sec">
            <div className="lbs-sec__title">{s.title}</div>
            {s.lines.map((l) => (
              <Line key={l.key} line={l} />
            ))}
            {s.subtotal != null && (
              <div className="lbs-sub">
                <span>{s.subtotalLabel}</span>
                <b>{usd(s.subtotal)}</b>
              </div>
            )}
          </div>
        ))}

        {/* balance */}
        <div className="lbs-balance">
          <span>Buyer&apos;s funds to close</span>
          <b>{usd(cashToClose)}</b>
        </div>
      </div>
    </div>
  );
}

function Line({ line }: { line: StatementLine }) {
  return (
    <div className="lbs-line">
      <div className="lbs-line__main">
        <div className="lbs-line__label">
          {line.label}
          {line.side === 'credit' && <span className="lbs-line__credit"> credit</span>}
        </div>
        {(line.provider || line.detail) && (
          <div className="lbs-line__meta">
            {line.provider && <span className="lbs-line__provider">{line.provider}</span>}
            {line.provider && line.detail && ' · '}
            {line.detail && <span>{line.detail}</span>}
          </div>
        )}
      </div>
      <div className="lbs-line__right">
        <span className={`lbs-line__amt ${line.side === 'credit' ? 'is-credit' : ''}`}>
          {line.side === 'credit' ? '−' : ''}{usd(line.amount)}
        </span>
        {line.verifiedBy ? (
          <span className="lbs-line__verified" title={`Verified by ${line.verifiedBy.name}`}>
            {line.verifiedBy.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={line.verifiedBy.avatarUrl} alt={line.verifiedBy.name} className="lbs-avatar" />
              : <span className="lbs-avatar lbs-avatar--initial">{line.verifiedBy.name[0]}</span>}
            <MaterialIcon icon="check_circle" className="text-[13px]" />
          </span>
        ) : (
          <SourceTag source={line.source} />
        )}
      </div>
    </div>
  );
}

function MarketFit({ pos }: { pos: ReturnType<typeof buildOfferPosition> }) {
  const pending = pos.areaCompsSource === 'pending-import';
  return (
    <div className="lbs-market">
      <div className="lbs-market__head">
        <span className="lbs-market__title">How this offer fares in the area</span>
        {pos.offerPerSqft != null && (
          <span className="lbs-market__psf">{usd2(pos.offerPerSqft)}/sq ft</span>
        )}
      </div>

      {pending ? (
        <div className="lbs-market__pending">
          <MaterialIcon icon="hourglass_empty" className="text-[15px]" />
          Area comps loading from your PlotMaps sales data.
        </div>
      ) : pos.areaPositionPct == null ? (
        <div className="lbs-market__pending">Add the home&apos;s square footage to see how it compares.</div>
      ) : (
        <>
          <div className="lbs-market__bar">
            <div className="lbs-market__marker" style={{ left: `${(pos.areaPositionPct ?? 0) * 100}%` }} />
          </div>
          <div className="lbs-market__scale">
            <span>{usd(pos.areaPerSqftLow ?? 0)}/sf</span>
            <span className="lbs-market__mid">area range</span>
            <span>{usd(pos.areaPerSqftHigh ?? 0)}/sf</span>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ k, v, big, sub, tone }: { k: string; v: string; big?: boolean; sub?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className={`lbs-metric ${big ? 'is-big' : ''}`}>
      <div className="lbs-metric__k">{k}</div>
      <div className={`lbs-metric__v ${tone ? `is-${tone}` : ''}`}>{v}</div>
      {sub && <div className="lbs-metric__sub">{sub}</div>}
    </div>
  );
}
