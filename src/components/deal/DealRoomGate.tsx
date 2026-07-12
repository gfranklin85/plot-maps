'use client';

// ── DealRoomGate — the comp-acknowledgment gate ───────────────────────
//
// Two states of one door:
//   SEALED  — the cover sheet + the compensation + the fork. The seller sees
//             who's here (proudly, by name), what the buyer's agent is asking
//             in comp, and that the BUYER authorized presenting them as one
//             package. Then a clean either/or: Acknowledge & View, or Send back.
//   OPEN    — acknowledged. The full terms + (next) the net-to-seller waterfall.
//
// The moral engine, in one line: you don't get to keep the fruit of the
// representation while refusing to pay for the representation. The gate makes
// that structurally true instead of a thing agents beg for at the table.
//
// Voice: plot-maps (bus-stop plain), NOT the old sci-fi register. Flat
// --plot-brand, no gradients-for-decoration. memory: feedback_brand_fidelity.

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { OfferPackage } from '@/lib/deal/offerPackage';

const BRAND = 'var(--plot-brand, #1349d4)';
const INK = 'var(--plot-ink, #0c1322)';
const MUTED = '#4a5568';

function money(n?: number) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

export default function DealRoomGate({ pkg }: { pkg: OfferPackage }) {
  // Local state drives the demo handshake; persists to the package later.
  const [status, setStatus] = useState(pkg.status);
  const acknowledged = status === 'open' || status === 'selected' || status === 'declined';

  return (
    <div className="fp app-surface min-h-screen">
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-10 md:py-16">
        {/* who's here — proudly, by name. nothing hidden. */}
        <Masthead pkg={pkg} />

        {status === 'sent-back' ? (
          <SentBack pkg={pkg} onReopen={() => setStatus('sealed')} />
        ) : !acknowledged ? (
          <Sealed
            pkg={pkg}
            onAcknowledge={() => setStatus('open')}
            onSendBack={() => setStatus('sent-back')}
          />
        ) : (
          <Opened pkg={pkg} />
        )}
      </div>
    </div>
  );
}

// ── Masthead — the property + the two sides ───────────────────────────
function Masthead({ pkg }: { pkg: OfferPackage }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] uppercase tracking-[0.4em] font-bold" style={{ color: BRAND }}>
        Deal room
      </div>
      <h1 className="font-headline text-2xl md:text-3xl font-extrabold mt-1.5 leading-tight" style={{ color: INK }}>
        An offer on {pkg.property.address}
      </h1>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PartyCard
          eyebrow="Buyer's agent"
          name={pkg.buyerAgent.name}
          sub={[pkg.buyerAgent.firm, pkg.buyerAgent.license].filter(Boolean).join(' · ')}
          icon="badge"
          accent
        />
        <PartyCard
          eyebrow="For the buyer"
          name={pkg.buyer.name}
          sub={pkg.coverSheet.qualification}
          icon="person"
        />
      </div>
    </div>
  );
}

