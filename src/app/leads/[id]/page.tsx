'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Lead, Activity, LeadStatus, CallOutcome } from '@/types';
import { cn, formatPhone } from '@/lib/utils';
import { LEAD_STATUSES } from '@/lib/constants';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ActivityTimeline from '@/components/leads/ActivityTimeline';
import FollowUpScheduler from '@/components/leads/FollowUpScheduler';
import EmailComposer from '@/components/leads/EmailComposer';
import MarketComps from '@/components/leads/MarketComps';
import NearbyPlaces from '@/components/leads/NearbyPlaces';
import LeadMap from '@/components/leads/LeadMap';
import { usePhone } from '@/lib/phone-context';
import { useProfile } from '@/lib/profile-context';
import UpgradeGate from '@/components/ui/UpgradeGate';

const GROUPS = [
  'Appointment Set', 'BUYERS', 'Dead Lead', 'Future Follow Up',
  'Hot Lead', 'Not Yet Interested', 'Trash', 'Warm Lead',
];

const TABS = [
  'Street View', 'Map', 'Satellite', 'Property', 'Activities',
  'Call Scripts', 'Emails', 'Comps', 'Nearby',
];

interface CallGuidance {
  opener: string;
  talking_points: string[];
  objection_responses: { objection: string; response: string }[];
}

interface ScriptQuestion { question: string; order: number }
interface CallScript { id: string; category: string; questions: ScriptQuestion[] }
interface CallResponse { id: string; question: string; answer: string; call_date: string }

