'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Lead, Activity, LeadStatus, Priority, PRIORITY_COLORS } from '@/types';
import { cn, formatPhone } from '@/lib/utils';
import { LEAD_STATUSES, PRIORITIES } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import Tag from '@/components/ui/Tag';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ActivityTimeline from '@/components/leads/ActivityTimeline';
import CallPanel from '@/components/leads/CallPanel';
import QuickNotes from '@/components/leads/QuickNotes';
import FollowUpScheduler from '@/components/leads/FollowUpScheduler';
import EmailComposer from '@/components/leads/EmailComposer';
import MarketComps from '@/components/leads/MarketComps';
import StreetViewToggle from '@/components/leads/StreetViewToggle';
import NearbyPlaces from '@/components/leads/NearbyPlaces';
import DriveTimeCard from '@/components/leads/DriveTimeCard';

interface CallGuidance {
  opener: string;
  talking_points: string[];
  objection_responses: { objection: string; response: string }[];
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // AI Call Guidance
  const [guidance, setGuidance] = useState<CallGuidance | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);

  // Email composer collapsed
  const [emailOpen, setEmailOpen] = useState(false);

  // Scroll refs
  const callPanelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const schedulerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!params.id) return;

    const [leadRes, activitiesRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', params.id).single(),
      supabase
        .from('activities')
        .select('*')
        .eq('lead_id', params.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (leadRes.error || !leadRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLead(leadRes.data);
    setActivities(activitiesRes.data ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Update priority
  const updatePriority = async (newPriority: Priority) => {
    if (!lead) return;
    await supabase.from('leads').update({ priority: newPriority }).eq('id', lead.id);
    setLead((prev) => (prev ? { ...prev, priority: newPriority } : null));
  };

  // Update status
  const updateStatus = async (newStatus: LeadStatus) => {
    if (!lead) return;
    const oldStatus = lead.status;
    await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id);

    // Log status change activity
    await supabase.from('activities').insert({
      lead_id: lead.id,
      type: 'status_change',
      title: `Status changed from ${oldStatus} to ${newStatus}`,
      description: null,
      outcome: null,
    });

    setLead((prev) => (prev ? { ...prev, status: newStatus } : null));
    refreshData();
  };

  // Fetch AI call guidance
  const fetchGuidance = async () => {
    if (!lead) return;
    setGuidanceLoading(true);
    try {
      const res = await fetch('/api/ai/call-guidance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setGuidance(data);
        setGuidanceOpen(true);
      }
    } finally {
      setGuidanceLoading(false);
    }
  };

  // Scroll helpers
  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Days since added
  const daysAgo = lead
    ? Math.floor(
        (Date.now() - new Date(lead.created_at).getTime()) / 86400000
      )
    : 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="p-8">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 h-10 w-96 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-5 w-64 animate-pulse rounded bg-slate-100" />
        <div className="mt-8 flex gap-6">
          <div className="w-5/12 space-y-4">
            <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          </div>
          <div className="w-7/12 space-y-4">
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
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
      {/* ─── Top Header Bar ─── */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-sm text-secondary hover:text-on-surface transition-colors"
          >
            <MaterialIcon icon="arrow_back" className="text-[16px]" />
            Back to List
          </Link>

          <h1 className="mt-2 text-3xl font-headline font-extrabold">
            {lead.property_address || lead.name}
          </h1>

          <div className="mt-2 flex items-center gap-3">
            <Badge status={lead.status} />
            {lead.priority && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase',
                  PRIORITY_COLORS[lead.priority]
                )}
              >
                {lead.priority}
              </span>
            )}
            <span className="text-sm text-secondary">
              Added {daysAgo === 0 ? 'today' : `${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`}
            </span>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollTo(callPanelRef)}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <MaterialIcon icon="phone" className="text-[18px]" />
            Log Call
          </button>
          <button
            onClick={() => scrollTo(notesRef)}
            className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
          >
            <MaterialIcon icon="note_add" className="text-[18px]" />
            Add Note
          </button>
          <button
            onClick={() => scrollTo(schedulerRef)}
            className="flex items-center gap-2 rounded-xl action-gradient px-4 py-2 text-sm font-medium text-on-primary transition-shadow hover:shadow-lg"
          >
            <MaterialIcon icon="schedule" className="text-[18px]" />
            Schedule Follow-Up
          </button>
        </div>
      </div>

      {/* ─── Two-column layout ─── */}
      <div className="mt-8 flex gap-6">
        {/* ═══ Left Column ═══ */}
        <div className="w-5/12 space-y-6">
          {/* Street View / Map Card */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
            <StreetViewToggle lead={lead} />
          </div>

          {/* Drive Time Card */}
          <DriveTimeCard lead={lead} />

          {/* Property Info Card */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-4">
            <h3 className="font-headline text-lg font-bold">Property Info</h3>

            {/* Type / condition badges */}
            <div className="flex items-center gap-2">
              {lead.type && (
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {lead.type}
                </span>
              )}
              {lead.property_condition && (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {lead.property_condition}
                </span>
              )}
            </div>

            {/* Address */}
            <div className="flex items-start gap-2 text-sm">
              <MaterialIcon icon="location_on" className="mt-0.5 text-[16px] text-secondary" />
              <div>
                <p className="font-semibold text-on-surface">
                  {lead.property_address || 'No address on file'}
                </p>
                {(lead.city || lead.state || lead.zip) && (
                  <p className="text-secondary">
                    {[lead.city, lead.state].filter(Boolean).join(', ')}{' '}
                    {lead.zip}
                  </p>
                )}
              </div>
            </div>

            {/* Source */}
            {lead.source && (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <MaterialIcon icon="source" className="text-[16px]" />
                Source: {lead.source}
              </div>
            )}

            {/* Price range / value */}
            {lead.price_range && (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <MaterialIcon icon="payments" className="text-[16px]" />
                Value Estimate: {lead.price_range}
              </div>
            )}

            {/* Priority selector */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
                Priority
              </p>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    onClick={() => updatePriority(p)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-bold uppercase transition-all',
                      lead.priority === p
                        ? PRIORITY_COLORS[p]
                        : 'bg-surface-container-low text-secondary hover:bg-surface-container'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Status selector */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
                Status
              </p>
              <select
                value={lead.status}
                onChange={(e) => updateStatus(e.target.value as LeadStatus)}
                className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lead.tags?.length ? (
                  lead.tags.map((tag) => <Tag key={tag} label={tag} />)
                ) : (
                  <span className="text-sm text-slate-400">None</span>
                )}
              </div>
            </div>
          </div>

          {/* Owner Info Card */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 space-y-4">
            <h3 className="font-headline text-lg font-bold">Owner Info</h3>

            {/* Name */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <MaterialIcon icon="person" className="text-[20px] text-blue-600" />
              </div>
              <p className="font-semibold text-on-surface">
                {lead.owner_name || lead.name}
              </p>
            </div>

            {/* Phone numbers */}
            <div className="space-y-2">
              {[
                { label: 'Phone 1', value: lead.phone },
                { label: 'Phone 2', value: lead.phone_2 },
                { label: 'Phone 3', value: lead.phone_3 },
              ]
                .filter((p) => p.value)
                .map((p) => (
                  <div key={p.label} className="flex items-center gap-2 text-sm">
                    <MaterialIcon icon="phone" className="text-[16px] text-secondary" />
                    <span className="text-secondary">{p.label}:</span>
                    <span className="font-medium">{formatPhone(p.value!)}</span>
                    <a
                      href={`tel:${p.value}`}
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                      title={`Call ${p.value}`}
                    >
                      <MaterialIcon icon="call" className="text-[16px]" />
                    </a>
                  </div>
                ))}
              {!lead.phone && !lead.phone_2 && !lead.phone_3 && (
                <p className="text-sm text-slate-400">No phone numbers on file</p>
              )}
            </div>

            {/* Email */}
            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <MaterialIcon icon="mail" className="text-[16px] text-secondary" />
                <a
                  href={`mailto:${lead.email}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {lead.email}
                </a>
              </div>
            )}

            {/* Mailing address */}
            {lead.mailing_address && (
              <div className="flex items-start gap-2 text-sm">
                <MaterialIcon icon="markunread_mailbox" className="mt-0.5 text-[16px] text-secondary" />
                <div>
                  <p className="text-secondary">Mailing Address</p>
                  <p className="font-medium">{lead.mailing_address}</p>
                  {(lead.mailing_city || lead.mailing_state || lead.mailing_zip) && (
                    <p className="text-secondary">
                      {[lead.mailing_city, lead.mailing_state]
                        .filter(Boolean)
                        .join(', ')}{' '}
                      {lead.mailing_zip}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Nearby Places */}
          <NearbyPlaces lead={lead} />

          {/* Market Comps Card */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-headline text-lg font-bold">Market Comps</h3>
            <MarketComps leadId={lead.id} />
          </div>
        </div>

        {/* ═══ Right Column ═══ */}
        <div className="w-7/12 space-y-6">
          {/* Call Panel */}
          <div ref={callPanelRef} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-headline text-lg font-bold flex items-center gap-2">
              <MaterialIcon icon="phone_in_talk" className="text-[22px] text-blue-600" />
              Call Panel
            </h3>
            <CallPanel lead={lead} onActivityLogged={refreshData} />
          </div>

          {/* AI Call Guidance */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold flex items-center gap-2">
                <MaterialIcon icon="auto_awesome" className="text-[22px] text-amber-500" />
                AI Call Guidance
              </h3>
              <button
                onClick={guidance ? () => setGuidanceOpen(!guidanceOpen) : fetchGuidance}
                disabled={guidanceLoading}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all',
                  guidance
                    ? 'border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                    : 'action-gradient text-on-primary hover:shadow-lg'
                )}
              >
                {guidanceLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Generating...
                  </>
                ) : guidance ? (
                  <>
                    <MaterialIcon
                      icon={guidanceOpen ? 'expand_less' : 'expand_more'}
                      className="text-[18px]"
                    />
                    {guidanceOpen ? 'Collapse' : 'Expand'}
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="auto_awesome" className="text-[18px]" />
                    Get Call Script
                  </>
                )}
              </button>
            </div>

            {guidanceOpen && guidance && (
              <div className="mt-4 space-y-4">
                {/* Opener */}
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold mb-1">
                    Opener
                  </p>
                  <p className="text-sm text-blue-900">{guidance.opener}</p>
                </div>

                {/* Talking points */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                    Talking Points
                  </p>
                  <ul className="space-y-1.5">
                    {guidance.talking_points.map((point, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-on-surface"
                      >
                        <MaterialIcon
                          icon="check_circle"
                          className="mt-0.5 text-[16px] text-emerald-500"
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Objection responses */}
                {guidance.objection_responses.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                      Objection Handling
                    </p>
                    <div className="space-y-2">
                      {guidance.objection_responses.map((item, i) => (
                        <div
                          key={i}
                          className="rounded-xl bg-surface-container-low p-3 text-sm"
                        >
                          <p className="font-semibold text-rose-600">
                            &ldquo;{item.objection}&rdquo;
                          </p>
                          <p className="mt-1 text-secondary">{item.response}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Notes */}
          <div ref={notesRef} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-headline text-lg font-bold flex items-center gap-2">
              <MaterialIcon icon="edit_note" className="text-[22px] text-amber-600" />
              Quick Notes
            </h3>
            <QuickNotes leadId={lead.id} onNoteSaved={refreshData} />
          </div>

          {/* Follow-Up Scheduler */}
          <div ref={schedulerRef} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-headline text-lg font-bold flex items-center gap-2">
              <MaterialIcon icon="event" className="text-[22px] text-violet-600" />
              Follow-Up Scheduler
            </h3>
            <FollowUpScheduler lead={lead} onScheduled={refreshData} />
          </div>

          {/* Email Composer (collapsible, starts closed) */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <button
              onClick={() => setEmailOpen(!emailOpen)}
              className="flex w-full items-center justify-between"
            >
              <h3 className="font-headline text-lg font-bold flex items-center gap-2">
                <MaterialIcon icon="mail" className="text-[22px] text-blue-600" />
                Email Composer
              </h3>
              <MaterialIcon
                icon={emailOpen ? 'expand_less' : 'expand_more'}
                className="text-[24px] text-secondary"
              />
            </button>
            {emailOpen && (
              <div className="mt-4">
                <EmailComposer lead={lead} onEmailSent={refreshData} />
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5">
            <h3 className="mb-4 font-headline text-lg font-bold flex items-center gap-2">
              <MaterialIcon icon="timeline" className="text-[22px] text-slate-500" />
              Activity Timeline
            </h3>
            <ActivityTimeline activities={activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
