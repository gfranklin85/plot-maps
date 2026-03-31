'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Lead, Activity, DailyTarget, ActionItem } from '@/types';
import StatCard from '@/components/ui/StatCard';
import DailyTargetBars from '@/components/dashboard/DailyTargetBars';
import ActionList from '@/components/dashboard/ActionList';
import Scorecard from '@/components/dashboard/Scorecard';
import MaterialIcon from '@/components/ui/MaterialIcon';

const DEFAULT_TARGETS: DailyTarget = {
  id: '',
  target_date: '',
  conversations_target: 10,
  conversations_actual: 0,
  followups_target: 5,
  followups_actual: 0,
  letters_target: 3,
  letters_actual: 0,
  new_contacts_target: 5,
  new_contacts_actual: 0,
  notes: null,
  created_at: '',
  updated_at: '',
};

export default function Dashboard() {
  const [targets, setTargets] = useState<DailyTarget>(DEFAULT_TARGETS);
  const [attentionLeads, setAttentionLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [callsToday, setCallsToday] = useState(0);
  const [leadsByStatus, setLeadsByStatus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayStr = now.toISOString().slice(0, 10);

    // Week start (Monday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const [
      targetsRes,
      attentionRes,
      activitiesRes,
      totalRes,
      newWeekRes,
      callsTodayRes,
    ] = await Promise.all([
      // Daily targets from API
      fetch('/api/daily-targets').then((r) => r.json()).catch(() => null),

      // Leads needing attention
      supabase
        .from('leads')
        .select('*')
        .eq('follow_up_date', todayStr)
        .in('status', ['Follow-Up', 'Hot Lead', 'New'])
        .eq('priority', 'high')
        .order('follow_up_date', { ascending: true })
        .limit(20),

      // Today's activities
      supabase
        .from('activities')
        .select('*')
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false }),

      // Total lead count
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true }),

      // New leads this week
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekStart.toISOString()),

      // Calls today
      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('type', 'call')
        .gte('created_at', todayStart),
    ]);

    if (targetsRes && targetsRes.id) {
      setTargets(targetsRes);
    }

    setAttentionLeads((attentionRes.data as Lead[]) ?? []);
    setActivities((activitiesRes.data as Activity[]) ?? []);
    setTotalLeads(totalRes.count ?? 0);
    setNewThisWeek(newWeekRes.count ?? 0);
    setCallsToday(callsTodayRes.count ?? 0);

    // Pipeline summary
    const allLeads = await supabase
      .from('leads')
      .select('status');
    if (allLeads.data) {
      const counts: Record<string, number> = {};
      for (const row of allLeads.data) {
        counts[row.status] = (counts[row.status] || 0) + 1;
      }
      setLeadsByStatus(counts);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleTargetUpdate(field: string, value: number) {
    const updated = { ...targets, [field]: value };
    setTargets(updated);
    await fetch('/api/daily-targets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function generateActionList() {
    setActionLoading(true);
    try {
      const res = await fetch('/api/ai/action-list', { method: 'POST' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setActionItems(data);
      }
    } catch {
      // Silently fail — the user can retry
    } finally {
      setActionLoading(false);
    }
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const pendingCount = attentionLeads.length + actionItems.length;

  // Avg calls per day (total calls / 5 workdays as rough estimate)
  const avgCallsDay = callsToday > 0 ? callsToday : 0;

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-headline text-4xl font-extrabold text-on-surface">
            Daily Action Center
          </h2>
          <p className="mt-1 text-secondary">
            {todayFormatted}
            {pendingCount > 0 && (
              <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <MaterialIcon icon="schedule" className="text-[14px]" />
                {pendingCount} pending actions
              </span>
            )}
          </p>
        </div>

        <button
          onClick={generateActionList}
          disabled={actionLoading}
          className="flex items-center gap-2 rounded-xl action-gradient px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-shadow hover:shadow-lg disabled:opacity-60"
        >
          <MaterialIcon
            icon="auto_awesome"
            className={`text-[18px] ${actionLoading ? 'animate-spin' : ''}`}
          />
          {actionLoading ? 'Generating...' : 'Generate Action List'}
        </button>
      </div>

      {/* Top Row: Daily Target Progress Bars */}
      <div className="mb-8">
        <DailyTargetBars targets={targets} onUpdate={handleTargetUpdate} />
      </div>

      {/* Main Content: Two Columns */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Action List */}
        <div className="lg:col-span-8">
          <ActionList
            actions={actionItems}
            loading={actionLoading}
            fallbackLeads={attentionLeads}
          />
        </div>

        {/* Right Column: Scorecard + Stats */}
        <div className="lg:col-span-4">
          <Scorecard
            activities={activities}
            targets={targets}
            leadsByStatus={leadsByStatus}
          />
        </div>
      </div>

      {/* Bottom Row: Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          label="New This Week"
          value={loading ? '--' : newThisWeek}
          subtitle="added this week"
          bgIcon="person_add"
          trendIcon="trending_up"
          trendPercent={`+${newThisWeek}`}
          trendUp
        />
        <StatCard
          label="Calls Today"
          value={loading ? '--' : avgCallsDay}
          subtitle="calls made"
          bgIcon="call"
          trendIcon={avgCallsDay >= 5 ? 'trending_up' : 'trending_down'}
          trendPercent={avgCallsDay >= 5 ? 'On track' : 'Behind pace'}
          trendUp={avgCallsDay >= 5}
        />
      </div>
    </div>
  );
}
