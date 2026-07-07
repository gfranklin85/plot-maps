'use client';

// ── /documents/[slug] — a single document's guided walkthrough ────────
//
// The client opens a document from the /documents hub and lands here: a clean,
// plain-language, TurboTax-style walkthrough (NOT a dense PDF). The offer (rpa)
// has the negotiation + money lenses; other docs show their framing until their
// walkthrough is built one by one. memory: the_thesis (documents teach; signing
// = residue of understanding), the_facts (document platform).

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { findForm, CLIENT_DOCS } from '@/lib/forms/formCatalog';
import AskFlow from '@/components/forms/AskFlow';
import { OFFER_ASK } from '@/lib/forms/specs/offerAsk';
import CostCockpit from '@/components/offer/CostCockpit';

export default function DocumentFlowPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const form = findForm(slug);
  const clientDoc = CLIENT_DOCS.find((d) => d.slug === slug);
  const search = useSearchParams();
  const [lens, setLens] = useState<'negotiation' | 'money'>(
    search.get('lens') === 'money' ? 'money' : 'negotiation',
  );

  const isRpa = slug === 'rpa';
  const wide = isRpa && lens === 'money';
  // Display metadata falls back to the client-doc catalog for docs not yet in
  // PLOT_FORMS (so every hub row lands on a real page, never a 404).
  const name = form?.name ?? clientDoc?.name ?? 'Document';
  const purpose = form?.purpose ?? clientDoc?.blurb ?? '';
  const icon = form?.icon ?? clientDoc?.icon ?? 'description';
  const accent = form?.accent ?? '#1349d4';

  return (
    <div className="fp app-surface min-h-screen">
      <div
        className={`relative z-10 p-4 md:p-8 mx-auto transition-[max-width] duration-300 ${
          wide ? 'max-w-6xl' : 'max-w-3xl'
        }`}
      >
        {/* back to the hub */}
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-xs transition-colors mb-6"
          style={{ color: '#6b7689' }}
        >
          <MaterialIcon icon="arrow_back" className="text-[16px]" />
          Your documents
        </Link>

        {isRpa ? (
          <>
            {/* lens switcher — negotiation vs. the money */}
            <div
              className="inline-flex p-1 rounded-full mb-6"
              style={{ background: '#ffffff', border: '1px solid rgba(19,73,212,0.16)', boxShadow: '0 8px 20px -16px rgba(20,50,120,0.5)' }}
            >
              <LensTab active={lens === 'negotiation'} onClick={() => setLens('negotiation')} icon="gavel" label="Negotiation" />
              <LensTab active={lens === 'money'} onClick={() => setLens('money')} icon="payments" label="The money" />
            </div>

            {lens === 'negotiation' ? <AskFlow flow={OFFER_ASK} /> : <CostCockpit />}
          </>
        ) : (
          <div className="text-center pt-16">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
              style={{ background: `linear-gradient(160deg, ${accent}33, ${accent}14)`, border: `1px solid ${accent}44` }}
            >
              <span style={{ color: accent }}>
                <MaterialIcon icon={icon} className="text-[32px]" />
              </span>
            </div>
            <h1 className="font-headline text-2xl font-extrabold" style={{ color: '#0c1322' }}>{name}</h1>
            <p className="mt-2 max-w-md mx-auto" style={{ color: '#4a5568' }}>{purpose}</p>
            <p className="text-xs mt-6 uppercase tracking-[0.2em] font-bold" style={{ color: '#1349d4' }}>
              This walkthrough is coming next
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LensTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
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
