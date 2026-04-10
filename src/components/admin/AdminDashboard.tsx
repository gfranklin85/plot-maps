'use client';

import { useState } from 'react';
import Tabs from '@/components/ui/Tabs';
import OverviewTab from './OverviewTab';
import MarketsTab from './MarketsTab';
import AnalyticsTab from './AnalyticsTab';
import type { AdminData, AnalyticsData } from './admin-utils';

interface Props {
  data: Record<string, unknown>;
  analyticsData?: Record<string, unknown> | null;
}

export default function AdminDashboard({ data, analyticsData }: Props) {
  const [activeTab, setActiveTab] = useState('overview');
  const adminData = data as unknown as AdminData;
  const analytics = analyticsData as unknown as AnalyticsData | null;

  const tabs = [
    { label: 'Overview', key: 'overview' },
    { label: 'Markets', key: 'markets', count: adminData.summary.marketsNeedingAttention || undefined },
    { label: 'Analytics', key: 'analytics' },
  ];

  return (
    <div className="p-8 bg-surface min-h-[calc(100vh-4rem)] space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-on-surface tracking-tight font-headline">Plot Maps Admin</h1>
          <p className="text-sm text-secondary mt-1">Operator console</p>
        </div>
        <Tabs tabs={tabs} activeKey={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          summary={adminData.summary}
          users={adminData.users}
          hotProspects={analytics?.hotProspects || []}
          liveVisitors={analytics?.pulse?.liveVisitors || 0}
        />
      )}
      {activeTab === 'markets' && (
        <MarketsTab
          summary={adminData.summary}
          markets={adminData.markets}
        />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab analyticsData={analytics} />
      )}
    </div>
  );
}
