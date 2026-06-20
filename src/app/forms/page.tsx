'use client';

// ── Form Builder — the library ────────────────────────────────────────
//
// Plot's transaction forms, each a TurboTax-style guided flow that
// educates both parties and protects the agent. Starting with the Offer
// (our RPA), then the disclosures. Plot's OWN instruments, authored from
// scratch — not CAR's forms.
//
// Palette: the new LIGHT app theme (project_front_page_locked) — blue
// accent, white surface, consistent with the front page + dashboard.

import Link from 'next/link';
import MaterialIcon from '@/components/ui/MaterialIcon';
import AppHeader from '@/components/layout/AppHeader';
import { PLOT_FORMS, type FormStatus } from '@/lib/forms/formCatalog';

const STATUS_LABEL: Record<FormStatus, string> = {
  live: 'Ready',
  building: 'In build',
  planned: 'Coming',
};

export default function FormBuilderPage() {
  return (
    <div className="fp app-surface min-h-screen">
      <AppHeader variant="app" />

      <div className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="max-w-2xl pt-6 md:pt-12">
          <div className="text-[11px] uppercase tracking-[0.3em] font-bold" style={{ color: 'var(--plot-brand)' }}>
            Form Builder
          </div>
          <h1 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tight mt-2" style={{ color: 'var(--plot-ink)' }}>
            The whole deal, in plain English.
          </h1>
          <p className="text-sm md:text-base mt-3 leading-relaxed" style={{ color: '#4a5568' }}>
            Every contract and disclosure a transaction needs — rebuilt as a
            guided flow that actually teaches you what you&apos;re agreeing to.
            Each line is a card; we show you which ones to play. Built to
            protect the agent, understood by everyone, signed in one place.
          </p>
        </div>

        {/* Form grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLOT_FORMS.map((f) => {
            const interactive = f.status !== 'planned';
            const statusTint =
              f.status === 'building'
                ? '#1349d4'
                : f.status === 'live'
                ? '#1b9e6a'
                : '#6b7689';
            const Card = (
              <div
                className={`group relative flex flex-col rounded-2xl p-5 overflow-hidden h-full transition-all duration-300 ${
                  interactive ? 'cursor-pointer hover:-translate-y-0.5' : 'opacity-70'
                }`}
                style={{
                  background: 'rgba(255,255,255,0.72)',
                  border: '1px solid rgba(19,73,212,0.10)',
                  boxShadow: '0 12px 30px -22px rgba(20,50,120,0.4)',
                }}
              >
                {/* accent glow on hover */}
                {interactive && (
                  <div
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(80% 60% at 50% 0%, ${f.accent}1a, transparent 70%)`,
                    }}
                  />
                )}

                {/* status pill */}
                <span
                  className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                  style={{
                    background: `${statusTint}14`,
                    border: `1px solid ${statusTint}3a`,
                    color: statusTint,
                  }}
                >
                  {STATUS_LABEL[f.status]}
                </span>

                <div className="relative flex flex-col h-full">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                    style={{
                      background: `linear-gradient(160deg, ${f.accent}22, ${f.accent}0d)`,
                      border: `1px solid ${f.accent}33`,
                      boxShadow: `0 6px 16px -8px ${f.accent}55`,
                    }}
                  >
                    <span style={{ color: f.accent }}>
                      <MaterialIcon icon={f.icon} className="text-[24px]" />
                    </span>
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#8a93a4' }}>
                    {f.code}
                  </div>
                  <h3 className="font-headline text-lg font-bold mt-0.5" style={{ color: '#0c1322' }}>
                    {f.name}
                  </h3>
                  <p className="text-xs mt-1.5 leading-snug" style={{ color: '#4a5568' }}>
                    {f.blurb}
                  </p>
                  <p className="text-[11px] mt-2 leading-snug flex-1" style={{ color: '#6b7689' }}>
                    {f.purpose}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    {f.steps && (
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: '#9aa3b2' }}>
                        {f.steps} step{f.steps === 1 ? '' : 's'}
                      </span>
                    )}
                    {interactive && (
                      <span
                        className="text-xs font-bold inline-flex items-center gap-1"
                        style={{ color: '#1349d4' }}
                      >
                        {f.status === 'building' ? 'Start building' : 'Open'}
                        <MaterialIcon icon="arrow_forward" className="text-[14px]" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );

            return interactive ? (
              <Link key={f.slug} href={`/forms/${f.slug}`} className="block h-full">
                {Card}
              </Link>
            ) : (
              <div key={f.slug} className="h-full">
                {Card}
              </div>
            );
          })}
        </div>

        {/* Footing note — the mission, quietly */}
        <p className="text-[11px] max-w-2xl leading-relaxed" style={{ color: '#9aa3b2' }}>
          Plot&apos;s own instruments, authored by a California broker. Same
          protections, clearer language, on your terms — not borrowed from
          anyone&apos;s playbook.
        </p>
      </div>
    </div>
  );
}
