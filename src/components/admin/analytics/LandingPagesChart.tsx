'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';
import InfoTooltip from './InfoTooltip';

interface Row {
  page: string;
  count: number;
  bounces?: number;
  rate?: number;
}

interface Props {
  rows: Row[];
  rangeLabel: string;
  activePage?: string | null;
  onPageClick?: (page: string) => void;
}

function truncate(s: string, n = 32): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export default function LandingPagesChart({ rows, rangeLabel, activePage, onPageClick }: Props) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 1);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
      <h2 className="text-base font-semibold text-on-surface mb-1 flex items-center gap-2">
        <MaterialIcon icon="web" className="text-primary text-lg" />
        Top Landing Pages
        <span className="text-xs text-on-surface-variant font-normal">({rangeLabel})</span>
        <InfoTooltip text="First page of each session. Red overlay = bounces (single-page sessions). High bounce rate means visitors leave without exploring." />
      </h2>
      <p className="text-xs text-on-surface-variant mb-4">Click a bar to filter the prospects table.</p>

      {rows.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No data yet</p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const widthPct = Math.max(Math.round((row.count / max) * 100), 2);
            const bouncePct = row.count > 0 && row.bounces !== undefined
              ? Math.max(Math.round((row.bounces / max) * 100), 1)
              : 0;
            const rate = row.rate ?? 0;
            const rateColor = rate > 70 ? 'text-rose-400' : rate > 40 ? 'text-amber-400' : 'text-emerald-400';
            const isActive = activePage === row.page;
            const clickable = !!onPageClick;

            return (
              <button
                key={row.page}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onPageClick?.(row.page)}
                className={`w-full flex items-center gap-3 text-left group ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                title={row.page}
              >
                <span className={`w-40 text-xs truncate shrink-0 ${isActive ? 'text-primary font-semibold' : 'text-on-surface'}`}>
                  {truncate(row.page, 28)}
                </span>
                <div className={`flex-1 h-7 rounded-lg overflow-hidden relative border transition-all ${
                  isActive ? 'border-primary' : 'border-transparent'
                } ${clickable ? 'group-hover:border-primary/60' : ''} bg-surface-container`}>
                  <div
                    className="h-full bg-primary/50 rounded-lg"
                    style={{ width: `${widthPct}%` }}
                  />
                  {bouncePct > 0 && (
                    <div
                      className="absolute top-0 left-0 h-full bg-rose-500/50"
                      style={{ width: `${bouncePct}%` }}
                    />
                  )}
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-on-surface">
                    {row.count.toLocaleString()}
                  </span>
                </div>
                <span className={`text-xs font-semibold w-16 text-right shrink-0 ${rateColor}`} title="Bounce rate">
                  {rate}%
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-outline-variant text-[11px] text-on-surface-variant">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-primary/50" /> Visits
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-rose-500/50" /> Bounces
        </span>
        <span className="ml-auto">Right column = bounce rate</span>
      </div>
    </div>
  );
}
