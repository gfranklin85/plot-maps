'use client';

import { useState } from 'react';
import { ActionItem, Lead, LeadStatus, STATUS_BG_COLORS } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';
import Link from 'next/link';

interface Props {
  actions: ActionItem[];
  loading: boolean;
  fallbackLeads?: Lead[];
}

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  high: { label: 'High Priority', color: 'bg-red-500/10 text-red-400' },
  medium: { label: 'Action Item', color: 'bg-indigo-500/10 text-indigo-400' },
  low: { label: 'Low Priority', color: 'bg-emerald-500/10 text-emerald-400' },
};

function SkeletonCard() {
  return (
    <div className="animate-pulse bg-surface-container rounded-xl p-6 space-y-3">
      <div className="h-3 w-24 rounded bg-surface-container-high" />
      <div className="h-5 w-48 rounded bg-surface-container-high" />
      <div className="h-3 w-64 rounded bg-surface-container-high" />
      <div className="h-12 w-full rounded-lg bg-surface-container-high" />
    </div>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  const [openerOpen, setOpenerOpen] = useState(false);
  const priority = PRIORITY_LABELS[item.priority] ?? PRIORITY_LABELS.medium;

  return (
    <div className="bg-card border border-card-border rounded-xl p-6 hover:border-card-border-hover hover:shadow-lg transition-all">
      {/* Priority badge */}
      <div className="flex justify-between items-start mb-3">
        <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-widest ${priority.color}`}>
          {priority.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-on-surface mb-2">{item.action}</h3>

      {/* Lead info */}
      <p className="text-secondary text-sm mb-4 leading-relaxed">
        {item.leadName}{item.address ? ` — ${item.address}` : ''}
      </p>

      {/* Why? block */}
      {item.reason && (
        <div className="bg-surface rounded-lg p-3 mb-5 border-l-2 border-primary">
          <span className="block text-[10px] font-black uppercase text-primary mb-1">Why?</span>
          <p className="text-xs text-on-surface/80 italic">{item.reason}</p>
        </div>
      )}

      {/* Suggested opener */}
      {item.suggestedOpener && (
        <div className="mb-5">
          <button
            onClick={() => setOpenerOpen(!openerOpen)}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <MaterialIcon icon={openerOpen ? 'expand_less' : 'expand_more'} className="text-[16px]" />
            Talking points
          </button>
          {openerOpen && (
            <div className="mt-2 bg-surface-container-low rounded-lg p-3 border border-card-border">
              <p className="text-xs text-on-surface/70 italic leading-relaxed">{item.suggestedOpener}</p>
            </div>
          )}
        </div>
      )}

      {/* CTAs */}
      <div className="flex gap-3">
        {item.phone && (
          <a
            href={`tel:${item.phone}`}
            className="flex-1 bg-primary hover:bg-primary/90 text-on-primary py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <MaterialIcon icon="call" className="text-[16px]" />
            Call
          </a>
        )}
        <Link
          href={`/leads/${item.leadId}`}
          className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface py-2.5 rounded-lg font-bold text-sm text-center transition-all"
        >
          View Contact
        </Link>
      </div>
    </div>
  );
}

function FallbackLeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="flex items-center gap-4 bg-card border border-card-border rounded-xl px-5 py-4 hover:border-card-border-hover transition-all">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          lead.priority === 'high'
            ? 'bg-red-500/10 text-red-400'
            : 'bg-primary/10 text-primary'
        )}
      >
        <MaterialIcon
          icon={lead.status === 'Hot Lead' ? 'local_fire_department' : 'call'}
          className="text-[20px]"
          filled
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-on-surface">
          {lead.name || lead.owner_name || 'Unknown'}
        </p>
        <p className="truncate text-xs text-secondary">
          {lead.property_address ?? 'No address'}
        </p>
      </div>

      <span
        className={cn(
          'hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex',
          STATUS_BG_COLORS[lead.status as LeadStatus]
        )}
      >
        {lead.status}
      </span>

      {lead.follow_up_date && (
        <span className="shrink-0 text-xs text-secondary whitespace-nowrap">
          {formatDate(lead.follow_up_date)}
        </span>
      )}

      {lead.phone && (
        <a
          href={`tel:${lead.phone}`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition-shadow hover:shadow-md"
        >
          <MaterialIcon icon="call" className="text-[16px]" />
          Call
        </a>
      )}

      <Link
        href={`/leads/${lead.id}`}
        className="text-xs font-semibold text-primary hover:underline"
      >
        Open
      </Link>
    </div>
  );
}

export default function ActionList({ actions, loading, fallbackLeads }: Props) {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (actions.length > 0) {
    return (
      <div className="space-y-4">
        {actions.map((item, i) => (
          <ActionCard key={`${item.leadId}-${i}`} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
        Leads Needing Attention
      </h3>
      {fallbackLeads && fallbackLeads.length > 0 ? (
        <div className="space-y-3">
          {fallbackLeads.map((lead) => (
            <FallbackLeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-on-surface-variant">
          <MaterialIcon icon="task_alt" className="text-[48px] text-on-surface-variant/50 mb-2" />
          <p className="text-sm">All caught up! No pending actions.</p>
        </div>
      )}
    </div>
  );
}
