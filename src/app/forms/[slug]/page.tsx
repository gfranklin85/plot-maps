'use client';

// ── Form flow — the TurboTax-style guided instrument ──────────────────
//
// Renders a single Plot form as a step-by-step flow. v1 scaffold: shows
// the form's framing + the objective-first opener; the per-page question
// flow (built from docs/rpa-teardown.md) gets wired in next, page by page.

import { use, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import MaterialIcon from '@/components/ui/MaterialIcon';
import AppHeader from '@/components/layout/AppHeader';
import { findForm } from '@/lib/forms/formCatalog';
import RpaFlow from '@/components/forms/RpaFlow';
import CostCockpit from '@/components/offer/CostCockpit';

export default function FormFlowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const form = findForm(slug);
  // The offer has two lenses: the negotiation (what each term gives away)
  // and the money (every live dollar the buyer drives). Same instrument.
  const [lens, setLens] = useState<'negotiation' | 'money'>('negotiation');
  if (!form) return notFound();

  const isRpa = slug === 'rpa';
  const wide = isRpa && lens === 'money';

  return (
    <div className="fp app-surface min-h-screen">
      <AppHeader variant="app" />

      <div
        className={`relative z-10 p-4 md:p-8 mx-auto transition-[max-width] duration-300 ${
          wide ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        {/* back */}
        <Link
          href="/forms"
          className="inline-flex items-center gap-1.5 text-xs text-[rgba(180,200,255,0.6)] hover:text-white transition-colors mb-6"
        >
          <MaterialIcon icon="arrow_back" className="text-[16px]" />
          Form Builder
        </Link>

        {isRpa ? (
          <>
            {/* lens switcher — negotiation vs. the money */}
            <div
              className="inline-flex p-1 rounded-full mb-6"
              style={{ background: 'rgba(11,16,32,0.7)', border: '1px solid rgba(125,168,255,0.2)' }}
            >
              <LensTab
                active={lens === 'negotiation'}
                onClick={() => setLens('negotiation')}
                icon="gavel"
                label="Negotiation"
              />
              <LensTab
                active={lens === 'money'}
                onClick={() => setLens('money')}
                icon="payments"
                label="The money"
              />
            </div>

            {lens === 'negotiation' ? <RpaFlow /> : <CostCockpit />}
          </>
        ) : (
          <div className="text-center pt-16">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{
                background: `linear-gradient(160deg, ${form.accent}33, ${form.accent}14)`,
                border: `1px solid ${form.accent}44`,
              }}
            >
              <span style={{ color: form.accent }}>
                <MaterialIcon icon={form.icon} className="text-[32px]" />
              </span>
            </div>
            <h1 className="font-headline text-2xl font-extrabold text-white">
              {form.name}
            </h1>
            <p className="text-[rgba(200,215,255,0.65)] mt-2 max-w-md mx-auto">
              {form.purpose}
            </p>
            <p className="text-xs text-[rgba(0,242,255,0.7)] mt-6 uppercase tracking-[0.2em] font-bold">
              This flow is coming next
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LensTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all"
      style={{
        background: active ? 'linear-gradient(160deg, #00d8e6, #0095c9)' : 'transparent',
        color: active ? '#04121a' : 'rgba(180,200,255,0.7)',
        boxShadow: active ? '0 6px 18px -8px rgba(0,242,255,0.6)' : 'none',
      }}
    >
      <MaterialIcon icon={icon} className="text-[16px]" />
      {label}
    </button>
  );
}
