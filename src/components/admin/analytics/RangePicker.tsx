'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

const RANGES = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  lastUpdated?: Date | null;
}

export default function RangePicker({ value, onChange, autoRefresh, onToggleAutoRefresh, lastUpdated }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex rounded-full border border-outline-variant bg-surface-container-low p-1">
        {RANGES.map(r => (
          <button
            key={r.value}
            type="button"
            onClick={() => onChange(r.value)}
            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
              value === r.value
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleAutoRefresh}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
          autoRefresh
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
            : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface'
        }`}
        aria-pressed={autoRefresh}
      >
        <MaterialIcon icon={autoRefresh ? 'sync' : 'sync_disabled'} className="text-sm" />
        Auto-refresh {autoRefresh ? 'on' : 'off'}
      </button>
      {lastUpdated && (
        <span className="text-[11px] text-on-surface-variant">
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
    </div>
  );
}
