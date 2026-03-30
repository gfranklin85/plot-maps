'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Lead, Task } from '@/types';
import StatCard from '@/components/ui/StatCard';
import FollowUpList from '@/components/dashboard/FollowUpList';
import RecentLeads from '@/components/dashboard/RecentLeads';
import OutreachChart from '@/components/dashboard/OutreachChart';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function Dashboard() {
  const [totalLeads, setTotalLeads] = useState(0);
  const [newLeadsToday, setNewLeadsToday] = useState(0);
  const [calledToday, setCalledToday] = useState(0);
  const [tasksDueToday, setTasksDueToday] = useState<Task[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

      const [
        totalRes,
        newTodayRes,
        calledTodayRes,
        tasksRes,
        recentRes,
      ] = await Promise.all([
        // Total leads
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true }),

        // New leads today
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayStart),

        // Calls made today
        supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayStart),

        // Tasks due today (not completed)
        supabase
          .from('tasks')
          .select('*, lead:leads(*)')
          .gte('due_at', todayStart)
          .lte('due_at', todayEnd)
          .neq('status', 'completed'),

        // Recent leads
        supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setTotalLeads(totalRes.count ?? 0);
      setNewLeadsToday(newTodayRes.count ?? 0);
      setCalledToday(calledTodayRes.count ?? 0);
      setTasksDueToday((tasksRes.data as Task[]) ?? []);
      setRecentLeads((recentRes.data as Lead[]) ?? []);
      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const pendingCount = tasksDueToday.length;

  // Derive outreach numbers from tasks / leads
  const newProspects = newLeadsToday;
  const scheduledFollowUps = tasksDueToday.filter(
    (t) => t.title?.toLowerCase().includes('follow') || t.priority === 'high'
  ).length;

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8">
        <h2 className="font-headline text-4xl font-extrabold text-on-surface">
          Daily Work Queue
        </h2>
        <p className="mt-1 text-secondary">
          {todayFormatted}
          {pendingCount > 0 && (
            <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              <MaterialIcon icon="schedule" className="text-[14px]" />
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Leads"
          value={loading ? '--' : totalLeads}
          subtitle="in pipeline"
          bgIcon="group"
          trendIcon="trending_up"
          trendPercent="+12%"
          trendUp
        />
        <StatCard
          label="New Leads Today"
          value={loading ? '--' : newLeadsToday}
          subtitle="imported today"
          bgIcon="person_add"
          trendIcon="trending_up"
          trendPercent="+3"
          trendUp
        />
        <StatCard
          label="Called Today"
          value={loading ? '--' : calledToday}
          subtitle="calls made"
          bgIcon="call"
          trendIcon={calledToday >= 5 ? 'trending_up' : 'trending_down'}
          trendPercent={calledToday >= 5 ? 'On track' : 'Behind pace'}
          trendUp={calledToday >= 5}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-8">
          <FollowUpList tasks={tasksDueToday} />
          <RecentLeads leads={recentLeads} />
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-4">
          <OutreachChart
            newProspects={newProspects}
            calledPitching={calledToday}
            scheduledFollowUps={scheduledFollowUps}
            dailyAverage={5}
          />

          {/* Market Hotspots placeholder */}
          <div className="rounded-2xl bg-surface-container-lowest p-6">
            <h3 className="font-headline text-lg font-bold text-on-surface mb-4">
              Market Hotspots
            </h3>
            <div className="flex flex-col items-center justify-center py-8 text-secondary">
              <MaterialIcon icon="map" className="text-[48px] text-slate-300 mb-2" />
              <p className="text-sm text-center">
                Lead density heatmap coming soon.
              </p>
              <a
                href="/map"
                className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Open Map View
                <MaterialIcon icon="arrow_forward" className="text-[16px]" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
