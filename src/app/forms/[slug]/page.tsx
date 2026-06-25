'use client';

// ── Form flow — the TurboTax-style guided instrument ──────────────────
//
// Renders a single Plot form as a step-by-step flow. v1 scaffold: shows
// the form's framing + the objective-first opener; the per-page question
// flow (built from docs/rpa-teardown.md) gets wired in next, page by page.

import { use, useState } from 'react';
import Link from 'next/link';
import { notFound, useSearchParams } from 'next/navigation';
import MaterialIcon from '@/components/ui/MaterialIcon';
import AppHeader from '@/components/layout/AppHeader';
import { findForm } from '@/lib/forms/formCatalog';
import FormFlow from '@/components/forms/FormFlow';
import { RPA_FLOW } from '@/lib/forms/specs/rpa';
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
  // ?lens=money deep-links straight to the cockpit (the launcher card uses it).
  const search = useSearchParams();
  const [lens, setLens] = useState<'negotiation' | 'money'>(
    search.get('lens') === 'money' ? 'money' : 'negotiation',
  );
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
          className="inline-flex items-center gap-1.5 text-xs transition-colors mb-6"
          style={{ color: '#6b7689' }}
        >
          <MaterialIcon icon="arrow_back" className="text-[16px]" />
          Form Builder
        </Link>

        {isRpa ? (
          <>
            {/* lens switcher — negotiation vs. the money */}
            <div
              className="inline-flex p-1 rounded-full mb-6"
              style={{ background: '#ffffff', border: '1px solid rgba(19,73,212,0.16)', boxShadow: '0 8px 20px -16px rgba(20,50,120,0.5)' }}
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

            {lens === 'negotiation' ? <FormFlow flow={RPA_FLOW} /> : <CostCockpit />}
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
            <h1 className="font-headline text-2xl font-extrabold" style={{ color: '#0c1322' }}>
              {form.name}
            </h1>
            <p className="mt-2 max-w-md mx-auto" style={{ color: '#4a5568' }}>
              {form.purpose}
            </p>
            <p className="text-xs mt-6 uppercase tracking-[0.2em] font-bold" style={{ color: '#1349d4' }}>
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
        background: active ? 'linear-gradient(160deg, #1349d4, #122d8d)' : 'transparent',
        color: active ? '#ffffff' : '#6b7689',
        boxShadow: active ? '0 8px 18px -10px rgba(19,73,212,0.7)' : 'none',
      }}
    >
      <MaterialIcon icon={icon} className="text-[16px]" />
      {label}
    </button>
  );
}
