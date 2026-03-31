'use client';

import { Activity, DailyTarget, LeadStatus, STATUS_BG_COLORS } from '@/types';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  activities: Activity[];
  targets: DailyTarget;
  leadsByStatus?: Record<string, number>;
}

const ACTIVITY_CONFIG: { type: string; label: string; icon: string; color: string }[] = [
  { type: 'call', label: 'Calls', icon: 'call', color: 'text-blue-600' },
  { type: 'note', label: 'Notes', icon: 'edit_note', color: 'text-slate-600' },
  { type: 'email', label: 'Emails', icon: 'email', color: 'text-violet-600' },
  { type: 'letter', label: 'Letters', icon: 'mail', color: 'text-emerald-600' },
];

const STATUS_ORDER: LeadStatus[] = [
  'Hot Lead',
  'Interested',
  'Follow-Up',
  'Called',
  'New',
  'Not Contacted',
  'Not Interested',
  'Do Not Call',
];

function getMotivationalText(targets: DailyTarget): string {
  const totalActual =
    targets.conversations_actual +
    targets.followups_actual +
    targets.letters_actual +
    targets.new_contacts_actual;
  const totalTarget =
    targets.conversations_target +
    targets.followups_target +
    targets.letters_target +
    targets.new_contacts_target;

  if (totalTarget === 0) return 'Set your daily targets to start tracking progress.';
  const pct = totalActual / totalTarget;
  if (pct >= 1) return 'All targets met! Outstanding work today.';
  if (pct >= 0.75) return 'Almost there! Just a few more to hit your goals.';
  if (pct >= 0.5) return 'Halfway done. Keep the momentum going.';
  if (pct >= 0.25) return 'Good start. Stay consistent and you will crush it.';
  return 'Time to get after it. Every call counts.';
}

export default function Scorecard({ activities, targets, leadsByStatus }: Props) {
  const countByType = (type: string) =>
    activities.filter((a) => a.type === type).length;

  const callOutcomes = activities
    .filter((a) => a.type === 'call' && a.outcome)
    .reduce<Record<string, number>>((acc, a) => {
      const key = a.outcome as string;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const maxLeadCount = leadsByStatus
    ? Math.max(...Object.values(leadsByStatus), 1)
    : 1;

  return (
    <div className="space-y-4">
      {/* Activity Breakdown */}
      <div className="rounded-2xl bg-surface-container-lowest p-5">
        <h3 className="font-headline text-base font-bold text-on-surface mb-4">
          Today&apos;s Activity
        </h3>

        <div className="space-y-3">
          {ACTIVITY_CONFIG.map((cfg) => {
            const count = countByType(cfg.type);
            return (
              <div key={cfg.type} className="flex items-center gap-3">
                <MaterialIcon
                  icon={cfg.icon}
                  className={cn('text-[20px]', cfg.color)}
                />
                <span className="flex-1 text-sm text-on-surface">{cfg.label}</span>
                <span className="font-headline text-lg font-bold text-on-surface">
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        {/* Call outcome breakdown */}
        {Object.keys(callOutcomes).length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
              Call Outcomes
            </p>
            <div className="space-y-1">
              {Object.entries(callOutcomes).map(([outcome, count]) => (
                <div key={outcome} className="flex items-center justify-between text-xs">
                  <span className="text-secondary">{outcome}</span>
                  <span className="font-semibold text-on-surface">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pipeline Summary */}
      {leadsByStatus && Object.keys(leadsByStatus).length > 0 && (
        <div className="rounded-2xl bg-surface-container-lowest p-5">
          <h3 className="font-headline text-base font-bold text-on-surface mb-4">
            Pipeline
          </h3>
          <div className="space-y-2">
            {STATUS_ORDER.filter((s) => (leadsByStatus[s] ?? 0) > 0).map((status) => {
              const count = leadsByStatus[status] ?? 0;
              const pct = (count / maxLeadCount) * 100;
              return (
                <div key={status} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        STATUS_BG_COLORS[status]
                      )}
                    >
                      {status}
                    </span>
                    <span className="text-xs font-bold text-on-surface">{count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-slate-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Motivational text */}
      <div className="rounded-2xl bg-surface-container-lowest p-5">
        <div className="flex items-start gap-3">
          <MaterialIcon
            icon="emoji_objects"
            className="text-[24px] text-amber-500"
            filled
          />
          <p className="text-sm font-medium text-secondary italic">
            {getMotivationalText(targets)}
          </p>
        </div>
      </div>
    </div>
  );
}
