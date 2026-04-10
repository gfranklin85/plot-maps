'use client';

import WarRoom from './WarRoom';
import type { AnalyticsData } from './admin-utils';

interface Props {
  analyticsData: AnalyticsData | null;
}

export default function AnalyticsTab({ analyticsData }: Props) {
  if (!analyticsData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-secondary">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return <WarRoom data={analyticsData} embedded />;
}