function PartyCard({
  eyebrow, name, sub, icon, accent,
}: { eyebrow: string; name: string; sub?: string; icon: string; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: accent ? 'rgba(19,73,212,0.06)' : 'rgba(255,255,255,0.86)',
        border: `1px solid ${accent ? 'rgba(19,73,212,0.22)' : 'rgba(19,73,212,0.10)'}`,
      }}
    >
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(19,73,212,0.10)', color: BRAND }}
      >
        <MaterialIcon icon={icon} className="text-[18px]" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: BRAND }}>{eyebrow}</div>
        <div className="font-bold truncate" style={{ color: INK }}>{name}</div>
        {sub && <div className="text-xs mt-0.5 leading-snug" style={{ color: MUTED }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── SEALED — the gate itself ──────────────────────────────────────────
function Sealed({
  pkg, onAcknowledge, onSendBack,
}: { pkg: OfferPackage; onAcknowledge: () => void; onSendBack: () => void }) {
  return (
    <div className="space-y-5">
      {/* the cover sheet — why you should open this, without the sealed number */}
      {pkg.coverSheet.headline && (
        <div
          className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(19,73,212,0.10)' }}
        >
          <p className="text-[15px] leading-relaxed font-medium" style={{ color: '#1a2c52' }}>
            {pkg.coverSheet.headline}
          </p>
        </div>
      )}

      {/* the gate panel */}
      <div
        className="rounded-2xl p-6 md:p-8 relative overflow-hidden"
        style={{ background: '#fff', border: '1px solid rgba(19,73,212,0.16)', boxShadow: '0 16px 40px -26px rgba(20,50,120,0.5)' }}
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color: BRAND }}>
          <MaterialIcon icon="lock" className="text-[15px]" />
          The offer is sealed
        </div>

        <h2 className="font-headline text-xl md:text-2xl font-bold mt-3 leading-snug" style={{ color: INK }}>
          This offer and the agent&apos;s compensation came in together — as one package.
        </h2>

        <p className="text-sm md:text-[15px] mt-3 leading-relaxed" style={{ color: MUTED }}>
          {pkg.buyerAgent.name} brought you a real, qualified buyer and a written
          offer. The compensation is the cost of that work — it&apos;s why the
          agent showed up. To see the offer&apos;s terms, acknowledge the
          compensation that came with it. You can still accept, counter, or
          decline the whole thing after — you just can&apos;t keep the offer
          while stripping the compensation out of it.
        </p>

        {/* the comp figure — the thing being acknowledged */}
        <div
          className="mt-5 rounded-xl p-4 flex items-center justify-between gap-4"
          style={{ background: 'rgba(19,73,212,0.06)', border: '1px solid rgba(19,73,212,0.22)' }}
        >
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: BRAND }}>
              Buyer-broker compensation
            </div>
            <div className="font-bold text-lg" style={{ color: INK }}>{pkg.compensation.display}</div>
          </div>
          <MaterialIcon icon="handshake" className="text-[28px]" />
        </div>

        {/* the authorization — answers "says who?" → says the buyer */}
        {pkg.authorization.authorized && (
          <div className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed" style={{ color: '#1a2c52' }}>
            <span style={{ color: BRAND }} className="mt-0.5 shrink-0"><MaterialIcon icon="verified" className="text-[16px]" /></span>
            <span>
              <b>{pkg.buyer.name}</b> directed that their offer and their
              agent&apos;s compensation be presented as one package — co-signed
              on the {pkg.authorization.instrument}. This isn&apos;t the
              agent&apos;s move; it&apos;s the buyer&apos;s.
            </span>
          </div>
        )}

        {/* the fork — never trapped */}
        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <button
            onClick={onAcknowledge}
            className="flex-1 py-3.5 rounded-full text-sm font-bold transition-all inline-flex items-center justify-center gap-2"
            style={{ background: BRAND, color: '#fff', boxShadow: '0 10px 24px -10px rgba(19,73,212,0.7)' }}
          >
            <MaterialIcon icon="lock_open" className="text-[17px]" />
            Acknowledge &amp; view offer
          </button>
          <button
            onClick={onSendBack}
            className="py-3.5 px-6 rounded-full text-sm font-semibold transition-all inline-flex items-center justify-center gap-2"
            style={{ background: '#fff', color: MUTED, border: '1px solid rgba(19,73,212,0.18)' }}
          >
            <MaterialIcon icon="reply" className="text-[16px]" />
            Send it back
          </button>
        </div>

        <p className="text-[11px] mt-4 leading-relaxed" style={{ color: '#6b7689' }}>
          Acknowledging isn&apos;t accepting. It only opens the offer so you can
          read it as the one package it is.
        </p>
      </div>
    </div>
  );
}

