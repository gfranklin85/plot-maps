'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';
import InfoTooltip from './InfoTooltip';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface Props {
  icon: string;
  iconColor: string;
  label: string;
  value: number | string;
  sublabel?: string;
  tooltip?: string;
  pulse?: boolean;
  delta?: { value: number; label?: string } | null;
  sparkline?: { date: string; count: number }[];
  sparklineColor?: string;
}

function fmt(v: number | string) {
  return typeof v === 'number' ? v.toLocaleString() : v;
}

export default function StatCard({
  icon, iconColor, label, value, sublabel, tooltip, pulse, delta, sparkline, sparklineColor,
}: Props) {
  const deltaSign = delta ? (delta.value > 0 ? '+' : delta.value < 0 ? '' : '') : '';
  const deltaColor = delta
    ? delta.value > 0 ? 'text-emerald-400'
      : delta.value < 0 ? 'text-rose-400'
      : 'text-on-surface-variant'
    : '';

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-5 relative">
      <div className="flex items-center gap-2 mb-2">
        <MaterialIcon icon={icon} className={`text-lg ${iconColor}`} />
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        )}
        <span className="text-xs text-on-surface-variant">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-on-surface leading-tight">{fmt(value)}</p>
          {sublabel && <p className="text-[11px] text-on-surface-variant mt-1">{sublabel}</p>}
          {delta && (
            <p className={`text-[11px] mt-1 font-semibold ${deltaColor}`}>
              {deltaSign}{Math.abs(delta.value)}%{delta.label ? ` ${delta.label}` : ''}
            </p>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <div className="h-10 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={sparklineColor || 'currentColor'}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
