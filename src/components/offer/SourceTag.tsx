'use client';

// ── SourceTag — the honesty layer, made visible ──────────────────────
//
// Every dollar on the breakdown wears one of these. This is THE thing that
// makes Plot's offer cockpit different from every "calculator": the buyer
// always knows whether a number is real (a licensed provider wrote it),
// theirs (they entered what they were quoted), or a stand-in waiting on
// their application. No hidden guesses on a surface you buy a house from.

import MaterialIcon from '@/components/ui/MaterialIcon';
import type { Provenance } from '@/lib/offer/types';

const META: Record<
  Provenance,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  'live-provider': {
    label: 'Live quote',
    icon: 'verified',
    color: '#5ed6a8',
    bg: 'rgba(94,214,168,0.14)',
    border: 'rgba(94,214,168,0.4)',
  },
  'buyer-entered': {
    label: 'Your number',
    icon: 'edit',
    color: '#4ab6ff',
    bg: 'rgba(74,182,255,0.12)',
    border: 'rgba(74,182,255,0.38)',
  },
  'pending-application': {
    label: 'Estimate',
    icon: 'pending',
    color: '#fbc64f',
    bg: 'rgba(251,198,79,0.12)',
    border: 'rgba(251,198,79,0.38)',
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
