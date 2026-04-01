'use client';

import { useState, useMemo } from 'react';
import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { MAP_CENTER } from '@/lib/constants';

interface Props {
  leads: Lead[];
  onClose: () => void;
}

interface RouteStop {
  lead: Lead;
  distanceToNext: string | null;
  durationToNext: string | null;
}

export default function RouteOptimizer({ leads, onClose }: Props) {
  const [selectedLeads, setSelectedLeads] = useState<Lead[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<RouteStop[] | null>(null);
  const [totalDistance, setTotalDistance] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const availableLeads = useMemo(() => {
    const selectedIds = new Set(selectedLeads.map((l) => l.id));
    return leads
      .filter(
        (l) =>
          l.latitude !== null &&
          l.longitude !== null &&
          !selectedIds.has(l.id)
      )
      .filter((l) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          l.name?.toLowerCase().includes(q) ||
          l.property_address?.toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  }, [leads, selectedLeads, search]);

  function addLead(lead: Lead) {
    setSelectedLeads((prev) => [...prev, lead]);
    setSearch('');
    setOptimizedRoute(null);
  }

  function removeLead(id: string) {
    setSelectedLeads((prev) => prev.filter((l) => l.id !== id));
    setOptimizedRoute(null);
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSelectedLeads((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setOptimizedRoute(null);
  }

  function moveDown(index: number) {
    if (index >= selectedLeads.length - 1) return;
    setSelectedLeads((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setOptimizedRoute(null);
  }

  async function optimizeRoute() {
    if (selectedLeads.length < 2) return;
    setLoading(true);
    setOptimizedRoute(null);

    try {
      // Build all points: home + selected leads
      const allPoints = [
        { lat: MAP_CENTER.lat, lng: MAP_CENTER.lng },
        ...selectedLeads.map((l) => ({
          lat: l.latitude!,
          lng: l.longitude!,
        })),
      ];

      // Get distance matrix for all pairs
      const res = await fetch('/api/distance-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origins: allPoints,
          destinations: allPoints,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch distances');

      const data = await res.json();
      const matrix = data.rows as {
        elements: {
          distance: string | null;
          distanceValue: number | null;
          duration: string | null;
          durationValue: number | null;
          status: string;
        }[];
      }[];

      // Greedy nearest-neighbor starting from home (index 0)
      const n = allPoints.length;
      const visited = new Set<number>([0]);
      const order: number[] = [0];
      let current = 0;

      while (visited.size < n) {
        let bestIdx = -1;
        let bestDist = Infinity;

        for (let i = 1; i < n; i++) {
          if (visited.has(i)) continue;
          const val = matrix[current]?.elements[i]?.durationValue ?? Infinity;
          if (val < bestDist) {
            bestDist = val;
            bestIdx = i;
          }
        }

        if (bestIdx === -1) break;
        visited.add(bestIdx);
        order.push(bestIdx);
        current = bestIdx;
      }

      // Build optimized route (skip index 0 which is home)
      const stops: RouteStop[] = [];
      let totalDistVal = 0;
      let totalDurVal = 0;

      for (let i = 1; i < order.length; i++) {
        const fromIdx = order[i - 1];
        const toIdx = order[i];
        const el = matrix[fromIdx]?.elements[toIdx];
        const leadIdx = toIdx - 1; // offset by 1 for home

        stops.push({
          lead: selectedLeads[leadIdx],
          distanceToNext: null,
          durationToNext: null,
        });

        if (el?.distanceValue) totalDistVal += el.distanceValue;
        if (el?.durationValue) totalDurVal += el.durationValue;
      }

      // Assign distance/duration from previous stop
      for (let i = 0; i < stops.length; i++) {
        const fromIdx = order[i];
        const toIdx = order[i + 1];
        const el = matrix[fromIdx]?.elements[toIdx];
        if (i < stops.length && el) {
          stops[i] = {
            ...stops[i],
            distanceToNext: el.distance,
            durationToNext: el.duration,
          };
        }
      }

      // Reorder selectedLeads to match optimized order
      const reordered = order.slice(1).map((idx) => selectedLeads[idx - 1]);
      setSelectedLeads(reordered);

      setOptimizedRoute(stops);
      setTotalDistance(
        totalDistVal > 0
          ? `${(totalDistVal / 1609.34).toFixed(1)} mi`
          : null
      );
      setTotalDuration(
        totalDurVal > 0 ? formatSeconds(totalDurVal) : null
      );
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  function formatSeconds(s: number): string {
    const hours = Math.floor(s / 3600);
    const mins = Math.round((s % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins} min`;
  }

  function openInGoogleMaps() {
    const leadsToUse = optimizedRoute
      ? optimizedRoute.map((s) => s.lead)
      : selectedLeads;
    const waypoints = leadsToUse
      .map((l) => `${l.latitude},${l.longitude}`)
      .join('/');
    const url = `https://www.google.com/maps/dir/${MAP_CENTER.lat},${MAP_CENTER.lng}/${waypoints}`;
    window.open(url, '_blank');
  }

  return (
    <div className="fixed right-4 top-20 z-50 w-80 rounded-2xl bg-white shadow-2xl flex flex-col max-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
            <MaterialIcon icon="route" className="text-[20px] text-violet-600" filled />
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">Route Planner</h3>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary hover:bg-slate-100 transition-colors"
        >
          <MaterialIcon icon="close" className="text-[20px]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        {/* Instructions */}
        <p className="text-xs text-secondary">
          Add leads below, then optimize the route to plan your field visits.
        </p>

        {/* Search / Add */}
        <div className="relative">
          <MaterialIcon
            icon="search"
            className="absolute left-2.5 top-2 text-[16px] text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads to add..."
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-8 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search.trim() && availableLeads.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {availableLeads.map((l) => (
                <button
                  key={l.id}
                  onClick={() => addLead(l)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                >
                  <MaterialIcon icon="add_circle" className="text-[16px] text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-on-surface">{l.name}</p>
                    <p className="truncate text-xs text-secondary">
                      {l.property_address}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected leads */}
        {selectedLeads.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-secondary">
            <MaterialIcon icon="pin_drop" className="text-[32px] text-slate-300" />
            <p className="mt-2 text-sm">No leads added yet</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {selectedLeads.map((lead, idx) => (
              <div
                key={lead.id}
                className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-on-primary">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {lead.name}
                  </p>
                  <p className="truncate text-xs text-secondary">
                    {lead.property_address}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                      idx === 0
                        ? 'text-slate-300'
                        : 'text-secondary hover:bg-slate-200'
                    )}
                  >
                    <MaterialIcon icon="keyboard_arrow_up" className="text-[16px]" />
                  </button>
                  <button
                    onClick={() => moveDown(idx)}
                    disabled={idx === selectedLeads.length - 1}
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                      idx === selectedLeads.length - 1
                        ? 'text-slate-300'
                        : 'text-secondary hover:bg-slate-200'
                    )}
                  >
                    <MaterialIcon icon="keyboard_arrow_down" className="text-[16px]" />
                  </button>
                  <button
                    onClick={() => removeLead(lead.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <MaterialIcon icon="close" className="text-[14px]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Optimize button */}
        {selectedLeads.length >= 2 && (
          <button
            onClick={optimizeRoute}
            disabled={loading}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
              loading
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-primary text-on-primary shadow-sm hover:shadow-md'
            )}
          >
            {loading ? (
              <>
                <MaterialIcon icon="progress_activity" className="text-[16px] animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <MaterialIcon icon="route" className="text-[16px]" />
                Optimize Route
              </>
            )}
          </button>
        )}

        {/* Optimized results */}
        {optimizedRoute && (
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs font-medium text-secondary">
              {totalDistance && totalDuration && (
                <span>
                  Total: {totalDistance} &bull; {totalDuration}
                </span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-secondary">
                <MaterialIcon icon="home" className="text-[14px]" />
                <span className="font-medium">Home</span>
              </div>
              {optimizedRoute.map((stop, idx) => (
                <div key={stop.lead.id}>
                  {stop.distanceToNext && (
                    <div className="ml-[22px] border-l-2 border-dashed border-slate-200 py-1 pl-4 text-[10px] text-slate-400">
                      {idx === 0
                        ? stop.distanceToNext + ' / ' + (stop.durationToNext || '')
                        : (optimizedRoute[idx - 1]?.distanceToNext || '') +
                          ' / ' +
                          (optimizedRoute[idx - 1]?.durationToNext || '')}
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {stop.lead.name}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Open in Google Maps */}
            <button
              onClick={openInGoogleMaps}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-primary hover:bg-slate-50 transition-colors"
            >
              <MaterialIcon icon="open_in_new" className="text-[16px]" />
              Open in Google Maps
            </button>
          </div>
        )}

        {/* Open in Maps even without optimizing */}
        {selectedLeads.length >= 1 && !optimizedRoute && (
          <button
            onClick={openInGoogleMaps}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-semibold text-primary hover:bg-slate-50 transition-colors"
          >
            <MaterialIcon icon="open_in_new" className="text-[16px]" />
            Open in Google Maps
          </button>
        )}
      </div>
    </div>
  );
}
