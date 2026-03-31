'use client';

import { useState } from 'react';
import { ActionItem, Lead, LeadStatus, STATUS_BG_COLORS } from '@/types';
import { cn, formatPhone, formatDate } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';
import Link from 'next/link';

interface Props {
  actions: ActionItem[];
  loading: boolean;
  fallbackLeads?: Lead[];
}

const PRIORITY_DOTS: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl bg-surface-container-lowest p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-slate-200" />
        <div className="h-4 w-40 rounded bg-slate-200" />
      </div>
      <div className="h-3 w-64 rounded bg-slate-200" />
      <div className="h-3 w-48 rounded bg-slate-200" />
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-lg bg-slate-200" />
        <div className="h-8 w-24 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  const [openerOpen, setOpenerOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* Priority dot */}
        <div
          className={cn(
            'mt-1.5 h-3 w-3 shrink-0 rounded-full',
            PRIORITY_DOTS[item.priority] ?? PRIORITY_DOTS.low
          )}
        />

        <div className="min-w-0 flex-1 space-y-2">
          {/* Lead name + address */}
          <div>
            <p className="font-semibold text-on-surface">{item.leadName}</p>
            {item.address && (
              <p className="text-xs text-secondary truncate">{item.address}</p>
            )}
          </div>

          {/* Action */}
          <p className="text-sm font-bold text-on-surface">{item.action}</p>

          {/* Reason */}
          <p className="text-xs italic text-secondary">{item.reason}</p>

          {/* Suggested opener (collapsible) */}
          {item.suggestedOpener && (
            <div>
              <button
                onClick={() => setOpenerOpen(!openerOpen)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <MaterialIcon
                  icon={openerOpen ? 'expand_less' : 'expand_more'}
                  className="text-[16px]"
                />
                Suggested opener
              </button>
              {openerOpen && (
                <p className="mt-1 rounded-lg bg-blue-50 px-3 py-2 text-xs italic text-slate-700">
                  {item.suggestedOpener}
                </p>
              )}
            </div>
          )}

          {/* Actions row */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.phone && (
              <a
                href={`tel:${item.phone}`}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm transition-shadow hover:shadow-md"
              >
                <MaterialIcon icon="call" className="text-[14px]" />
                {formatPhone(item.phone)}
              </a>
            )}
            <Link
              href={`/leads/${item.leadId}`}
              className="flex items-center gap-1 rounded-xl bg-surface-container-low px-3 py-1.5 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <MaterialIcon icon="open_in_new" className="text-[14px]" />
              Open Record
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FallbackLeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-surface-container-low">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          lead.priority === 'high'
            ? 'bg-rose-100 text-rose-600'
            : 'bg-primary-fixed text-primary'
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
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition-shadow hover:shadow-md"
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
        <h3 className="font-headline text-lg font-bold text-on-surface">
          Action List
        </h3>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // AI-generated action list
  if (actions.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MaterialIcon icon="auto_awesome" className="text-[20px] text-amber-500" filled />
          <h3 className="font-headline text-lg font-bold text-on-surface">
            AI-Prioritized Action List
          </h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {actions.length} actions
          </span>
        </div>
        {actions.map((item, i) => (
          <ActionCard key={`${item.leadId}-${i}`} item={item} />
        ))}
      </div>
    );
  }

  // Fallback: manual lead list
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6">
      <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
        Leads Needing Attention
      </h3>
      {fallbackLeads && fallbackLeads.length > 0 ? (
        <ul className="space-y-2">
          {fallbackLeads.map((lead) => (
            <FallbackLeadCard key={lead.id} lead={lead} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-secondary">
          <MaterialIcon icon="task_alt" className="text-[48px] text-slate-300 mb-2" />
          <p className="text-sm">All caught up! No pending actions.</p>
        </div>
      )}
    </div>
  );
}