const OUTCOME_STATUS_MAP: Partial<Record<CallOutcome, LeadStatus>> = {
  'No Answer': 'Called',
  'Left VM': 'Called',
  'Spoke with Owner': 'Interested',
  'Not Interested': 'Not Interested',
  'Follow-Up': 'Follow-Up',
  'DNC': 'Do Not Call',
};

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { makeCall, isDesktop } = usePhone();
  const { profile } = useProfile();
  const [showGate, setShowGate] = useState(false);
  const isSubscribed = profile.subscriptionStatus === 'active';
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [activeTab, setActiveTab] = useState('Street View');
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Prev/Next navigation
  const [adjacentIds, setAdjacentIds] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });

  // Siblings (same owner)
  const [siblingProperties, setSiblingProperties] = useState<Pick<Lead, 'id' | 'property_address' | 'city' | 'status' | 'price_range'>[]>([]);

  // Call scripts
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [activeScript, setActiveScript] = useState<CallScript | null>(null);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, string>>({});
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [previousResponses, setPreviousResponses] = useState<CallResponse[]>([]);

  // AI guidance
  const [guidance, setGuidance] = useState<CallGuidance | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);

  // Call outcome
  const [savingOutcome, setSavingOutcome] = useState(false);

  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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

    // Fetch prev/next for navigation
    const { data: allIds } = await supabase.from('leads').select('id').order('created_at', { ascending: false });
    if (allIds) {
      const idx = allIds.findIndex((l) => l.id === params.id);
      setAdjacentIds({
        prev: idx > 0 ? allIds[idx - 1].id : null,
        next: idx < allIds.length - 1 ? allIds[idx + 1].id : null,
      });
    }

    // Siblings
    const ownerName = leadRes.data.owner_name || leadRes.data.name;
    if (ownerName) {
      const { data: siblings } = await supabase
        .from('leads')
        .select('id, property_address, city, status, price_range')
        .eq('owner_name', ownerName)
        .neq('id', params.id)
        .limit(20);
      setSiblingProperties(siblings || []);
    }

    // Call scripts
    try {
      const scriptsRes = await fetch('/api/call-scripts');
      if (scriptsRes.ok) {
        const allScripts = await scriptsRes.json();
        setScripts(allScripts);
        const propType = leadRes.data.property_condition?.toLowerCase() || '';
        let category = 'general';
        if (propType.includes('multi-family') || propType.includes('apartment') || propType.includes('duplex') || propType.includes('triplex')) {
          category = 'residential';
        } else if (propType.includes('vacant') || propType.includes('land')) {
          category = 'commercial_vacant';
        } else if (propType.includes('commercial') || propType.includes('industrial')) {
          category = 'commercial_occupied';
        } else if (propType.includes('residential')) {
          category = 'residential';
        }
        setActiveScript(allScripts.find((s: CallScript) => s.category === category) || allScripts[0] || null);
      }
    } catch { /* non-fatal */ }

    // Previous call responses
    try {
      const rRes = await fetch(`/api/call-responses?leadId=${params.id}`);
      if (rRes.ok) setPreviousResponses(await rRes.json());
    } catch { /* non-fatal */ }
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const refreshData = useCallback(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (s: LeadStatus) => {
    if (!lead) return;
    const old = lead.status;
    await supabase.from('leads').update({ status: s }).eq('id', lead.id);
    await supabase.from('activities').insert({ lead_id: lead.id, type: 'status_change', title: `Status: ${old} → ${s}` });
    setLead((prev) => (prev ? { ...prev, status: s } : null));
    refreshData();
  };

  const updateTags = async (tag: string) => {
    if (!lead) return;
    const current = lead.tags || [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    await supabase.from('leads').update({ tags: next }).eq('id', lead.id);
    setLead((prev) => (prev ? { ...prev, tags: next } : null));
  };

  const logOutcome = async (outcome: CallOutcome) => {
    if (!lead) return;
    setSavingOutcome(true);
    const newStatus = OUTCOME_STATUS_MAP[outcome];
    if (newStatus) {
      await supabase.from('leads').update({ status: newStatus, last_contact_date: new Date().toISOString() }).eq('id', lead.id);
    }
    await supabase.from('activities').insert({
      lead_id: lead.id,
      type: 'call',
      title: `Call: ${outcome}`,
      outcome,
      description: note || undefined,
    });
    if (newStatus) setLead((prev) => (prev ? { ...prev, status: newStatus } : null));
    setNote('');
    setSavingOutcome(false);
    refreshData();
  };

  const saveNote = async () => {
    if (!lead || !note.trim()) return;
    setSavingNote(true);
    await supabase.from('activities').insert({ lead_id: lead.id, type: 'note', title: 'Note', description: note.trim() });
    setNote('');
    setSavingNote(false);
    refreshData();
  };

  const saveChecklistAnswers = async () => {
    if (!lead || !activeScript) return;
    setSavingChecklist(true);
    const responses = Object.entries(checklistAnswers).map(([question, answer]) => ({ question, answer }));
    await fetch('/api/call-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id, scriptId: activeScript.id, responses }),
    });
    setChecklistAnswers({});
    setSavingChecklist(false);
    const rRes = await fetch(`/api/call-responses?leadId=${lead.id}`);
    if (rRes.ok) setPreviousResponses(await rRes.json());
  };

  const fetchGuidance = async () => {
    if (!lead) return;
    if (!isSubscribed) { setShowGate(true); return; }
    setGuidanceLoading(true);
    try {
      const res = await fetch('/api/ai/call-guidance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id }) });
      if (res.ok) setGuidance(await res.json());
    } finally { setGuidanceLoading(false); }
  };

  // Map URL builder
  const getMapUrl = () => {
    if (!lead) return '';
    const hasCoords = lead.latitude != null && lead.longitude != null;
    const addr = encodeURIComponent(lead.property_address || '');
    switch (activeTab) {
      case 'Street View':
        return hasCoords
          ? `https://www.google.com/maps/embed/v1/streetview?location=${lead.latitude},${lead.longitude}&key=${API_KEY}&heading=0&pitch=0&fov=90`
          : addr ? `https://www.google.com/maps/embed/v1/streetview?location=${addr}&key=${API_KEY}&heading=0&pitch=0&fov=90` : '';
      case 'Map':
        return hasCoords
          ? `https://www.google.com/maps/embed/v1/place?q=${lead.latitude},${lead.longitude}&key=${API_KEY}&zoom=17`
          : `https://www.google.com/maps/embed/v1/place?q=${addr}&key=${API_KEY}&zoom=17`;
      case 'Satellite':
        return hasCoords
          ? `https://www.google.com/maps/embed/v1/view?center=${lead.latitude},${lead.longitude}&key=${API_KEY}&zoom=19&maptype=satellite`
          : addr ? `https://www.google.com/maps/embed/v1/place?q=${addr}&key=${API_KEY}&zoom=19&maptype=satellite` : '';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !lead) {
    return (
      <div className="flex flex-col items-center justify-center p-16">
        <MaterialIcon icon="person_off" className="text-[64px] text-slate-300" />
        <h2 className="mt-4 text-2xl font-headline font-bold">Lead not found</h2>
        <Link href="/leads" className="mt-6 flex items-center gap-2 rounded-xl action-gradient px-4 py-2 text-sm font-medium text-white">
          <MaterialIcon icon="arrow_back" className="text-[18px]" /> Back to Leads
        </Link>
      </div>
    );
  }

  const mapUrl = getMapUrl();

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      {/* ═══ TOP ACTION BAR ═══ */}
      <div className="h-11 border-b border-gray-100 flex items-center justify-between px-4 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Link href="/leads" className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:bg-gray-100 rounded text-xs font-bold transition-colors">
            <MaterialIcon icon="arrow_back" className="text-[16px]" /> Back
          </Link>
          <div className="h-4 w-px bg-gray-200 mx-1" />
          <button className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors">
            Actions <MaterialIcon icon="expand_more" className="text-[14px]" />
          </button>
          <div className="h-4 w-px bg-gray-200 mx-1" />
          <button className="flex items-center gap-1 px-2 py-1 text-orange-600 font-bold text-xs hover:bg-orange-50 rounded transition-colors">
            <MaterialIcon icon="add" className="text-[16px]" /> Appointment
          </button>
          <button className="flex items-center gap-1 px-2 py-1 text-blue-500 font-bold text-xs hover:bg-blue-50 rounded transition-colors">
            <MaterialIcon icon="add" className="text-[16px]" /> Task
          </button>
          <button className="flex items-center gap-1 px-2 py-1 text-violet-600 font-bold text-xs hover:bg-violet-50 rounded transition-colors">
            <MaterialIcon icon="schedule" className="text-[16px]" /> Follow-Up
          </button>
          <div className="h-4 w-px bg-gray-200 mx-2" />
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(lead.property_address || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 text-xs font-bold text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <MaterialIcon icon="map" className="text-[16px]" /> Google Maps
          </a>
          <a
            href={`https://www.zillow.com/homes/${encodeURIComponent(lead.property_address || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50 rounded transition-colors italic"
          >
            Zillow
          </a>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => adjacentIds.prev && router.push(`/leads/${adjacentIds.prev}`)}
            disabled={!adjacentIds.prev}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
          >
            <MaterialIcon icon="chevron_left" className="text-[18px]" />
          </button>
          <button
            onClick={() => adjacentIds.next && router.push(`/leads/${adjacentIds.next}`)}
            disabled={!adjacentIds.next}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30"
          >
            <MaterialIcon icon="chevron_right" className="text-[18px]" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT: Info + Tabs + Content ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Owner / Contact Header */}
          <div className="px-6 py-3 border-b border-gray-50 flex items-start justify-between bg-gray-50/30 shrink-0">
            <div className="flex gap-8">
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">{lead.owner_name || lead.name || 'Unknown'}</h1>
                {lead.name && lead.owner_name && lead.name !== lead.owner_name && (
                  <p className="text-xs text-gray-500 font-medium">{lead.name}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-gray-600">
                  <MaterialIcon icon="location_on" className="text-[14px] text-gray-400" />
                  <span className="text-xs font-medium">{lead.property_address}</span>
                </div>
                {lead.mailing_address && (
                  <div className="flex items-center gap-2 mt-0.5 text-gray-500">
                    <MaterialIcon icon="markunread_mailbox" className="text-[14px] text-gray-400" />
                    <span className="text-[11px]">{lead.mailing_address}, {[lead.mailing_city, lead.mailing_state].filter(Boolean).join(', ')} {lead.mailing_zip}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-8">
                {/* Phones */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phones</p>
                  <div className="space-y-1">
                    {[lead.phone, lead.phone_2, lead.phone_3].filter(Boolean).map((phone, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button onClick={() => {
                          if (isDesktop) { makeCall(phone!, lead.owner_name || lead.name || 'Unknown', lead.id); }
                          else { window.location.href = `tel:${phone}`; }
                        }} className="text-xs font-bold text-emerald-600 font-mono hover:underline cursor-pointer">{formatPhone(phone!)}</button>
                        <MaterialIcon icon="call" className="text-[14px] text-green-600 cursor-pointer hover:scale-110 transition-transform" />
                      </div>
                    ))}
                    {!lead.phone && <span className="text-xs text-gray-400 italic">None</span>}
                  </div>
                </div>
                {/* Emails */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">E-mails</p>
                  <div className="space-y-1">
                    {lead.email ? (
                      <div className="flex items-center gap-2">
                        <a href={`mailto:${lead.email}`} className="text-xs font-medium text-blue-600 truncate max-w-[160px] hover:underline">{lead.email}</a>
                        <MaterialIcon icon="mail" className="text-[14px] text-blue-400" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">None</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</p>
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(e.target.value as LeadStatus)}
                  className="appearance-none bg-white border border-gray-200 rounded px-2 py-1 text-[11px] font-medium outline-none focus:ring-1 focus:ring-blue-500 pr-6"
                >
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Source</p>
                <span className="text-[11px] font-medium text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 inline-block">
                  {lead.source || 'Unknown'}
                </span>
              </div>
              {lead.price_range && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Est. Value</p>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 inline-block">
                    {lead.price_range}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Groups / Tags Row */}
          <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-2 overflow-x-auto bg-white shrink-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1 shrink-0">Groups:</span>
            {GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => updateTags(group)}
                className={cn(
                  'px-2 py-1 rounded border text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1 shrink-0',
                  lead.tags?.includes(group)
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                )}
              >
                {group === 'Hot Lead' && <MaterialIcon icon="star" className="text-[12px] text-yellow-500" />}
                {group}
              </button>
            ))}
            {/* Other properties by owner */}
            {siblingProperties.length > 0 && (
              <>
                <div className="h-4 w-px bg-gray-200 mx-2 shrink-0" />
                <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest shrink-0">
                  +{siblingProperties.length} properties
                </span>
                {siblingProperties.slice(0, 3).map((s) => (
                  <Link
                    key={s.id}
                    href={`/leads/${s.id}`}
                    className="px-2 py-1 rounded border border-violet-200 bg-violet-50 text-[10px] font-bold text-violet-700 hover:bg-violet-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    {s.property_address?.split(',')[0]}
                  </Link>
                ))}
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="px-6 py-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto bg-white shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded text-[11px] font-bold whitespace-nowrap transition-all',
                  activeTab === tab
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {/* Street View — iframe */}
            {activeTab === 'Street View' && (
              <div className="h-full relative bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-inner">
                {mapUrl ? (
                  <iframe src={mapUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <div className="text-center">
                      <MaterialIcon icon="location_off" className="text-[48px] text-gray-300" />
                      <p className="mt-2 text-sm">No location data available</p>
                    </div>
                  </div>
                )}
                {mapUrl && (
                  <div className="absolute top-3 left-3 bg-black/70 text-white p-2.5 rounded shadow-xl backdrop-blur-md border border-white/10 max-w-[240px]">
                    <div className="flex items-start gap-2">
                      <MaterialIcon icon="location_on" className="text-[14px] mt-0.5 text-blue-400 shrink-0" />
                      <div>
                        <p className="text-xs font-bold leading-tight">{lead.property_address?.split(',')[0]}</p>
                        <p className="text-[9px] opacity-70 mt-0.5">{lead.property_address?.split(',').slice(1).join(',')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Map / Satellite / Hybrid — interactive 3D with right-click tilt */}
            {(activeTab === 'Map' || activeTab === 'Satellite') && (
              <div className="h-full relative rounded-xl overflow-hidden border border-gray-200 shadow-inner">
                {lead.latitude != null && lead.longitude != null ? (
                  <LeadMap
                    lat={lead.latitude}
                    lng={lead.longitude}
                    mapType={activeTab === 'Satellite' ? 'satellite' : 'roadmap'}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-400 bg-gray-100">
                    <div className="text-center">
                      <MaterialIcon icon="location_off" className="text-[48px] text-gray-300" />
                      <p className="mt-2 text-sm">No coordinates — right-click drag to tilt when geocoded</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Property' && (
              <div className="space-y-4 max-w-3xl">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Property Type', value: lead.property_condition },
                    { label: 'Est. Value', value: lead.price_range },
                    { label: 'City', value: lead.city },
                    { label: 'State', value: lead.state },
                    { label: 'Zip', value: lead.zip },
                    { label: 'Source', value: lead.source },
                  ].filter(r => r.value).map((r) => (
                    <div key={r.label} className="rounded-xl border border-gray-200 p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{r.label}</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{r.value}</p>
                    </div>
                  ))}
                </div>
                {lead.notes && (
                  <div className="rounded-xl border border-gray-200 p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Import Notes</p>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Activities' && (
              <div className="max-w-3xl">
                <ActivityTimeline activities={activities} />
              </div>
            )}

            {activeTab === 'Call Scripts' && activeScript && (
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <select
                    value={activeScript.id}
                    onChange={(e) => { const s = scripts.find(s => s.id === e.target.value); if (s) setActiveScript(s); }}
                    className="text-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {scripts.map(s => <option key={s.id} value={s.id}>{s.category.replace('_', ' ')}</option>)}
                  </select>
                  <button
                    onClick={fetchGuidance}
                    disabled={guidanceLoading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    <MaterialIcon icon="auto_awesome" className="text-[14px]" />
                    {guidanceLoading ? 'Generating...' : 'AI Follow-Up'}
                  </button>
                </div>

                {/* AI Guidance */}
                {guidance && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                    <div className="rounded-lg bg-white p-3">
                      <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold mb-1">Opener</p>
                      <p className="text-sm text-gray-800">{guidance.opener}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Talking Points</p>
                      <ul className="space-y-1">
                        {guidance.talking_points.map((pt, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs"><MaterialIcon icon="check_circle" className="mt-0.5 text-[14px] text-emerald-500" />{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Checklist */}
                <div className="space-y-3">
                  {(activeScript.questions as ScriptQuestion[]).sort((a, b) => a.order - b.order).map((q) => (
                    <div key={q.question} className="flex items-start gap-3">
                      <MaterialIcon
                        icon={checklistAnswers[q.question] ? 'check_box' : 'check_box_outline_blank'}
                        className={cn('text-[20px] mt-1', checklistAnswers[q.question] ? 'text-emerald-500' : 'text-gray-400')}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{q.question}</p>
                        <input
                          type="text"
                          value={checklistAnswers[q.question] || ''}
                          onChange={(e) => setChecklistAnswers(prev => ({ ...prev, [q.question]: e.target.value }))}
                          placeholder="Record answer..."
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {Object.values(checklistAnswers).some(v => v.trim()) && (
                  <button onClick={saveChecklistAnswers} disabled={savingChecklist}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50">
                    <MaterialIcon icon="save" className="text-[16px]" /> {savingChecklist ? 'Saving...' : 'Save Answers'}
                  </button>
                )}
                {previousResponses.length > 0 && (
                  <div className="border-t border-gray-200 pt-3">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Previous Responses</p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {previousResponses.slice(0, 15).map((r) => (
                        <div key={r.id} className="flex items-start gap-2 text-xs">
                          <MaterialIcon icon="chat_bubble_outline" className="text-[14px] text-gray-400 mt-0.5" />
                          <div><p className="text-gray-500">{r.question}</p><p className="font-medium text-gray-800">{r.answer}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Emails' && (
              <div className="max-w-3xl">
                <EmailComposer lead={lead} onEmailSent={refreshData} />
              </div>
            )}

            {activeTab === 'Comps' && (
              <div className="max-w-3xl">
                <MarketComps leadId={lead.id} />
              </div>
            )}

            {activeTab === 'Nearby' && (
              <div className="max-w-3xl">
                <NearbyPlaces lead={lead} />
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR: Notes + Call Outcome ─── */}
        <div className="w-72 border-l border-gray-100 bg-white flex flex-col shrink-0">
          <div className="p-4 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Notes</h3>
              <button onClick={saveNote} disabled={savingNote || !note.trim()}
                className="text-[10px] text-blue-600 font-bold hover:underline disabled:opacity-40">
                Save Note
              </button>
            </div>
            <div className="relative flex-1 flex flex-col">
              <MaterialIcon icon="chat" className="absolute left-3 top-3 text-[14px] text-gray-300" />
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) saveNote(); }}
                className="w-full flex-1 p-3 pl-9 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-gray-50/50"
                placeholder="Type Note Here..."
              />
            </div>

            {/* Follow-Up Quick Scheduler */}
            <div className="mt-3">
              <FollowUpScheduler lead={lead} onScheduled={refreshData} />
            </div>
          </div>

          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Call Outcome</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { outcome: 'No Answer' as CallOutcome, icon: 'phone_missed', label: 'No Answer' },
                { outcome: 'Left VM' as CallOutcome, icon: 'voicemail', label: 'Left VM' },
                { outcome: 'Spoke with Owner' as CallOutcome, icon: 'record_voice_over', label: 'Spoke' },
                { outcome: 'Follow-Up' as CallOutcome, icon: 'event', label: 'Follow-Up' },
                { outcome: 'Not Interested' as CallOutcome, icon: 'thumb_down', label: 'Not Int.' },
                { outcome: 'DNC' as CallOutcome, icon: 'block', label: 'DNC' },
              ]).map(({ outcome, icon, label }) => (
                <button
                  key={outcome}
                  onClick={() => logOutcome(outcome)}
                  disabled={savingOutcome}
                  className="flex items-center justify-center gap-1.5 py-2 px-2 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm disabled:opacity-50"
                >
                  <MaterialIcon icon={icon} className="text-[14px]" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <UpgradeGate feature="ai" show={showGate} onClose={() => setShowGate(false)} />
    </div>
  );
}
