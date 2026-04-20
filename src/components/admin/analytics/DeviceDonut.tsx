'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';
import InfoTooltip from './InfoTooltip';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#64748b'];

function deviceIcon(device: string): string {
  const d = device.toLowerCase();
  if (d.includes('mobile')) return 'smartphone';
  if (d.includes('tablet')) return 'tablet';
  if (d.includes('desktop')) return 'computer';
  return 'devices_other';
}

interface Props {
  devices: { device: string; count: number }[];
  rangeLabel: string;
}

export default function DeviceDonut({ devices, rangeLabel }: Props) {
  const total = devices.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
      <h2 className="text-base font-semibold text-on-surface mb-4 flex items-center gap-2">
        <MaterialIcon icon="devices" className="text-primary text-lg" />
        Devices
        <span className="text-xs text-on-surface-variant font-normal">({rangeLabel})</span>
        <InfoTooltip text="What kind of device visitors use. Helps prioritize mobile vs desktop UX work." />
      </h2>
      {devices.length === 0 || total === 0 ? (
        <p className="text-sm text-on-surface-variant">No data yet</p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-40 w-40 shrink-0 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={devices}
                  dataKey="count"
                  nameKey="device"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {devices.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgb(var(--color-surface-container-highest) / 1)',
                    border: '1px solid rgb(var(--color-outline-variant) / 1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  itemStyle={{ color: 'rgb(var(--color-on-surface) / 1)' }}
                  labelStyle={{ color: 'rgb(var(--color-on-surface-variant) / 1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold text-on-surface">{total.toLocaleString()}</span>
              <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">sessions</span>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            {devices.map((d, i) => {
              const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
              return (
                <div key={d.device} className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <MaterialIcon icon={deviceIcon(d.device)} className="text-[14px] text-on-surface-variant" />
                  <span className="text-on-surface capitalize flex-1">{d.device}</span>
                  <span className="text-on-surface-variant font-mono text-xs">
                    {d.count} <span className="opacity-60">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
