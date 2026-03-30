'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Lead, CallLog, Task, Appointment } from '@/types';
import { cn, formatPhone, formatDate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import Tag from '@/components/ui/Tag';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ActivityTimeline, {
  ActivityEntry,
} from '@/components/leads/ActivityTimeline';

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.id) return;

    async function fetchData() {
      setLoading(true);

      const [leadRes, callsRes, tasksRes, apptsRes] = await Promise.all([
        supabase.from('leads').select('*').eq('id', params.id).single(),
        supabase
          .from('call_logs')
          .select('*')
          .eq('contact_id', params.id)
          .order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('contact_id', params.id),
        supabase.from('appointments').select('*').eq('lead_id', params.id),
      ]);

      if (leadRes.error || !leadRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setLead(leadRes.data);
      setCallLogs(callsRes.data ?? []);
      setTasks(tasksRes.data ?? []);
      setAppointments(apptsRes.data ?? []);
      setLoading(false);
    }

    fetchData();
  }, [params.id]);

  // Build activity entries from call_logs + appointments
  const activities: ActivityEntry[] = [
    ...callLogs.map<ActivityEntry>((log) => ({
      id: log.id,
      type: 'call',
      title: `${log.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`,
      description: log.summary || log.transcript?.slice(0, 150) || null,
      badge: log.status?.toUpperCase() ?? undefined,
      badgeColor:
        log.status === 'completed'
          ? 'bg-emerald-100 text-emerald-700'
          : log.status === 'missed'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-slate-100 text-slate-600',
      timestamp: log.started_at || log.created_at,
    })),
    ...appointments.map<ActivityEntry>((appt) => ({
      id: appt.id,
      type: 'appointment',
      title: appt.type ? `${appt.type} Appointment` : 'Appointment',
      description: appt.notes,
      badge: appt.status?.toUpperCase() ?? undefined,
      badgeColor: 'bg-blue-100 text-blue-700',
      timestamp: appt.scheduled_at || appt.created_at,
    })),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-8">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-10 w-96 animate-pulse rounded bg-slate-100" />
        <div className="mt-8 grid grid-cols-12 gap-6">
          <div className="col-span-5 space-y-4">
            <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          </div>
          <div className="col-span-7 space-y-4">
            <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  // 404
  if (notFound || !lead) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <MaterialIcon icon="person_off" className="text-[64px] text-slate-300" />
        <h2 className="mt-4 text-2xl font-headline font-bold">Lead not found</h2>
        <p className="mt-1 text-secondary">
          This lead may have been removed or the link is incorrect.
        </p>
        <Link
          href="/leads"
          className="mt-6 flex items-center gap-2 rounded-xl action-gradient px-4 py-2 text-sm font-medium text-on-primary"
        >
          <MaterialIcon icon="arrow_back" className="text-[18px]" />
          Back to Lead Manifest
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-sm text-secondary hover:text-on-surface transition-colors"
          >
            <MaterialIcon icon="arrow_back" className="text-[16px]" />
            Back to List
          </Link>
          <h1 className="mt-2 text-4xl font-headline font-extrabold">
            {lead.property_address || lead.name}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <Badge status={lead.status} />
            {lead.source && (
              <span className="text-sm text-secondary">
                Source: {lead.source}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
            <MaterialIcon icon="phone" className="text-[18px]" />
            Log Call
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
            <MaterialIcon icon="note_add" className="text-[18px]" />
            Add Note
          </button>
          <button className="flex items-center gap-2 rounded-xl action-gradient px-4 py-2 text-sm font-medium text-on-primary transition-shadow hover:shadow-lg">
            <MaterialIcon icon="schedule" className="text-[18px]" />
            Schedule Follow-Up
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mt-8 flex gap-6">
        {/* Left column */}
        <div className="w-5/12 space-y-6">
          {/* Property Info */}
          <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
            {/* Image placeholder */}
            <div className="flex h-48 items-center justify-center bg-slate-100">
              <MaterialIcon
                icon="home"
                className="text-[64px] text-slate-300"
              />
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                {lead.type && (
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {lead.type}
                  </span>
                )}
                {lead.property_condition && (
                  <span className="text-xs text-secondary">
                    {lead.property_condition}
                  </span>
                )}
              </div>

              <p className="font-semibold text-on-surface">
                {lead.property_address || 'No address on file'}
              </p>

              {lead.source && (
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <MaterialIcon icon="source" className="text-[16px]" />
                  Source: {lead.source}
                </div>
              )}

              {lead.price_range && (
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <MaterialIcon icon="payments" className="text-[16px]" />
                  Value Estimate: {lead.price_range}
                </div>
              )}

              {/* Mini map placeholder */}
              <div className="flex h-32 items-center justify-center rounded-xl bg-slate-50 border border-outline-variant">
                <MaterialIcon
                  icon="map"
                  className="text-[32px] text-slate-300"
                />
                <span className="ml-2 text-sm text-slate-400">Map Preview</span>
              </div>
            </div>
          </div>

          {/* Owner Info */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-4">
            <h3 className="font-headline text-lg font-bold">Owner Info</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <MaterialIcon
                    icon="person"
                    className="text-[20px] text-blue-600"
                  />
                </div>
                <div>
                  <p className="font-semibold">{lead.name}</p>
                  {lead.email && (
                    <p className="text-xs text-secondary">{lead.email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MaterialIcon
                    icon="smartphone"
                    className="text-[16px] text-secondary"
                  />
                  <span className="text-secondary">Mobile:</span>
                  <span className="font-medium">
                    {formatPhone(lead.phone)}
                  </span>
                </div>
              </div>

              {lead.property_address && (
                <div className="flex items-start gap-2 text-sm">
                  <MaterialIcon
                    icon="mail"
                    className="mt-0.5 text-[16px] text-secondary"
                  />
                  <div>
                    <p className="text-secondary">Mailing Address</p>
                    <p className="font-medium">{lead.property_address}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="w-7/12 space-y-6">
          {/* Top meta row */}
          <div className="grid grid-cols-4 gap-4 rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Lead Status
              </p>
              <div className="mt-1">
                <Badge status={lead.status} />
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Tags
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {lead.tags?.length ? (
                  lead.tags.map((tag) => <Tag key={tag} label={tag} />)
                ) : (
                  <span className="text-sm text-slate-400">None</span>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Priority
              </p>
              <div className="mt-1 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <MaterialIcon
                    key={star}
                    icon="star"
                    filled={
                      lead.status === 'Hot Lead'
                        ? star <= 5
                        : lead.status === 'Interested'
                          ? star <= 4
                          : lead.status === 'Follow-Up'
                            ? star <= 3
                            : star <= 1
                    }
                    className={cn(
                      'text-[18px]',
                      lead.status === 'Hot Lead'
                        ? star <= 5
                          ? 'text-amber-500'
                          : 'text-slate-300'
                        : lead.status === 'Interested'
                          ? star <= 4
                            ? 'text-amber-500'
                            : 'text-slate-300'
                          : lead.status === 'Follow-Up'
                            ? star <= 3
                              ? 'text-amber-500'
                              : 'text-slate-300'
                            : star <= 1
                              ? 'text-amber-500'
                              : 'text-slate-300'
                    )}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Next Action
              </p>
              <p className="mt-1 text-sm font-medium text-on-surface">
                {lead.timeline ?? 'Not set'}
              </p>
            </div>
          </div>

          {/* Tasks */}
          {tasks.length > 0 && (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
              <h3 className="font-headline text-lg font-bold mb-3">
                Open Tasks
              </h3>
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-xl bg-surface-container-low p-3"
                  >
                    <MaterialIcon
                      icon={
                        task.status === 'completed'
                          ? 'check_circle'
                          : 'radio_button_unchecked'
                      }
                      className={cn(
                        'text-[20px]',
                        task.status === 'completed'
                          ? 'text-emerald-500'
                          : 'text-slate-400'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          task.status === 'completed' &&
                            'line-through text-secondary'
                        )}
                      >
                        {task.title}
                      </p>
                      {task.due_at && (
                        <p className="text-xs text-secondary">
                          Due {formatDate(task.due_at)}
                        </p>
                      )}
                    </div>
                    {task.priority && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                          task.priority === 'high'
                            ? 'bg-rose-100 text-rose-700'
                            : task.priority === 'medium'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {task.priority}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-headline text-lg font-bold">
              Activity Timeline
            </h3>
            <ActivityTimeline activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
