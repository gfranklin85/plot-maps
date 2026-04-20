'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import StatCard from './analytics/StatCard';
import RangePicker from './analytics/RangePicker';
import FunnelCard from './analytics/FunnelCard';
import DeviceDonut from './analytics/DeviceDonut';
import LandingPagesChart from './analytics/LandingPagesChart';
import UTMChart from './analytics/UTMChart';
import ProspectsTable from './analytics/ProspectsTable';
import ProspectDrawer from './analytics/ProspectDrawer';
import type { AnalyticsData, HotProspect } from './admin-utils';

type FunnelStepKey = 'visitors' | 'multiPage' | 'signedUp' | 'subscribed';

const RANGE_LABELS: Record<string, string> = { '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days' };

export default function WarRoom({ data: initialData, embedded }: { data: AnalyticsData; embedded?: boolean }) {
  const [data, setData] = useState<AnalyticsData>(initialData);
  const [range, setRange] = useState<string>(initialData.range || '30d');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [funnelFilter, setFunnelFilter] = useState<FunnelStepKey | null>(null);
  const [landingFilter, setLandingFilter] = useState<string | null>(null);
  const [selectedProspect, setSelectedProspect] = useState<HotProspect | null>(null);

  const refetch = useCallback(async (nextRange: string) => {
    try {
      const res = await fetch(`/api/admin/analytics?range=${nextRange}`);
      if (!res.ok) return;
      const json: AnalyticsData = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (range !== (initialData.range || '30d')) {
      refetch(range);
    }
  }, [range, refetch, initialData.range]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => refetch(range), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, range, refetch]);

  const { pulse, funnel, hotProspects, topLandingPages, utmBreakdown, devices, sessionsTimeline } = data;

  const filteredProspects = useMemo(() => {
    let list = hotProspects;
    if (funnelFilter === 'multiPage') list = list.filter(p => p.total_pageviews >= 3);
    if (landingFilter) list = list.filter(p => p.landing_page === landingFilter);
    return list;
  }, [hotProspects, funnelFilter, landingFilter]);

  const filterChips = [
    funnelFilter === 'multiPage' && {
      label: 'Funnel: 3+ pages',
      onClear: () => setFunnelFilter(null),
    },
    landingFilter && {
      label: `Landing: ${landingFilter}`,
      onClear: () => setLandingFilter(null),
    },
  ].filter(Boolean) as { label: string; onClear: () => void }[];

  const sessionsDelta = (() => {
    const curr = pulse.sessionsThisPeriod ?? 0;
    const prev = pulse.sessionsPriorPeriod ?? 0;
    if (prev === 0) return null;
    return { value: Math.round(((curr - prev) / prev) * 100), label: `vs prior ${range}` };
  })();

  const rangeLabel = RANGE_LABELS[range] || range;

  return (
    <div className={embedded ? 'space-y-8' : 'p-8 bg-surface min-h-[calc(100vh-4rem)] space-y-8'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
              <MaterialIcon icon="monitoring" className="text-primary" />
              Analytics War Room
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">Visitor intelligence and conversion tracking</p>
          </div>
          <a href="/admin" className="text-sm text-primary hover:underline flex items-center gap-1">
            <MaterialIcon icon="arrow_back" className="text-sm" /> Back to Admin
          </a>
        </div>
      )}

      <RangePicker
        value={range}
        onChange={setRange}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(a => !a)}
        lastUpdated={lastUpdated}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="radio_button_checked"
          iconColor="text-emerald-400"
          label="Live Visitors"
          value={pulse.liveVisitors}
          sublabel="active in last 5 min"
          pulse
          tooltip="Anonymous sessions whose last pageview happened within the last 5 minutes. Turn on auto-refresh to watch this in real time."
        />
        <StatCard
          icon="today"
          iconColor="text-sky-400"
          label="Sessions Today"
          value={pulse.sessionsToday}
          sublabel="since midnight"
          tooltip="Count of sessions with activity since 00:00 local time."
        />
        <StatCard
          icon="groups"
          iconColor="text-violet-400"
          label={`Sessions (${range})`}
          value={pulse.sessionsThisPeriod ?? pulse.totalSessions}
          sublabel={`lifetime: ${pulse.totalSessions.toLocaleString()}`}
          tooltip="New sessions in the selected date range. Sparkline shows day-by-day counts. The delta compares to the previous equal-length period."
          delta={sessionsDelta}
          sparkline={sessionsTimeline}
          sparklineColor="#8b5cf6"
        />
        <StatCard
          icon="trending_up"
          iconColor="text-amber-400"
          label="Conversion Rate (7d)"
          value={`${pulse.conversionRate}%`}
          sublabel="signed-up / visitors, last 7d"
          tooltip="Of all sessions in the last 7 days, the percentage that reached the signup / conversion event."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FunnelCard
            visitors={funnel.visitors}
            multiPage={funnel.multiPage}
            signedUp={funnel.signedUp}
            subscribed={funnel.subscribed}
            activeStep={funnelFilter}
            onStepClick={(step) => {
              if (step === 'multiPage') setFunnelFilter(funnelFilter === 'multiPage' ? null : 'multiPage');
            }}
          />
        </div>
        <DeviceDonut devices={devices} rangeLabel={rangeLabel} />
      </div>

      <ProspectsTable
        prospects={filteredProspects}
        filterChips={filterChips}
        onSelect={setSelectedProspect}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LandingPagesChart
          rows={topLandingPages}
          rangeLabel={rangeLabel}
          activePage={landingFilter}
          onPageClick={(page) => setLandingFilter(landingFilter === page ? null : page)}
        />
        <UTMChart rows={utmBreakdown} rangeLabel={rangeLabel} />
      </div>

      <ProspectDrawer prospect={selectedProspect} onClose={() => setSelectedProspect(null)} />
    </div>
  );
}
