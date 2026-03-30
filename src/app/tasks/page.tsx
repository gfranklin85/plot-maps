'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Task } from '@/types';
import { cn, formatDate, formatTime } from '@/lib/utils';
import { TASK_TABS } from '@/lib/constants';
import Tabs from '@/components/ui/Tabs';
import MaterialIcon from '@/components/ui/MaterialIcon';

function getTaskIcon(task: Task): { icon: string; bg: string } {
  const title = (task.title || '').toLowerCase();
  if (title.includes('call') || title.includes('dial'))
    return { icon: 'call', bg: 'bg-amber-100 text-amber-600' };
  if (title.includes('hot') || task.priority === 'high')
    return { icon: 'local_fire_department', bg: 'bg-emerald-100 text-emerald-600' };
  if (title.includes('follow'))
    return { icon: 'history_edu', bg: 'bg-amber-100 text-amber-600' };
  return { icon: 'assignment', bg: 'bg-blue-100 text-blue-600' };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('due-today');

  useEffect(() => {
    async function fetchTasks() {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .order('due_at', { ascending: true });
      setTasks((data as Task[]) ?? []);
      setLoading(false);
    }
    fetchTasks();
  }, []);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 86400000);

  const dueTodayTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (!t.due_at) return false;
    const d = new Date(t.due_at);
    return d >= todayStart && d <= todayEnd;
  });

  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    if (!t.due_at) return false;
    return new Date(t.due_at) < todayStart;
  });

  const hotLeadTasks = tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      (t.priority === 'high' || t.priority === 'urgent')
  );

  const recentlyImported = tasks.filter((t) => {
    const d = new Date(t.created_at);
    return d >= sevenDaysAgo;
  });

  const tabCounts: Record<string, number> = {
    'due-today': dueTodayTasks.length,
    overdue: overdueTasks.length,
    'hot-leads': hotLeadTasks.length,
    'recently-imported': recentlyImported.length,
  };

  const tabsWithCounts = TASK_TABS.map((t) => ({
    ...t,
    count: tabCounts[t.key] ?? 0,
  }));

  const filteredTasks =
    activeTab === 'due-today'
      ? dueTodayTasks
      : activeTab === 'overdue'
        ? overdueTasks
        : activeTab === 'hot-leads'
          ? hotLeadTasks
          : recentlyImported;

  const todayFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const pendingCount = dueTodayTasks.length + overdueTasks.length;

  async function completeTask(id: string) {
    await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t
      )
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
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
        <div className="flex items-center gap-3">
          <button className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            <MaterialIcon icon="event_repeat" className="mr-1.5 text-[16px] align-middle" />
            Reschedule All
          </button>
          <button className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:shadow-xl transition-all">
            <MaterialIcon icon="done_all" className="mr-1.5 text-[16px] align-middle" />
            Bulk Complete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <Tabs tabs={tabsWithCounts} activeKey={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-surface-container-lowest py-20">
          <MaterialIcon icon="task_alt" className="text-[64px] text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">No tasks here</h3>
          <p className="mt-1 text-sm text-slate-400">
            {activeTab === 'due-today'
              ? 'You\'re all caught up for today!'
              : activeTab === 'overdue'
                ? 'No overdue tasks. Great work!'
                : activeTab === 'hot-leads'
                  ? 'No hot lead tasks at the moment.'
                  : 'No recently imported tasks.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => {
            const { icon, bg } = getTaskIcon(task);
            return (
              <div
                key={task.id}
                className="group flex items-center gap-6 rounded-2xl bg-surface-container-lowest p-6 hover:bg-white hover:shadow-xl transition-all"
              >
                {/* Icon */}
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
                    bg
                  )}
                >
                  <MaterialIcon icon={icon} className="text-[24px]" />
                </div>

                {/* Content grid */}
                <div className="grid flex-1 grid-cols-12 items-center gap-4">
                  {/* Name + address */}
                  <div className="col-span-4">
                    <p className="font-semibold text-on-surface">{task.title}</p>
                    <p className="text-sm text-secondary truncate">
                      {task.description || 'No description'}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="col-span-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        task.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {task.status}
                    </span>
                    {task.priority && (
                      <span
                        className={cn(
                          'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          task.priority === 'high' || task.priority === 'urgent'
                            ? 'bg-rose-100 text-rose-600'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {task.priority}
                      </span>
                    )}
                  </div>

                  {/* Last note */}
                  <div className="col-span-3">
                    <p className="text-sm text-secondary truncate">
                      {task.description
                        ? task.description.slice(0, 60)
                        : 'No notes yet'}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-medium text-slate-700">
                      {task.due_at ? formatTime(task.due_at) : '--'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {task.due_at ? formatDate(task.due_at) : ''}
                    </p>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => completeTask(task.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                    title="Mark complete"
                  >
                    <MaterialIcon icon="check" className="text-[18px]" />
                  </button>
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    title="More actions"
                  >
                    <MaterialIcon icon="more_vert" className="text-[18px]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Stats Row */}
      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Efficiency Rating */}
        <div className="lg:col-span-4 rounded-2xl bg-surface-container-lowest p-6">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Efficiency Rating
          </p>
          <p className="mt-1 font-headline text-3xl font-extrabold text-on-surface">
            84%
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
              style={{ width: '84%' }}
            />
          </div>
          <p className="mt-2 text-sm text-secondary">
            Based on task completion rate
          </p>
        </div>

        {/* Pipeline Value */}
        <div className="lg:col-span-4 rounded-2xl bg-surface-container-lowest p-6">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Pipeline Value
          </p>
          <p className="mt-1 font-headline text-3xl font-extrabold text-on-surface">
            $12.4M
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex items-center gap-0.5 text-sm font-medium text-emerald-600">
              <MaterialIcon icon="trending_up" className="text-[16px]" />
              +8.2%
            </span>
            <span className="text-sm text-secondary">vs last month</span>
          </div>
        </div>

        {/* Dialer CTA */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-center">
          <MaterialIcon icon="phone_in_talk" className="text-[36px] text-blue-400 mb-2" />
          <p className="text-lg font-bold text-white">Ready to dial?</p>
          <p className="mt-1 text-sm text-slate-400">
            {pendingCount} leads in queue
          </p>
          <button className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 px-6 py-3 text-sm font-extrabold uppercase tracking-wider text-white shadow-lg hover:shadow-xl transition-all">
            Start Dialer Queue
          </button>
        </div>
      </div>
    </div>
  );
}