// ── SENT BACK — the honest refusal branch ─────────────────────────────
function SentBack({ pkg, onReopen }: { pkg: OfferPackage; onReopen: () => void }) {
  return (
    <div
      className="rounded-2xl p-6 md:p-8 text-center"
      style={{ background: '#fff', border: '1px solid rgba(19,73,212,0.14)', boxShadow: '0 16px 40px -26px rgba(20,50,120,0.5)' }}
    >
      <span
        className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4"
        style={{ background: 'rgba(19,73,212,0.08)', color: BRAND }}
      >
        <MaterialIcon icon="reply" className="text-[28px]" />
      </span>
      <h2 className="font-headline text-xl font-bold" style={{ color: INK }}>
        Sent back — the package stays whole.
      </h2>
      <p className="text-sm mt-2.5 max-w-md mx-auto leading-relaxed" style={{ color: MUTED }}>
        You chose not to acknowledge the compensation, so the offer wasn&apos;t
        opened. Nothing was stripped and nothing was kept. {pkg.buyerAgent.name} will
        see that it came back and decide what&apos;s next. No hard feelings — a
        clean no is worth more than a quiet squeeze.
      </p>
      <button
        onClick={onReopen}
        className="mt-6 text-sm font-semibold inline-flex items-center gap-1.5 hover:underline"
        style={{ color: BRAND }}
      >
        <MaterialIcon icon="arrow_back" className="text-[16px]" />
        Take another look
      </button>
    </div>
  );
}

// ── OPENED — terms revealed (net waterfall lands here next) ────────────
function Opened({ pkg }: { pkg: OfferPackage }) {
  const t = pkg.terms;
  const coe = t.closeOfEscrowDate
    ? new Date(t.closeOfEscrowDate).toLocaleDateString()
    : t.closeOfEscrowDays != null ? `${t.closeOfEscrowDays} days` : '—';

  const cont = (d?: number | null) => (d === null ? 'Waived' : d != null ? `${d} days` : '—');

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl p-3.5 flex items-center gap-2.5 text-sm font-semibold"
        style={{ background: 'rgba(27,158,106,0.08)', border: '1px solid rgba(27,158,106,0.28)', color: '#1b7a55' }}
      >
        <MaterialIcon icon="lock_open" className="text-[18px]" />
        Compensation acknowledged — the offer is open. It&apos;s one package now.
      </div>

      {/* the price */}
      <div
        className="rounded-2xl p-6"
        style={{ background: '#fff', border: '1px solid rgba(19,73,212,0.14)', boxShadow: '0 16px 40px -26px rgba(20,50,120,0.5)' }}
      >
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: BRAND }}>Offer price</div>
        <div className="font-headline text-4xl font-extrabold mt-1 tracking-tight" style={{ color: INK }}>
          {money(t.purchasePrice)}
        </div>
        {pkg.property.listPrice != null && (
          <div className="text-xs mt-1" style={{ color: MUTED }}>
            List price {money(pkg.property.listPrice)}
          </div>
        )}
      </div>

      {/* the terms grid */}
      <div
        className="rounded-2xl p-6 grid grid-cols-2 gap-x-6 gap-y-5"
        style={{ background: 'rgba(255,255,255,0.86)', border: '1px solid rgba(19,73,212,0.10)' }}
      >
        <Term label="Financing" value={t.loanType} />
        <Term label="Down payment" value={money(t.downPayment)} />
        <Term label="Loan amount" value={money(t.loanAmount)} />
        <Term label="Deposit" value={money(t.initialDeposit)} />
        <Term label="Close of escrow" value={coe} />
        <Term label="Compensation" value={pkg.compensation.display} />
        <Term label="Inspection" value={cont(t.inspectionContingencyDays)} />
        <Term label="Appraisal" value={cont(t.appraisalContingencyDays)} />
        <Term label="Loan contingency" value={cont(t.loanContingencyDays)} />
        {t.expiresAt && (
          <Term label="Offer expires" value={new Date(t.expiresAt).toLocaleString()} />
        )}
      </div>

      <p className="text-xs text-center" style={{ color: '#6b7689' }}>
        Next: the net-to-seller breakdown — what you actually take home, with
        every cost already counted. And accept · counter · decline.
      </p>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.15em] font-bold mb-0.5" style={{ color: '#6b7689' }}>{label}</div>
      <div className="font-bold" style={{ color: INK }}>{value}</div>
    </div>
  );
}
