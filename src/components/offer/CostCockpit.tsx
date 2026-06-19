'use client';

// ── CostCockpit — the live calculator a buyer makes a real offer from ──
//
// The thing the lender said couldn't exist ("rates change daily"). A rate
// is ONE input; everything else is deterministic math the buyer drives
// themselves. Drag the down payment, the term, the rate — every dollar in
// the breakdown recomputes instantly, and each line is tagged by source so
// the buyer always knows what's real vs. their own number vs. a stand-in
// waiting on their loan/insurance application.
//
// Built to drop into the buyer portal AND sit beside RpaFlow (the money
// lens next to the negotiation lens). Same locked desk palette.

import { useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import SourceTag from './SourceTag';
import LoanApplicationCard from './LoanApplicationCard';
import InsuranceQuoteCard from './InsuranceQuoteCard';
import { computeBreakdown } from '@/lib/offer/costEngine';
import { DEFAULT_INPUTS, type OfferInputs, type CostLine } from '@/lib/offer/types';

const PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(34,44,68,0.92), rgba(13,20,36,0.96))',
  border: '1px solid rgba(125,168,255,0.16)',
  boxShadow: '0 18px 40px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,210,255,0.14)',
};

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function CostCockpit({
  initialPrice,
  monthlyHoa = 0,
}: {
  /** prefilled from the parcel/listing the buyer is standing on */
  initialPrice?: number;
  monthlyHoa?: number;
}) {
  const [inputs, setInputs] = useState<OfferInputs>(() => ({
    ...DEFAULT_INPUTS,
    purchasePrice: initialPrice ?? DEFAULT_INPUTS.purchasePrice,
    monthlyHoa,
  }));
  const [appOpen, setAppOpen] = useState<'loan' | 'insurance' | null>(null);

  const b = useMemo(() => computeBreakdown(inputs), [inputs]);

  const set = <K extends keyof OfferInputs>(k: K, v: OfferInputs[K]) =>
    setInputs((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      {/* header */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.4em] text-[rgba(0,242,255,0.7)] font-bold">
          Offer Cost Cockpit · the live numbers
        </div>
        <h2 className="font-headline text-2xl md:text-3xl font-extrabold text-white mt-1.5 [text-shadow:0_2px_24px_rgba(0,242,255,0.18)]">
          Every dollar. You drive it.
        </h2>
        <p className="text-sm text-[rgba(200,215,255,0.65)] mt-2 max-w-2xl leading-relaxed">
          This is the breakdown your lender wouldn&apos;t build you. Move any
          number. Each line shows where it came from — a real quote, your own
          figure, or a stand-in waiting on your application.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5">
        {/* ── LEFT: the drivers ── */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5 relative overflow-hidden" style={PANEL_STYLE}>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <MaterialIcon icon="tune" className="text-[18px] text-[#00f2ff]" />
              What you control
            </h3>

            <MoneyInput
              label="Purchase price"
              value={inputs.purchasePrice}
              onChange={(v) => set('purchasePrice', v)}
            />

            <Slider
              label="Down payment"
              suffix={`${inputs.downPaymentPct}%  ·  ${usd(b.cashToClose.downPayment.amount)}`}
              min={0}
              max={100}
              step={0.5}
              value={inputs.downPaymentPct}
              onChange={(v) => set('downPaymentPct', v)}
            />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <SelectField
                label="Loan type"
                value={inputs.loanType}
                onChange={(v) => set('loanType', v as OfferInputs['loanType'])}
                options={[
                  ['conventional', 'Conventional'],
                  ['fha', 'FHA'],
                  ['va', 'VA'],
                  ['cash', 'All cash'],
                ]}
              />
              <SelectField
                label="Term"
                value={String(inputs.termYears)}
                onChange={(v) => set('termYears', Number(v))}
                options={[
                  ['30', '30 years'],
                  ['20', '20 years'],
                  ['15', '15 years'],
                ]}
              />
            </div>

            {/* rate — provider-maintained or buyer-entered */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[rgba(220,230,255,0.8)]">
                  Interest rate
                </label>
                <SourceTag source={inputs.interestRate.source} />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.125"
                  value={inputs.interestRate.value}
                  disabled={inputs.loanType === 'cash'}
                  onChange={(e) =>
                    set('interestRate', {
                      value: Number(e.target.value),
                      source: 'buyer-entered',
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgba(0,242,255,0.3)] disabled:opacity-40"
                  style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(125,168,255,0.22)' }}
                />
                <span className="text-sm text-[rgba(180,200,255,0.6)] font-semibold">%</span>
              </div>
              <p className="text-[11px] text-[rgba(200,215,255,0.5)] mt-1.5 leading-snug">
                {inputs.interestRate.source === 'pending-application'
                  ? "This is a stand-in. Submit a loan application below — a lender picks it up and writes your real rate here."
                  : inputs.interestRate.source === 'live-provider'
                  ? `Your lender's live rate${inputs.rateValidUntil ? `, good through ${inputs.rateValidUntil}` : ''}.`
                  : 'Your number — type what you were quoted.'}
              </p>
            </div>

            <Slider
              label="Discount points"
              suffix={`${inputs.pointsPct}%`}
              min={0}
              max={3}
              step={0.125}
              value={inputs.pointsPct}
              onChange={(v) => set('pointsPct', v)}
              disabled={inputs.loanType === 'cash'}
            />
          </div>

          {/* the two claimable cards — the marketplace lead engine */}
          <ClaimRow
            icon="account_balance"
            title="Loan Application"
            state={inputs.loanState}
            blurb="Fill this once. A lender picks it up, works your file, and your real rate + fees flow in here."
            onOpen={() => setAppOpen('loan')}
          />
          <ClaimRow
            icon="shield"
            title="Homeowners Insurance"
            state={inputs.insuranceState}
            blurb="Get a real quote wired straight into your breakdown — not a guess."
            onOpen={() => setAppOpen('insurance')}
          />
        </div>

        {/* ── RIGHT: the breakdown ── */}
        <div className="space-y-4">
          {/* the three big numbers */}
          <div className="grid grid-cols-3 gap-3">
            <BigNumber label="Monthly" value={usd(b.monthly.total)} accent="#00f2ff" />
            <BigNumber label="Cash to close" value={usd(b.cashToClose.total)} accent="#5ed6a8" />
            <BigNumber
              label={inputs.loanType === 'cash' ? 'Loan' : 'Total interest'}
              value={inputs.loanType === 'cash' ? '$0' : usd(b.totalInterest)}
              accent="#fbc64f"
            />
          </div>

          {/* monthly itemized */}
          <Section title="Your monthly payment" total={usd(b.monthly.total)}>
            <LineItem line={b.monthly.principalAndInterest} />
            <LineItem line={b.monthly.propertyTax} />
            <LineItem line={b.monthly.insurance} />
            {b.monthly.pmi.amount > 0 && <LineItem line={b.monthly.pmi} />}
            {b.monthly.hoa.amount > 0 && <LineItem line={b.monthly.hoa} />}
          </Section>

          {/* cash to close itemized */}
          <Section title="Cash to close" total={usd(b.cashToClose.total)}>
            <LineItem line={b.cashToClose.downPayment} />
            {b.cashToClose.closingCosts.length > 0 && (
              <SubHead label="Closing costs" total={usd(b.cashToClose.closingCostsSubtotal)} />
            )}
            {b.cashToClose.closingCosts.map((l) => (
              <LineItem key={l.key} line={l} indented />
            ))}
            {b.cashToClose.prepaids.length > 0 && (
              <SubHead label="Prepaids & impounds" total={usd(b.cashToClose.prepaidsSubtotal)} />
            )}
            {b.cashToClose.prepaids.map((l) => (
              <LineItem key={l.key} line={l} indented />
            ))}
          </Section>

          <p className="text-[11px] text-[rgba(180,200,255,0.45)] leading-relaxed px-1">
            Lines marked <span className="text-[#fbc64f] font-semibold">Estimate</span> are
            stand-ins until a licensed lender or insurer writes the real number in. Nothing here
            is a binding quote — it&apos;s your live working offer, and you control every figure.
          </p>
        </div>
      </div>

      {appOpen === 'loan' && (
        <LoanApplicationCard
          inputs={inputs}
          onClose={() => setAppOpen(null)}
          onSubmitted={() => {
            set('loanState', 'application-submitted');
            setAppOpen(null);
          }}
        />
      )}
      {appOpen === 'insurance' && (
        <InsuranceQuoteCard
          inputs={inputs}
          onClose={() => setAppOpen(null)}
          onSubmitted={() => {
            set('insuranceState', 'application-submitted');
            setAppOpen(null);
          }}
        />
      )}
    </div>
  );
}

/* ── pieces ── */

function LineItem({ line, indented }: { line: CostLine; indented?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2 ${indented ? 'pl-3' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-[rgba(225,235,255,0.92)] font-medium">{line.label}</span>
          <SourceTag source={line.source} />
        </div>
        {line.note && (
          <p className="text-[11px] text-[rgba(180,200,255,0.5)] mt-0.5 leading-snug">{line.note}</p>
        )}
      </div>
      <span className="text-sm font-bold text-white tabular-nums shrink-0">
        {line.amount.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: line.amount < 100 ? 2 : 0,
        })}
      </span>
    </div>
  );
}

function Section({
  title,
  total,
  children,
}: {
  title: string;
  total: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-5 relative overflow-hidden" style={PANEL_STYLE}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-base font-extrabold text-[#00f2ff] tabular-nums">{total}</span>
      </div>
      <div className="divide-y divide-[rgba(125,168,255,0.1)]">{children}</div>
    </div>
  );
}

function SubHead({ label, total }: { label: string; total: string }) {
  return (
    <div className="flex items-center justify-between pt-3 pb-1">
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[rgba(180,200,255,0.55)]">
        {label}
      </span>
      <span className="text-xs font-semibold text-[rgba(180,200,255,0.6)] tabular-nums">{total}</span>
    </div>
  );
}

function BigNumber({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-2xl p-3.5 text-center relative overflow-hidden"
      style={{
        ...PANEL_STYLE,
        boxShadow: `0 14px 32px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,210,255,0.14), 0 0 32px -16px ${accent}`,
      }}
    >
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: accent }}>
        {label}
      </div>
      <div className="text-lg md:text-xl font-extrabold text-white mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-1">
      <label className="text-xs font-semibold text-[rgba(220,230,255,0.8)]">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-sm text-[rgba(180,200,255,0.6)] font-semibold">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgba(0,242,255,0.3)]"
          style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(125,168,255,0.22)' }}
        />
      </div>
    </div>
  );
}

function Slider({
  label,
  suffix,
  min,
  max,
  step,
  value,
  onChange,
  disabled,
}: {
  label: string;
  suffix: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`mt-4 ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-[rgba(220,230,255,0.8)]">{label}</label>
        <span className="text-xs font-bold text-[#00f2ff] tabular-nums">{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00d8e6] cursor-pointer"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-[rgba(220,230,255,0.8)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[rgba(0,242,255,0.3)]"
        style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(125,168,255,0.22)' }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} style={{ background: '#0b1020' }}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

function ClaimRow({
  icon,
  title,
  state,
  blurb,
  onOpen,
}: {
  icon: string;
  title: string;
  state: OfferInputs['loanState'];
  blurb: string;
  onOpen: () => void;
}) {
  const submitted = state !== 'needs-application';
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-4 relative overflow-hidden transition-all hover:brightness-110"
      style={PANEL_STYLE}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(160deg, rgba(0,242,255,0.22), rgba(0,242,255,0.08))',
            border: '1px solid rgba(0,242,255,0.35)',
          }}
        >
          <MaterialIcon icon={icon} className="text-[20px] text-[#00f2ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{title}</span>
            {submitted ? (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(94,214,168,0.14)', border: '1px solid rgba(94,214,168,0.4)', color: '#5ed6a8' }}>
                Submitted
              </span>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,198,79,0.12)', border: '1px solid rgba(251,198,79,0.38)', color: '#fbc64f' }}>
                Necessary card
              </span>
            )}
          </div>
          <p className="text-[11px] text-[rgba(200,215,255,0.6)] mt-1 leading-snug">{blurb}</p>
        </div>
        <MaterialIcon icon="arrow_forward" className="text-[18px] text-[rgba(0,242,255,0.7)] mt-1" />
      </div>
    </button>
  );
}
