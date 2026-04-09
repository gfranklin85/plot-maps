'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

interface BarData {
  label: string;
  count: number;
  color: string;
  bgColor: string;
}

interface Props {
  newProspects?: number;
  calledPitching?: number;
  scheduledFollowUps?: number;
  dailyAverage?: number;
}

export default function OutreachChart({
  newProspects = 0,
  calledPitching = 0,
  scheduledFollowUps = 0,
  dailyAverage = 5,
}: Props) {
  const bars: BarData[] = [
    {
      label: 'New Prospects',
      count: newProspects,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-100',
    },
    {
      label: 'Called / Pitching',
      count: calledPitching,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-100',
    },
    {
      label: 'Scheduled Follow-Ups',
      count: scheduledFollowUps,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-100',
    },
  ];

  const maxCount = Math.max(...bars.map((b) => b.count), 1);
  const totalCalls = calledPitching;
  const ahead = totalCalls - dailyAverage;

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6">
      <h3 className="font-headline text-lg font-bold text-on-surface mb-5">
        Outreach Activity
      </h3>

      <div className="space-y-4">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-label font-semibold text-secondary uppercase tracking-wide">
                {bar.label}
              </span>
              <span className="text-sm font-bold text-on-surface">{bar.count}</span>
            </div>
            <div className={`h-3 w-full rounded-full ${bar.bgColor}`}>
              <div
                className={`h-3 rounded-full ${bar.color} transition-all duration-500`}
                style={{
                  width: `${maxCount > 0 ? Math.max((bar.count / maxCount) * 100, bar.count > 0 ? 8 : 0) : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Motivational footer */}
      <div className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3">
        <MaterialIcon
          icon={ahead >= 0 ? 'trending_up' : 'trending_down'}
          className={`text-[20px] ${ahead >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}
        />
        <p className="text-sm text-on-surface">
          {ahead >= 0 ? (
            <>
              You are <span className="font-bold text-emerald-600">{ahead} calls ahead</span> of your daily average
            </>
          ) : (
            <>
              You are <span className="font-bold text-amber-600">{Math.abs(ahead)} calls behind</span> your daily average
            </>
          )}
        </p>
      </div>
    </div>
  );
}
