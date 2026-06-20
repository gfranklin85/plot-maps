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
// Light brand-blue language to match the launcher / front page
// (project_front_page_locked, project_plot_palette_locked: brand #1349d4).
// Built to drop into the buyer portal AND sit beside RpaFlow.

import { useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import SourceTag from './SourceTag';
import LoanApplicationCard from './LoanApplicationCard';
import InsuranceQuoteCard from './InsuranceQuoteCard';
import { computeBreakdown } from '@/lib/offer/costEngine';
import { DEFAULT_INPUTS, type OfferInputs, type CostLine } from '@/lib/offer/types';

const BRAND = '#1349d4';
const INK = '#0c1322';
const BODY = '#4a5568';
const MUTED = '#8a93a4';

const PANEL_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  border: '1px solid rgba(19,73,212,0.10)',
  boxShadow: '0 12px 30px -22px rgba(20,50,120,0.4)',
};
const INPUT_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid rgba(19,73,212,0.18)',
  color: INK,
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
        <div className="text-[11px] uppercase tracking-[0.3em] font-bold" style={{ color: BRAND }}>
          Offer Cost Cockpit · the live numbers
        </div>
        <h2 className="font-headline text-2xl md:text-3xl font-extrabold mt-1.5" style={{ color: INK }}>
          Every dollar. You drive it.
        </h2>
        <p className="text-sm mt-2 max-w-2xl leading-relaxed" style={{ color: BODY }}>
          This is the breakdown your lender wouldn&apos;t build you. Move any
          number. Each line shows where it came from — a real quote, your own
          figure, or a stand-in waiting on your application.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5">
        {/* ── LEFT: the drivers ── */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5 relative overflow-hidden" style={PANEL_STYLE}>
            <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: INK }}>
              <MaterialIcon icon="tune" className="text-[18px]" />
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
                <label className="text-xs font-semibold" style={{ color: INK }}>
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
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)] disabled:opacity-40"
                  style={INPUT_STYLE}
                />
                <span className="text-sm font-semibold" style={{ color: MUTED }}>%</span>
              </div>
              <p className="text-[11px] mt-1.5 leading-snug" style={{ color: MUTED }}>
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
            <BigNumber label="Monthly" value={usd(b.monthly.total)} accent={BRAND} />
            <BigNumber label="Cash to close" value={usd(b.cashToClose.total)} accent="#1b9e6a" />
            <BigNumber
              label={inputs.loanType === 'cash' ? 'Loan' : 'Total interest'}
              value={inputs.loanType === 'cash' ? '$0' : usd(b.totalInterest)}
              accent="#b8860b"
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

          <p className="text-[11px] leading-relaxed px-1" style={{ color: MUTED }}>
            Lines marked <span className="font-semibold" style={{ color: '#b8860b' }}>Estimate</span> are
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
          <span className="text-sm font-medium" style={{ color: INK }}>{line.label}</span>
          <SourceTag source={line.source} />
        </div>
        {line.note && (
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: MUTED }}>{line.note}</p>
        )}
      </div>
      <span className="text-sm font-bold tabular-nums shrink-0" style={{ color: INK }}>
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
        <h3 className="text-sm font-bold" style={{ color: INK }}>{title}</h3>
        <span className="text-base font-extrabold tabular-nums" style={{ color: BRAND }}>{total}</span>
      </div>
      <div className="divide-y divide-[rgba(19,73,212,0.08)]">{children}</div>
    </div>
  );
}

function SubHead({ label, total }: { label: string; total: string }) {
  return (
    <div className="flex items-center justify-between pt-3 pb-1">
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: MUTED }}>
        {label}
      </span>
      <span className="text-xs font-semibold tabular-nums" style={{ color: BODY }}>{total}</span>
    </div>
  );
}

function BigNumber({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-2xl p-3.5 text-center relative overflow-hidden"
      style={{
        background: '#ffffff',
        border: `1px solid ${accent}26`,
        boxShadow: `0 12px 28px -20px ${accent}, inset 0 1px 0 rgba(255,255,255,0.6)`,
      }}
    >
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold" style={{ color: accent }}>
        {label}
      </div>
      <div className="text-lg md:text-xl font-extrabold mt-1 tabular-nums" style={{ color: INK }}>{value}</div>
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
      <label className="text-xs font-semibold" style={{ color: INK }}>{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-sm font-semibold" style={{ color: MUTED }}>$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)]"
          style={INPUT_STYLE}
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
        <label className="text-xs font-semibold" style={{ color: INK }}>{label}</label>
        <span className="text-xs font-bold tabular-nums" style={{ color: BRAND }}>{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
        style={{ accentColor: BRAND }}
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
      <label className="text-xs font-semibold" style={{ color: INK }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)]"
        style={INPUT_STYLE}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
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
      className="w-full text-left rounded-2xl p-4 relative overflow-hidden transition-all hover:-translate-y-0.5"
      style={PANEL_STYLE}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(160deg, rgba(19,73,212,0.14), rgba(19,73,212,0.06))',
            border: '1px solid rgba(19,73,212,0.22)',
          }}
        >
          <span style={{ color: BRAND }}><MaterialIcon icon={icon} className="text-[20px]" /></span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold" style={{ color: INK }}>{title}</span>
            {submitted ? (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(27,158,106,0.10)', border: '1px solid rgba(27,158,106,0.34)', color: '#1b9e6a' }}>
                Submitted
              </span>
            ) : (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(217,176,102,0.14)', border: '1px solid rgba(184,134,11,0.34)', color: '#b8860b' }}>
                Necessary card
              </span>
            )}
          </div>
          <p className="text-[11px] mt-1 leading-snug" style={{ color: BODY }}>{blurb}</p>
        </div>
        <span style={{ color: BRAND }}><MaterialIcon icon="arrow_forward" className="text-[18px] mt-1" /></span>
      </div>
    </button>
  );
}
