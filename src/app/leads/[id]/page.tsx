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
import NearbyPlaces from '@/components/leads/NearbyPlaces';
import DriveTimeCard from '@/components/leads/DriveTimeCard';

type ViewMode = 'street' | 'map' | 'satellite' | 'hybrid';

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

  // View mode for the large map panel
  const [viewMode, setViewMode] = useState<ViewMode>('street');

  // AI Call Guidance
  const [guidance, setGuidance] = useState<CallGuidance | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);

  // Collapsible sections
  const [emailOpen, setEmailOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Scroll refs
  const callPanelRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const schedulerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!params.id) return;
    const [leadRes, activitiesRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', params.id).single(),
      supabase.from('activities').select('*').eq('lead_id', params.id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (leadRes.error || !leadRes.data) { setNotFound(true); setLoading(false); return; }
    setLead(leadRes.data);
    setActivities(activitiesRes.data ?? []);
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const refreshData = useCallback(() => { fetchData(); }, [fetchData]);

  const updatePriority = async (p: Priority) => {
    if (!lead) return;
    await supabase.from('leads').update({ priority: p }).eq('id', lead.id);
    setLead((prev) => (prev ? { ...prev, priority: p } : null));
  };

  const updateStatus = async (s: LeadStatus) => {
    if (!lead) return;
    const old = lead.status;
    await supabase.from('leads').update({ status: s }).eq('id', lead.id);
    await supabase.from('activities').insert({ lead_id: lead.id, type: 'status_change', title: `Status: ${old} → ${s}` });
    setLead((prev) => (prev ? { ...prev, status: s } : null));
    refreshData();
  };

  const fetchGuidance = async () => {
    if (!lead) return;
    setGuidanceLoading(true);
    try {
      const res = await fetch('/api/ai/call-guidance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id }) });
      if (res.ok) { const data = await res.json(); setGuidance(data); setGuidanceOpen(true); }
    } finally { setGuidanceLoading(false); }
  };

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // Build iframe URL based on view mode
  const getMapUrl = () => {
    if (!lead) return '';
    const hasCoords = lead.latitude != null && lead.longitude != null;
    const addr = encodeURIComponent(lead.property_address || '');

    switch (viewMode) {
      case 'street':
        return hasCoords
          ? `https://www.google.com/maps/embed/v1/streetview?location=${lead.latitude},${lead.longitude}&key=${API_KEY}&heading=0&pitch=0&fov=90`
          : '';
      case 'map':
        return hasCoords
          ? `https://www.google.com/maps/embed/v1/place?q=${lead.latitude},${lead.longitude}&key=${API_KEY}&zoom=17`
          : `https://www.google.com/maps/embed/v1/place?q=${addr}&key=${API_KEY}&zoom=17`;
      case 'satellite':
        return hasCoords
          ? `https://www.google.com/maps/embed/v1/view?center=${lead.latitude},${lead.longitude}&key=${API_KEY}&zoom=19&maptype=satellite`
          : '';
      case 'hybrid':
        return hasCoords
          ? `https://www.google.com/maps/embed/v1/view?center=${lead.latitude},${lead.longitude}&key=${API_KEY}&zoom=18&maptype=satellite`
          : '';
    }
  };

  const daysAgo = lead ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000) : 0;

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-[50vh] animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-4 flex gap-6">
          <div className="w-1/3 h-64 animate-pulse rounded-2xl bg-slate-100" />
          <div className="w-2/3 h-64 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <MaterialIcon icon="person_off" className="text-[64px] text-slate-300" />
        <h2 className="mt-4 text-2xl font-headline font-bold">Lead not found</h2>
        <Link href="/leads" className="mt-6 flex items-center gap-2 rounded-xl action-gradient px-4 py-2 text-sm font-medium text-on-primary">
          <MaterialIcon icon="arrow_back" className="text-[18px]" /> Back to Lead Manifest
        </Link>
      </div>
    );
  }

  const mapUrl = getMapUrl();

  return (
    <div className="p-4 pb-8">
      {/* ─── HEADER: Address + Contact + Quick Actions ─── */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-4">
          <Link href="/leads" className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-low text-secondary hover:bg-surface-container transition-colors">
            <MaterialIcon icon="arrow_back" className="text-[20px]" />
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-extrabold leading-tight">
              {lead.property_address || lead.name}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge status={lead.status} />
              {lead.priority && (
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', PRIORITY_COLORS[lead.priority])}>
                  {lead.priority}
                </span>
              )}
              <span className="text-xs text-secondary">
                {lead.city && `${lead.city}, `}{lead.state} · Added {daysAgo === 0 ? 'today' : `${daysAgo}d ago`}
              </span>
            </div>
          </div>
        </div>

        {/* Owner quick info + action buttons */}
        <div className="flex items-center gap-3">
          {/* Owner name + phone */}
          <div className="text-right mr-2">
            <p className="text-sm font-bold">{lead.owner_name || lead.name}</p>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className="text-sm text-blue-600 font-medium hover:underline">
                {formatPhone(lead.phone)}
              </a>
            )}
          </div>
          <button onClick={() => scrollTo(callPanelRef)} className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors">
            <MaterialIcon icon="phone" className="text-[18px]" /> Call
          </button>
          <button onClick={() => scrollTo(notesRef)} className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm font-medium text-on-surface hover:bg-surface-container transition-colors">
            <MaterialIcon icon="note_add" className="text-[18px]" /> Note
          </button>
          <button onClick={() => scrollTo(schedulerRef)} className="flex items-center gap-1.5 rounded-xl action-gradient px-3 py-2 text-sm font-medium text-on-primary hover:shadow-lg transition-shadow">
            <MaterialIcon icon="schedule" className="text-[18px]" /> Follow-Up
          </button>
        </div>
      </div>

      {/* ─── LARGE MAP / STREET VIEW PANEL (dominant visual) ─── */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-100" style={{ height: '50vh' }}>
        {/* View mode switcher - top right overlay */}
        <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-0.5 rounded-full glass-card p-1 shadow-lg">
          {([
            { key: 'street', label: 'Street', icon: 'streetview' },
            { key: 'map', label: 'Map', icon: 'map' },
            { key: 'satellite', label: 'Satellite', icon: 'satellite_alt' },
            { key: 'hybrid', label: 'Hybrid', icon: 'layers' },
          ] as { key: ViewMode; label: string; icon: string }[]).map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={cn(
                'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                viewMode === v.key
                  ? 'bg-white text-blue-600 font-bold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <span className="material-symbols-outlined text-[16px]">{v.icon}</span>
              {v.label}
            </button>
          ))}
        </div>

        {/* Drive time overlay - bottom left */}
        <div className="absolute bottom-3 left-3 z-10">
          <DriveTimeCard lead={lead} />
        </div>

        {/* The map/streetview iframe */}
        {mapUrl ? (
          <iframe
            src={mapUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-secondary">
            <div className="text-center">
              <MaterialIcon icon="location_off" className="text-[48px] text-slate-300" />
              <p className="mt-2 text-sm">No location data available</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── BELOW MAP: Two-column layout ─── */}
      <div className="mt-4 flex gap-4">
        {/* ═══ Left Column: Contact + Call ═══ */}
        <div className="w-5/12 space-y-4">
          {/* Owner / Contact Card */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <MaterialIcon icon="person" className="text-[20px] text-blue-600" />
              </div>
              <div>
                <p className="font-bold text-on-surface">{lead.owner_name || lead.name}</p>
                {lead.source && <p className="text-xs text-secondary">Source: {lead.source}</p>}
              </div>
            </div>

            {/* All phone numbers */}
            <div className="space-y-1.5">
              {[
                { label: 'Primary', value: lead.phone },
                { label: 'Phone 2', value: lead.phone_2 },
                { label: 'Phone 3', value: lead.phone_3 },
              ].filter((p) => p.value).map((p) => (
                <div key={p.label} className="flex items-center gap-2 text-sm">
                  <MaterialIcon icon="phone" className="text-[16px] text-secondary" />
                  <span className="text-secondary text-xs">{p.label}:</span>
                  <span className="font-medium">{formatPhone(p.value!)}</span>
                  <a href={`tel:${p.value}`} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors">
                    <MaterialIcon icon="call" className="text-[14px]" />
                  </a>
                </div>
              ))}
            </div>

            {lead.email && (
              <div className="flex items-center gap-2 text-sm">
                <MaterialIcon icon="mail" className="text-[16px] text-secondary" />
                <a href={`mailto:${lead.email}`} className="font-medium text-blue-600 hover:underline">{lead.email}</a>
              </div>
            )}

            {lead.mailing_address && (
              <div className="flex items-start gap-2 text-sm border-t border-outline-variant/30 pt-2">
                <MaterialIcon icon="markunread_mailbox" className="mt-0.5 text-[16px] text-secondary" />
                <div>
                  <p className="text-xs text-secondary">Mailing</p>
                  <p className="font-medium text-xs">{lead.mailing_address}, {[lead.mailing_city, lead.mailing_state].filter(Boolean).join(', ')} {lead.mailing_zip}</p>
                </div>
              </div>
            )}

            {/* Priority + Status */}
            <div className="flex gap-3 border-t border-outline-variant/30 pt-2">
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Priority</p>
                <div className="flex gap-1">
                  {PRIORITIES.map((p) => (
                    <button key={p} onClick={() => updatePriority(p)}
                      className={cn('rounded-lg px-2 py-1 text-[10px] font-bold uppercase transition-all', lead.priority === p ? PRIORITY_COLORS[p] : 'bg-surface-container-low text-secondary hover:bg-surface-container')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Status</p>
                <select value={lead.status} onChange={(e) => updateStatus(e.target.value as LeadStatus)}
                  className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Tags */}
            {lead.tags && lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((tag) => <Tag key={tag} label={tag} />)}
              </div>
            )}
          </div>

          {/* Call Panel */}
          <div ref={callPanelRef} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <h3 className="mb-3 font-headline text-base font-bold flex items-center gap-2">
              <MaterialIcon icon="phone_in_talk" className="text-[20px] text-blue-600" />
              Call Panel
            </h3>
            <CallPanel lead={lead} onActivityLogged={refreshData} />
          </div>

          {/* AI Call Guidance */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-base font-bold flex items-center gap-2">
                <MaterialIcon icon="auto_awesome" className="text-[20px] text-amber-500" />
                AI Script
              </h3>
              <button onClick={guidance ? () => setGuidanceOpen(!guidanceOpen) : fetchGuidance} disabled={guidanceLoading}
                className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  guidance ? 'border border-outline-variant text-on-surface hover:bg-surface-container' : 'action-gradient text-on-primary hover:shadow-lg')}>
                {guidanceLoading ? <><div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> Loading...</>
                  : guidance ? <><MaterialIcon icon={guidanceOpen ? 'expand_less' : 'expand_more'} className="text-[16px]" />{guidanceOpen ? 'Hide' : 'Show'}</>
                  : <><MaterialIcon icon="auto_awesome" className="text-[16px]" /> Generate</>}
              </button>
            </div>
            {guidanceOpen && guidance && (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-blue-600 font-bold mb-1">Opener</p>
                  <p className="text-sm text-blue-900">{guidance.opener}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Talking Points</p>
                  <ul className="space-y-1">
                    {guidance.talking_points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs"><MaterialIcon icon="check_circle" className="mt-0.5 text-[14px] text-emerald-500" />{pt}</li>
                    ))}
                  </ul>
                </div>
                {guidance.objection_responses.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Objections</p>
                    {guidance.objection_responses.map((o, i) => (
                      <div key={i} className="rounded-lg bg-surface-container-low p-2 text-xs mb-1">
                        <p className="font-semibold text-rose-600">&ldquo;{o.objection}&rdquo;</p>
                        <p className="text-secondary mt-0.5">{o.response}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══ Right Column: Notes + Follow-up + Details ═══ */}
        <div className="w-7/12 space-y-4">
          {/* Quick Notes */}
          <div ref={notesRef} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <h3 className="mb-3 font-headline text-base font-bold flex items-center gap-2">
              <MaterialIcon icon="edit_note" className="text-[20px] text-amber-600" />
              Quick Notes
            </h3>
            <QuickNotes leadId={lead.id} onNoteSaved={refreshData} />
          </div>

          {/* Follow-Up Scheduler */}
          <div ref={schedulerRef} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <h3 className="mb-3 font-headline text-base font-bold flex items-center gap-2">
              <MaterialIcon icon="event" className="text-[20px] text-violet-600" />
              Follow-Up Scheduler
            </h3>
            <FollowUpScheduler lead={lead} onScheduled={refreshData} />
          </div>

          {/* Email Composer (collapsed) */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <button onClick={() => setEmailOpen(!emailOpen)} className="flex w-full items-center justify-between">
              <h3 className="font-headline text-base font-bold flex items-center gap-2">
                <MaterialIcon icon="mail" className="text-[20px] text-blue-600" /> Email
              </h3>
              <MaterialIcon icon={emailOpen ? 'expand_less' : 'expand_more'} className="text-[22px] text-secondary" />
            </button>
            {emailOpen && <div className="mt-3"><EmailComposer lead={lead} onEmailSent={refreshData} /></div>}
          </div>

          {/* Activity Timeline */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <h3 className="mb-3 font-headline text-base font-bold flex items-center gap-2">
              <MaterialIcon icon="timeline" className="text-[20px] text-slate-500" /> Activity
            </h3>
            <ActivityTimeline activities={activities} />
          </div>

          {/* Property Details + Nearby + Comps (collapsed) */}
          <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <button onClick={() => setDetailsOpen(!detailsOpen)} className="flex w-full items-center justify-between">
              <h3 className="font-headline text-base font-bold flex items-center gap-2">
                <MaterialIcon icon="info" className="text-[20px] text-slate-500" /> Property Details, Nearby & Comps
              </h3>
              <MaterialIcon icon={detailsOpen ? 'expand_less' : 'expand_more'} className="text-[22px] text-secondary" />
            </button>
            {detailsOpen && (
              <div className="mt-4 space-y-4">
                {/* Property info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {lead.type && <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{lead.type}</span>}
                    {lead.property_condition && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{lead.property_condition}</span>}
                  </div>
                  {lead.price_range && <p className="text-sm text-secondary"><MaterialIcon icon="payments" className="text-[14px]" /> Value: {lead.price_range}</p>}
                </div>

                {/* Nearby Places */}
                <NearbyPlaces lead={lead} />

                {/* Market Comps */}
                <div>
                  <h4 className="font-headline text-sm font-bold mb-2">Market Comps</h4>
                  <MarketComps leadId={lead.id} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
