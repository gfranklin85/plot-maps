'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';
import InfoTooltip from './InfoTooltip';

interface Row {
  source: string;
  visits: number;
  conversions: number;
  rate: number;
}

interface Props {
  rows: Row[];
  rangeLabel: string;
}

export default function UTMChart({ rows, rangeLabel }: Props) {
  const max = rows.reduce((m, r) => Math.max(m, r.visits), 1);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
      <h2 className="text-base font-semibold text-on-surface mb-1 flex items-center gap-2">
        <MaterialIcon icon="campaign" className="text-primary text-lg" />
        UTM Performance
        <span className="text-xs text-on-surface-variant font-normal">({rangeLabel})</span>
        <InfoTooltip text="Visits and conversions grouped by utm_source / utm_campaign. Tag your links like example.com/?utm_source=twitter to populate this." />
      </h2>

      {rows.length === 0 ? (
        <div className="mt-2 p-4 rounded-xl border border-dashed border-outline-variant bg-surface-container text-center">
          <MaterialIcon icon="link" className="text-2xl text-on-surface-variant mb-1" />
          <p className="text-sm text-on-surface font-medium">No UTM-tagged traffic yet</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Add <code className="px-1 py-0.5 rounded bg-surface-container-highest text-[11px]">?utm_source=twitter&amp;utm_campaign=launch</code> to your links to track where traffic comes from.
          </p>
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          {rows.map(r => {
            const widthPct = Math.max(Math.round((r.visits / max) * 100), 2);
            const rateColor = r.rate > 10 ? 'text-emerald-400' : r.rate > 0 ? 'text-amber-400' : 'text-on-surface-variant';
            return (
              <div key={r.source} className="flex items-center gap-3">
                <span className="w-36 text-xs text-on-surface truncate shrink-0" title={r.source}>{r.source}</span>
                <div className="flex-1 h-7 rounded-lg overflow-hidden relative bg-surface-container">
                  <div
                    className="h-full bg-primary/50 rounded-lg"
                    style={{ width: `${widthPct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-on-surface">
                    {r.visits.toLocaleString()} visits · {r.conversions} conv.
                  </span>
                </div>
                <span className={`text-xs font-semibold w-12 text-right shrink-0 ${rateColor}`}>{r.rate}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
