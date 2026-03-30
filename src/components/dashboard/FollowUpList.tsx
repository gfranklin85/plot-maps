'use client';

import { Task, LeadStatus, STATUS_BG_COLORS } from '@/types';
import { cn, timeAgo } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  tasks: Task[];
}

export default function FollowUpList({ tasks }: Props) {
  const urgentCount = tasks.filter(
    (t) => t.priority === 'high' || t.priority === 'urgent'
  ).length;

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline text-lg font-bold text-on-surface">
          Follow-Ups Due Today
        </h3>
        {urgentCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-700">
            <MaterialIcon icon="priority_high" className="text-[14px]" />
            {urgentCount} Urgent
          </span>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-secondary">
          <MaterialIcon icon="task_alt" className="text-[48px] text-slate-300 mb-2" />
          <p className="text-sm">No follow-ups due today</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.slice(0, 5).map((task) => {
            const isHigh = task.priority === 'high' || task.priority === 'urgent';
            const leadStatus = task.lead?.status as LeadStatus | undefined;
            return (
              <li
                key={task.id}
                className="group flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-surface-container-low"
              >
                {/* Priority icon */}
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    isHigh
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-primary-fixed text-primary'
                  )}
                >
                  <MaterialIcon
                    icon={isHigh ? 'local_fire_department' : 'call'}
                    className="text-[20px]"
                    filled
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-on-surface">
                    {task.lead?.name ?? task.title}
                  </p>
                  <p className="truncate text-xs text-secondary">
                    {task.lead?.property_address ?? task.description ?? 'No address'}
                  </p>
                </div>

                {/* Status badge */}
                {leadStatus && (
                  <span
                    className={cn(
                      'hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline-flex',
                      STATUS_BG_COLORS[leadStatus]
                    )}
                  >
                    {leadStatus}
                  </span>
                )}

                {/* Time */}
                <span className="shrink-0 text-xs text-secondary whitespace-nowrap">
                  {task.due_at ? timeAgo(task.due_at) : ''}
                </span>

                {/* Call button */}
                <button
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm transition-shadow hover:shadow-md"
                >
                  <MaterialIcon icon="call" className="text-[16px]" />
                  Call
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
