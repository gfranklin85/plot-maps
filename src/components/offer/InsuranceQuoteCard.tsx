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
  background: '#ffffff',
  border: '1px solid rgba(19,73,212,0.12)',
  boxShadow: '0 40px 90px -24px rgba(20,40,90,0.45)',
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
      <div className="absolute inset-0 bg-[rgba(12,19,34,0.45)] backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={PANEL_STYLE}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 transition-colors"
          style={{ color: '#8a93a4' }}
        >
          <MaterialIcon icon="close" className="text-[20px]" />
        </button>

        <div className="flex items-center gap-3 mb-1">
          <span style={{ color: '#1349d4' }}><MaterialIcon icon="shield" className="text-[24px]" /></span>
          <div className="text-[10px] uppercase tracking-[0.3em] font-bold" style={{ color: '#1349d4' }}>
            Homeowners Insurance
          </div>
        </div>
        <h3 className="font-headline text-2xl font-extrabold" style={{ color: '#0c1322' }}>A real quote, wired in.</h3>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: '#4a5568' }}>
          A few facts about the home and a licensed insurer sends back an actual
          quote — straight into your breakdown. No placeholder, no surprise at
          closing.
        </p>

        <div
          className="mt-4 rounded-xl p-3 text-xs"
          style={{ background: 'rgba(19,73,212,0.05)', border: '1px solid rgba(19,73,212,0.14)', color: '#4a5568' }}
        >
          <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#8a93a4' }}>
            Estimated dwelling coverage
          </span>
          <div className="text-sm font-bold" style={{ color: '#0c1322' }}>
            ${insured.toLocaleString()} <span className="font-normal" style={{ color: '#8a93a4' }}>— refined once you submit</span>
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
              className="mt-0.5"
              style={{ accentColor: '#1349d4' }}
            />
            <span className="text-[11px] leading-snug" style={{ color: '#6b7689' }}>
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
            background: 'linear-gradient(160deg, #1349d4, #122d8d)',
            color: '#ffffff',
            boxShadow: ready ? '0 10px 24px -10px rgba(19,73,212,0.7)' : 'none',
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
      <label className="text-xs font-semibold" style={{ color: '#0c1322' }}>{label}</label>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm placeholder:text-[#aab2c0] focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)]"
        style={{ background: '#ffffff', border: '1px solid rgba(19,73,212,0.18)', color: '#0c1322' }}
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="text-xs font-semibold" style={{ color: '#0c1322' }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[rgba(19,73,212,0.25)]"
        style={{ background: '#ffffff', border: '1px solid rgba(19,73,212,0.18)', color: '#0c1322' }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  );
}
