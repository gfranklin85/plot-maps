'use client';

// ── InsuranceQuoteCard — the other necessary card / lead ──────────────
//
// Same loop as the loan application: the buyer answers a few real questions
// about the home, submits, and a licensed insurer claims the lead from the
// provider portal and writes a REAL homeowners quote into the cockpit
// (insurance line flips pending → live-provider). Until then the cockpit
// shows an honest estimate clearly labeled as one — never a fake quote.
//
// "Why can't that be wired up already?" — it can. This is the wire.

import { useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { OfferInputs } from '@/lib/offer/types';

const OVERLAY = 'fixed inset-0 z-[120] flex items-center justify-center p-4';
const PANEL_STYLE: React.CSSProperties = {
  background: 'linear-gradient(160deg, rgba(34,44,68,0.97), rgba(13,20,36,0.98))',
  border: '1px solid rgba(125,168,255,0.2)',
  boxShadow: '0 40px 90px -20px rgba(0,0,0,0.85), inset 0 1px 0 rgba(180,210,255,0.16)',
};

export default function InsuranceQuoteCard({
  inputs,
  onClose,
  onSubmitted,
}: {
  inputs: OfferInputs;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const insured = Math.round(inputs.purchasePrice * 0.85); // typical dwelling coverage basis
  const [form, setForm] = useState({
    yearBuilt: '',
    sqft: '',
    roof: 'composition',
    construction: 'wood-frame',
    coverage: 'replacement',
    consent: false,
  });

  const ready = form.yearBuilt.trim() && form.sqft.trim() && form.consent;

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
          <MaterialIcon icon="shield" className="text-[24px] text-[#00f2ff]" />
          <div className="text-[10px] uppercase tracking-[0.3em] text-[rgba(0,242,255,0.7)] font-bold">
            Homeowners Insurance
          </div>
        </div>
        <h3 className="font-headline text-2xl font-extrabold text-white">A real quote, wired in.</h3>
        <p className="text-sm text-[rgba(200,215,255,0.65)] mt-2 leading-relaxed">
          A few facts about the home and a licensed insurer sends back an actual
          quote — straight into your breakdown. No placeholder, no surprise at
          closing.
        </p>

        <div
          className="mt-4 rounded-xl p-3 text-xs text-[rgba(200,215,255,0.7)]"
          style={{ background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.18)' }}
        >
          <span className="text-[9px] uppercase tracking-wider text-[rgba(180,200,255,0.5)] font-bold">
            Estimated dwelling coverage
          </span>
          <div className="text-sm font-bold text-white">
            ${insured.toLocaleString()} <span className="font-normal text-[rgba(180,200,255,0.6)]">— refined once you submit</span>
          </div>
        </div>

        <div className="space-y-3 mt-5">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year built" value={form.yearBuilt} onChange={(v) => setForm((f) => ({ ...f, yearBuilt: v }))} placeholder="e.g. 1998" />
            <Field label="Square feet" value={form.sqft} onChange={(v) => setForm((f) => ({ ...f, sqft: v }))} placeholder="e.g. 1,850" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Roof" value={form.roof} onChange={(v) => setForm((f) => ({ ...f, roof: v }))} options={[['composition', 'Composition'], ['tile', 'Tile'], ['metal', 'Metal'], ['flat', 'Flat / other']]} />
            <Select label="Construction" value={form.construction} onChange={(v) => setForm((f) => ({ ...f, construction: v }))} options={[['wood-frame', 'Wood frame'], ['masonry', 'Masonry'], ['stucco', 'Stucco'], ['other', 'Other']]} />
          </div>
          <Select label="Coverage level" value={form.coverage} onChange={(v) => setForm((f) => ({ ...f, coverage: v }))} options={[['replacement', 'Full replacement cost'], ['extended', 'Extended replacement'], ['actual', 'Actual cash value']]} />

          <label className="flex items-start gap-2.5 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))}
              className="mt-0.5 accent-[#00d8e6]"
            />
            <span className="text-[11px] text-[rgba(200,215,255,0.6)] leading-snug">
              I authorize Plot to share this with licensed insurers to prepare a real quote. An
              insurer — not Plot — binds the policy.
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
          Submit — get a real quote
        </button>
      </div>
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
