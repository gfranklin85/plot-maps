'use client';

import { Activity, ActivityType } from '@/types';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  activities: Activity[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const TYPE_CONFIG: Record<
  ActivityType,
  { icon: string; bg: string; iconColor: string }
> = {
  call: {
    icon: 'phone',
    bg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  note: {
    icon: 'edit_note',
    bg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  email: {
    icon: 'mail',
    bg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  letter: {
    icon: 'description',
    bg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  status_change: {
    icon: 'swap_horiz',
    bg: 'bg-surface-container',
    iconColor: 'text-secondary',
  },
  import: {
    icon: 'upload_file',
    bg: 'bg-surface-container',
    iconColor: 'text-secondary',
  },
};

const OUTCOME_COLORS: Record<string, string> = {
  'Spoke with Owner': 'bg-emerald-100 text-emerald-700',
  'Follow-Up': 'bg-amber-100 text-amber-700',
  'Left VM': 'bg-blue-100 text-blue-700',
  'No Answer': 'bg-surface-container text-on-surface-variant',
  'Not Interested': 'bg-rose-100 text-rose-700',
  DNC: 'bg-red-100 text-red-700',
};

export default function ActivityTimeline({
  activities,
  onLoadMore,
  hasMore,
}: Props) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-secondary">
        <MaterialIcon icon="timeline" className="text-[48px] text-on-surface-variant" />
        <p className="mt-3 text-lg font-medium">No activity yet</p>
        <p className="text-sm">
          Calls, notes, emails, and status changes will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-outline-variant" />

      <div className="space-y-0">
        {activities.map((activity) => {
          const config = TYPE_CONFIG[activity.type];

          return (
            <div
              key={activity.id}
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
                        {activity.title}
                      </p>
                      {activity.type === 'call' && activity.outcome && (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            OUTCOME_COLORS[activity.outcome] ??
                              'bg-surface-container text-on-surface-variant'
                          )}
                        >
                          {activity.outcome}
                        </span>
                      )}
                    </div>

                    {activity.description && (
                      <p className="mt-1 text-sm italic text-secondary leading-relaxed">
                        {activity.description}
                      </p>
                    )}
                  </div>

                  <p className="shrink-0 text-xs text-secondary whitespace-nowrap">
                    {formatDate(activity.created_at)}
                    <br />
                    <span className="text-on-surface-variant">
                      {timeAgo(activity.created_at)}
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
