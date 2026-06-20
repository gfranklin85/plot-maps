'use client';

// ── Form Builder — the library ────────────────────────────────────────
//
// Plot's transaction forms, each a TurboTax-style guided flow that
// educates both parties and protects the agent. Starting with the Offer
// (our RPA), then the disclosures. Plot's OWN instruments, authored from
// scratch — not CAR's forms.
//
// Palette: the locked dark desk set (project_plot_palette_locked).

import Link from 'next/link';
import MaterialIcon from '@/components/ui/MaterialIcon';
import DeskSurface from '@/components/dashboard/DeskSurface';
import { PLOT_FORMS, type FormStatus } from '@/lib/forms/formCatalog';

const STATUS_LABEL: Record<FormStatus, string> = {
  live: 'Ready',
  building: 'In build',
  planned: 'Coming',
};

export default function FormBuilderPage() {
  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] -mt-14 md:-mt-16 pt-14 md:pt-16">
      <DeskSurface />

      <div className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="max-w-2xl pt-10 md:pt-16">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[rgba(0,242,255,0.7)] font-bold">
            Form Builder
          </div>
          <h1 className="font-headline text-3xl md:text-5xl font-extrabold tracking-tight text-white mt-2 [text-shadow:0_2px_24px_rgba(0,242,255,0.18)]">
            The whole deal, in plain English.
          </h1>
          <p className="text-sm md:text-base text-[rgba(200,215,255,0.7)] mt-3 leading-relaxed">
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
            const Card = (
              <div
                className={`group relative flex flex-col rounded-2xl p-5 overflow-hidden h-full transition-all duration-300 ${
                  interactive ? 'cursor-pointer' : 'opacity-75'
                }`}
                style={{
                  background:
                    'linear-gradient(160deg, rgba(34,44,68,0.92), rgba(13,20,36,0.96))',
                  border: '1px solid rgba(125,168,255,0.16)',
                  boxShadow:
                    '0 18px 40px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,210,255,0.14)',
                }}
              >
                {/* accent glow on hover */}
                {interactive && (
                  <div
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: `radial-gradient(80% 60% at 50% 0%, ${f.accent}22, transparent 70%)`,
                    }}
                  />
                )}

                {/* status pill */}
                <span
                  className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border"
                  style={{
                    background:
                      f.status === 'building'
                        ? 'rgba(0,242,255,0.12)'
                        : f.status === 'live'
                        ? 'rgba(94,214,168,0.14)'
                        : 'rgba(125,168,255,0.08)',
                    borderColor:
                      f.status === 'building'
                        ? 'rgba(0,242,255,0.4)'
                        : f.status === 'live'
                        ? 'rgba(94,214,168,0.4)'
                        : 'rgba(125,168,255,0.2)',
                    color:
                      f.status === 'building'
                        ? '#00f2ff'
                        : f.status === 'live'
                        ? '#5ed6a8'
                        : 'rgba(180,200,255,0.7)',
                  }}
                >
                  {STATUS_LABEL[f.status]}
                </span>

                <div className="relative flex flex-col h-full">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                    style={{
                      background: `linear-gradient(160deg, ${f.accent}33, ${f.accent}14)`,
                      border: `1px solid ${f.accent}44`,
                      boxShadow: `0 6px 16px -6px ${f.accent}66, inset 0 1px 0 rgba(255,255,255,0.12)`,
                    }}
                  >
                    <span style={{ color: f.accent }}>
                      <MaterialIcon icon={f.icon} className="text-[24px]" />
                    </span>
                  </div>

                  <div className="text-[10px] uppercase tracking-[0.2em] text-[rgba(180,200,255,0.5)] font-bold">
                    {f.code}
                  </div>
                  <h3 className="font-headline text-lg font-bold text-white mt-0.5">
                    {f.name}
                  </h3>
                  <p className="text-xs text-[rgba(190,205,240,0.7)] mt-1.5 leading-snug">
                    {f.blurb}
                  </p>
                  <p className="text-[11px] text-[rgba(200,215,255,0.55)] mt-2 leading-snug flex-1">
                    {f.purpose}
                  </p>

                  <div className="mt-4 flex items-center justify-between">
                    {f.steps && (
                      <span className="text-[10px] text-[rgba(180,200,255,0.45)] uppercase tracking-wider">
                        {f.steps} step{f.steps === 1 ? '' : 's'}
                      </span>
                    )}
                    {interactive && (
                      <span
                        className="text-xs font-bold inline-flex items-center gap-1"
                        style={{ color: f.accent }}
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
        <p className="text-[11px] text-[rgba(180,200,255,0.4)] max-w-2xl leading-relaxed">
          Plot&apos;s own instruments, authored by a California broker. Same
          protections, clearer language, on your terms — not borrowed from
          anyone&apos;s playbook.
        </p>
      </div>
    </div>
  );
}
