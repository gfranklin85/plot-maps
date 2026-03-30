'use client';

import { cn, formatDate, timeAgo } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';

export interface ActivityEntry {
  id: string;
  type: 'call' | 'appointment' | 'note' | 'system';
  title: string;
  description: string | null;
  badge?: string;
  badgeColor?: string;
  timestamp: string;
}

interface Props {
  activities: ActivityEntry[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
}

const TYPE_CONFIG: Record<
  ActivityEntry['type'],
  { icon: string; bg: string; iconColor: string }
> = {
  call: {
    icon: 'phone',
    bg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  appointment: {
    icon: 'event',
    bg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  note: {
    icon: 'sticky_note_2',
    bg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  system: {
    icon: 'cloud_download',
    bg: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
};

export default function ActivityTimeline({
  activities,
  onLoadMore,
  hasMore,
  className,
}: Props) {
  if (activities.length === 0) {
    return (
      <div className={cn('flex flex-col items-center py-12 text-secondary', className)}>
        <MaterialIcon icon="timeline" className="text-[48px] text-slate-300" />
        <p className="mt-3 text-lg font-medium">No activity yet</p>
        <p className="text-sm">Call logs, notes, and appointments will appear here</p>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-outline-variant" />

      <div className="space-y-0">
        {activities.map((entry) => {
          const config = TYPE_CONFIG[entry.type];

          return (
            <div
              key={entry.id}
              className="group relative flex gap-4 py-4 pl-0 transition-colors"
            >
              {/* Icon */}
              <div
                className={cn(
                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-shadow group-hover:shadow-md',
                  config.bg
                )}
              >
                <MaterialIcon
                  icon={config.icon}
                  className={cn('text-[20px]', config.iconColor)}
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 rounded-xl bg-surface-container-lowest p-4 transition-shadow group-hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-on-surface">
                        {entry.title}
                      </p>
                      {entry.badge && (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            entry.badgeColor ?? 'bg-slate-100 text-slate-600'
                          )}
                        >
                          {entry.badge}
                        </span>
                      )}
                    </div>

                    {entry.description && (
                      <p
                        className={cn(
                          'mt-1 text-sm text-secondary leading-relaxed',
                          entry.type === 'note' && 'italic'
                        )}
                      >
                        {entry.type === 'note'
                          ? `"${entry.description}"`
                          : entry.description}
                      </p>
                    )}
                  </div>

                  <p className="shrink-0 text-xs text-secondary whitespace-nowrap">
                    {formatDate(entry.timestamp)}
                    <br />
                    <span className="text-slate-400">
                      {timeAgo(entry.timestamp)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load More */}
      {hasMore && onLoadMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={onLoadMore}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-container"
          >
            <MaterialIcon icon="expand_more" className="text-[18px]" />
            Load Previous Activity
          </button>
        </div>
      )}
    </div>
  );
}
