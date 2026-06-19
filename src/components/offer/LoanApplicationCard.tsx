'use client';

// ── LoanApplicationCard — the necessary card that becomes the lead ────
//
// This is the unlock Greg named: the buyer fills a loan application INSIDE
// the offer flow. That's not friction — it's the product. Once submitted,
// the application is a lead. A licensed lender logs into Plot's provider
// portal, claims it, works the file, and writes the REAL rate + fees back
// into the buyer's cost cockpit (source flips pending → live-provider).
//
// v1 captures the application and flips the cockpit's loanState. The
// portal handoff + /api/offer/loan-application POST get wired with the
// prospecting backend (memory: project_active_workstream_prospecting_backend).

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { OfferInputs } from '@/lib/offer/types';

const OVERLAY = 'fixed inset-0 z-[120] flex items-center justify-center p-4';
const PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(34,44,68,0.97), rgba(13,20,36,0.98))',
  border: '1px solid rgba(125,168,255,0.2)',
  boxShadow: '0 40px 90px -20px rgba(0,0,0,0.85), inset 0 1px 0 rgba(180,210,255,0.16)',
};

export default function LoanApplicationCard({
  inputs,
  onClose,
  onSubmitted,
}: {
  inputs: OfferInputs;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState({
    fullName: '',
    income: '',
    employer: '',
    creditBand: 'good',
    downSource: 'savings',
    consent: false,
  });

  const ready = form.fullName.trim() && form.income.trim() && form.consent;

  return (
    <div className={OVERLAY}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={PANEL_STYLE}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[rgba(180,200,255,0.6)] hover:text-white transition-colors"
        >
          <MaterialIcon icon="close" className="text-[20px]" />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <MaterialIcon icon="account_balance" className="text-[24px] text-[#00f2ff]" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-[rgba(0,242,255,0.7)] font-bold">
            Loan Application
          </div>
        </div>
        <h3 className="font-headline text-2xl font-extrabold text-white">
          Get your real rate.
        </h3>
        <p className="text-sm text-[rgba(200,215,255,0.65)] mt-2 leading-relaxed">
          Fill this once. A licensed lender picks up your file and writes your
          actual rate, points, and fees straight into your breakdown. No more
          &quot;rates change daily&quot; — they&apos;ll quote you and stand behind it.
        </p>

        {/* what we already know — pre-filled from the cockpit */}
        <div
          className="mt-4 rounded-xl p-3 text-xs text-[rgba(200,215,255,0.7)] grid grid-cols-3 gap-2"
          style={{ background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.18)' }}
        >
          <Known label="Price" value={`$${inputs.purchasePrice.toLocaleString()}`} />
          <Known label="Down" value={`${inputs.downPaymentPct}%`} />
          <Known label="Type" value={inputs.loanType} />
        </div>

        <div className="space-y-3 mt-5">
          <Field label="Full legal name" value={form.fullName} onChange={(v) => setForm((f) => ({ ...f, fullName: v }))} placeholder="As it appears on your ID" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Annual income" value={form.income} onChange={(v) => setForm((f) => ({ ...f, income: v }))} placeholder="$" />
            <Field label="Employer" value={form.employer} onChange={(v) => setForm((f) => ({ ...f, employer: v }))} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Credit band" value={form.creditBand} onChange={(v) => setForm((f) => ({ ...f, creditBand: v }))} options={[['excellent', '740+'], ['good', '680–739'], ['fair', '620–679'], ['building', 'Under 620']]} />
            <Select label="Down payment from" value={form.downSource} onChange={(v) => setForm((f) => ({ ...f, downSource: v }))} options={[['savings', 'Savings'], ['gift', 'Gift'], ['sale', 'Sale of home'], ['other', 'Other']]} />
          </div>

          <label className="flex items-start gap-2.5 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
              className="mt-0.5 accent-[#00d8e6]"
            />
            <span className="text-[11px] text-[rgba(200,215,255,0.6)] leading-snug">
              I authorize Plot to share this application with licensed lenders so they can prepare a
              real quote. I understand a lender — not Plot — originates the loan.
            </span>
          </label>
        </div>

        <button
          disabled={!ready}
          onClick={onSubmitted}
          className="w-full mt-5 px-5 py-3 rounded-full text-sm font-bold transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(160deg, #00d8e6, #0095c9)',
            color: '#04121a',
            boxShadow: ready ? '0 8px 24px -8px rgba(0,242,255,0.6)' : 'none',
          }}
        >
          Submit — get matched with a lender
        </button>
      </div>
    </div>
  );
}

function Known({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-[rgba(180,200,255,0.5)] font-bold">{label}</div>
      <div className="text-xs font-bold text-white capitalize">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[rgba(220,230,255,0.8)]">{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm text-white placeholder:text-[rgba(180,200,255,0.35)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,242,255,0.3)]"
        style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(125,168,255,0.22)' }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
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
          <option key={v} value={v} style={{ background: '#0b1020' }}>{l}</option>
        ))}
      </select>
    </div>
  );
}
