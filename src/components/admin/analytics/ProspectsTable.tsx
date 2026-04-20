'use client';

import { useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import InfoTooltip from './InfoTooltip';
import { timeAgo } from '../admin-utils';
import type { HotProspect } from '../admin-utils';

type SortKey = 'engagement_score' | 'total_pageviews' | 'total_sessions' | 'total_events' | 'last_seen';

interface FilterChip {
  label: string;
  onClear: () => void;
}

interface Props {
  prospects: HotProspect[];
  filterChips?: FilterChip[];
  onSelect: (p: HotProspect) => void;
}

function scoreBreakdown(p: HotProspect): string {
  const pv = Math.min(p.total_pageviews, 50);
  const ev = Math.min(p.total_events, 100);
  const ss = Math.min(p.total_sessions, 20);
  const recent = Date.now() - new Date(p.last_seen).getTime() < 24 * 60 * 60 * 1000;
  return `${pv} pageviews ×2 + ${ev} events ×1 + ${ss} sessions ×5${recent ? ' + 20 recency' : ''} = ${Math.round(p.engagement_score)}`;
}

export default function ProspectsTable({ prospects, filterChips = [], onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('engagement_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);

  const sorted = useMemo(() => {
    const filtered = prospects.filter(p => {
      if (search && !p.anonymous_id.toLowerCase().includes(search.toLowerCase())) return false;
      if (deviceFilter !== 'all' && (p.device_type || 'unknown') !== deviceFilter) return false;
      if (p.engagement_score < minScore) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const av = sortKey === 'last_seen' ? new Date(a.last_seen).getTime() : (a[sortKey] as number);
      const bv = sortKey === 'last_seen' ? new Date(b.last_seen).getTime() : (b[sortKey] as number);
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [prospects, sortKey, sortDir, search, deviceFilter, minScore]);

  const devices = useMemo(() => {
    const set = new Set<string>();
    prospects.forEach(p => set.add(p.device_type || 'unknown'));
    return ['all', ...Array.from(set)];
  }, [prospects]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return null;
    return (
      <MaterialIcon
        icon={sortDir === 'desc' ? 'arrow_downward' : 'arrow_upward'}
        className="text-[12px] text-primary ml-0.5"
      />
    );
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
          <MaterialIcon icon="local_fire_department" className="text-orange-400 text-lg" />
          Hot Prospects
          <InfoTooltip text="Unconverted anonymous visitors from the last 7 days, ranked by engagement score. Click a row for the full session timeline." />
        </h2>
        <span className="text-xs text-on-surface-variant">
          {sorted.length} of {prospects.length}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="relative">
            <MaterialIcon icon="search" className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search ID…"
              className="pl-7 pr-3 py-1.5 text-xs rounded-full border border-outline-variant bg-surface-container-low text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary w-36"
            />
          </div>
          <select
            value={deviceFilter}
            onChange={e => setDeviceFilter(e.target.value)}
            className="text-xs rounded-full border border-outline-variant bg-surface-container-low text-on-surface px-3 py-1.5 focus:outline-none focus:border-primary capitalize"
          >
            {devices.map(d => <option key={d} value={d}>{d === 'all' ? 'All devices' : d}</option>)}
          </select>
          <select
            value={minScore}
            onChange={e => setMinScore(Number(e.target.value))}
            className="text-xs rounded-full border border-outline-variant bg-surface-container-low text-on-surface px-3 py-1.5 focus:outline-none focus:border-primary"
          >
            <option value={0}>Any score</option>
            <option value={30}>Score 30+</option>
            <option value={50}>Score 50+</option>
            <option value={100}>Score 100+</option>
          </select>
        </div>
      </div>

      {filterChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {filterChips.map((chip, i) => (
            <button
              key={i}
              type="button"
              onClick={chip.onClear}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs border border-primary/30 hover:bg-primary/20"
            >
              {chip.label}
              <MaterialIcon icon="close" className="text-[12px]" />
            </button>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-8 text-center">
          No prospects match your filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-on-surface-variant text-xs border-b border-outline-variant">
                <th className="text-left py-2 font-medium">ID</th>
                <th className="text-left py-2 font-medium">Landing Page</th>
                <th className="text-right py-2 font-medium">
                  <button type="button" onClick={() => toggleSort('total_pageviews')} className="inline-flex items-center hover:text-on-surface">
                    Pages {sortIcon('total_pageviews')}
                  </button>
                </th>
                <th className="text-right py-2 font-medium">
                  <button type="button" onClick={() => toggleSort('total_sessions')} className="inline-flex items-center hover:text-on-surface">
                    Sessions {sortIcon('total_sessions')}
                  </button>
                </th>
                <th className="text-right py-2 font-medium">
                  <button type="button" onClick={() => toggleSort('total_events')} className="inline-flex items-center hover:text-on-surface">
                    Events {sortIcon('total_events')}
                  </button>
                </th>
                <th className="text-left py-2 font-medium">Source</th>
                <th className="text-left py-2 font-medium">Device</th>
                <th className="text-left py-2 font-medium">
                  <button type="button" onClick={() => toggleSort('last_seen')} className="inline-flex items-center hover:text-on-surface">
                    Last Seen {sortIcon('last_seen')}
                  </button>
                </th>
                <th className="text-right py-2 font-medium">
                  <button type="button" onClick={() => toggleSort('engagement_score')} className="inline-flex items-center hover:text-on-surface">
                    Score {sortIcon('engagement_score')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="border-b border-outline-variant/50 hover:bg-surface-container cursor-pointer"
                >
                  <td className="py-2 text-on-surface font-mono text-xs">{p.anonymous_id.slice(0, 8)}…</td>
                  <td className="py-2 text-on-surface-variant max-w-[180px] truncate">{p.landing_page || '—'}</td>
                  <td className="py-2 text-right text-on-surface">{p.total_pageviews}</td>
                  <td className="py-2 text-right text-on-surface">{p.total_sessions}</td>
                  <td className="py-2 text-right text-on-surface">{p.total_events}</td>
                  <td className="py-2 text-on-surface-variant">{p.utm_source || 'direct'}</td>
                  <td className="py-2 text-on-surface-variant capitalize">{p.device_type || '—'}</td>
                  <td className="py-2 text-on-surface-variant">{timeAgo(p.last_seen)}</td>
                  <td className="py-2 text-right">
                    <span
                      title={scoreBreakdown(p)}
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                        p.engagement_score >= 100 ? 'bg-orange-500/20 text-orange-400' :
                        p.engagement_score >= 50 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-sky-500/20 text-sky-400'
                      }`}
                    >
                      {Math.round(p.engagement_score)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
