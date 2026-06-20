'use client';

// ── SourceTag — the honesty layer, made visible (light theme) ─────────
//
// Every dollar on the breakdown wears one of these. This is THE thing that
// makes Plot's offer cockpit different from every "calculator": the buyer
// always knows whether a number is real (a licensed provider wrote it),
// theirs (they entered what they were quoted), or a stand-in waiting on
// their application. Brand-blue light language (project_front_page_locked,
// project_plot_palette_locked).

import MaterialIcon from '@/components/ui/MaterialIcon';
import type { Provenance } from '@/lib/offer/types';

const META: Record<
  Provenance,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  'live-provider': {
    label: 'Live quote',
    icon: 'verified',
    color: '#1b9e6a',
    bg: 'rgba(27,158,106,0.10)',
    border: 'rgba(27,158,106,0.34)',
  },
  'buyer-entered': {
    label: 'Your number',
    icon: 'edit',
    color: '#1349d4',
    bg: 'rgba(19,73,212,0.08)',
    border: 'rgba(19,73,212,0.30)',
  },
  'pending-application': {
    label: 'Estimate',
    icon: 'pending',
    color: '#b8860b',
    bg: 'rgba(217,176,102,0.14)',
    border: 'rgba(184,134,11,0.34)',
  },
};

export default function SourceTag({ source, className = '' }: { source: Provenance; className?: string }) {
  const m = META[source];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${className}`}
      style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.color }}
    >
      <MaterialIcon icon={m.icon} className="text-[11px]" />
      {m.label}
    </span>
  );
}
