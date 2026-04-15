'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Lead, Activity, LeadStatus, CallOutcome } from '@/types';
import { cn, formatPhone } from '@/lib/utils';
import { LEAD_STATUSES } from '@/lib/constants';
import MaterialIcon from '@/components/ui/MaterialIcon';
import LeadMap from '@/components/leads/LeadMap';
import { usePhone } from '@/lib/phone-context';
import { useProfile } from '@/lib/profile-context';
import UpgradeGate from '@/components/ui/UpgradeGate';

const GROUPS = [
  'Appointment Set', 'BUYERS', 'Dead Lead', 'Future Follow Up',
  'Hot Lead', 'Not Yet Interested', 'Trash', 'Warm Lead',
];


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
  const { user } = useAuth();
  const { makeCall, isDesktop } = usePhone();
  const { profile } = useProfile();
  const [showGate, setShowGate] = useState(false);
  const isSubscribed = profile.subscriptionStatus === 'active';
  const [lead, setLead] = useState<Lead | null>(null);
  const [, setActivities] = useState<Activity[]>([]);
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


  // Call outcome
  const [savingOutcome, setSavingOutcome] = useState(false);
  // Skip trace lookup
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ hit: boolean; owner_name?: string; phones?: string[]; error?: string } | null>(null);

  const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const fetchData = useCallback(async () => {
    if (!params.id || !user) return;
    const [leadRes, activitiesRes] = await Promise.all([
      supabase.from('leads').select('*').eq('id', params.id).eq('user_id', user.id).single(),
      supabase.from('activities').select('*').eq('lead_id', params.id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (leadRes.error || !leadRes.data) { setNotFound(true); setLoading(false); return; }
    setLead(leadRes.data);
    setActivities(activitiesRes.data ?? []);
    setLoading(false);

    // Fetch prev/next for navigation scoped to current user
    const { data: allIds } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
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
        .eq('user_id', user.id)
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
  }, [params.id, user]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const refreshData = useCallback(() => { fetchData(); }, [fetchData]);

  // Keyboard navigation: left/right arrows for prev/next lead
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && adjacentIds.prev) router.push(`/leads/${adjacentIds.prev}`);
      if (e.key === 'ArrowRight' && adjacentIds.next) router.push(`/leads/${adjacentIds.next}`);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [adjacentIds, router]);

  const updateStatus = async (s: LeadStatus) => {
    if (!lead || !user?.id) return;
    const old = lead.status;
    await supabase.from('leads').update({ status: s }).eq('id', lead.id).eq('user_id', user.id);
    await supabase.from('activities').insert({ lead_id: lead.id, type: 'status_change', title: `Status: ${old} → ${s}` });
    setLead((prev) => (prev ? { ...prev, status: s } : null));
    refreshData();
  };

  const updateTags = async (tag: string) => {
    if (!lead || !user?.id) return;
    const current = lead.tags || [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    await supabase.from('leads').update({ tags: next }).eq('id', lead.id).eq('user_id', user.id);
    setLead((prev) => (prev ? { ...prev, tags: next } : null));
  };

  const logOutcome = async (outcome: CallOutcome) => {
    if (!lead || !user?.id) return;
    setSavingOutcome(true);
    const newStatus = OUTCOME_STATUS_MAP[outcome];
    if (newStatus) {
      await supabase.from('leads').update({ status: newStatus, last_contact_date: new Date().toISOString() }).eq('id', lead.id).eq('user_id', user.id);
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
        <MaterialIcon icon="person_off" className="text-[64px] text-on-surface-variant" />
        <h2 className="mt-4 text-2xl font-headline font-bold">Lead not found</h2>
        <Link href="/leads" className="mt-6 flex items-center gap-2 rounded-xl action-gradient px-4 py-2 text-sm font-medium text-white">
          <MaterialIcon icon="arrow_back" className="text-[18px]" /> Back to Leads
        </Link>
      </div>
    );
  }

  // Talking points derived from lead data
  function getTalkingPoints(lead: Lead): string[] {
    const points: string[] = [];
    if (lead.selling_date) {
      const years = Math.floor((Date.now() - new Date(lead.selling_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      if (years > 5) points.push(`Owned for ~${years} years`);
    }
    if (lead.selling_price) points.push(`Last sold for $${lead.selling_price.toLocaleString()}`);
    if (lead.listing_status === 'Sold' && lead.dom) points.push(`On market ${lead.dom} days`);
    if (lead.sqft) points.push(`${lead.sqft.toLocaleString()} sqft`);
    if (lead.lot_acres) points.push(`${lead.lot_acres} acre lot`);
    if (lead.year_built) points.push(`Built in ${lead.year_built}`);
    if (lead.price_range) points.push(`Value: ${lead.price_range}`);
    return points;
  }

  const mapUrl = getMapUrl();
  const talkingPoints = getTalkingPoints(lead);
  const priorityColor = lead.status === 'Not Contacted' ? 'bg-blue-500' : lead.tags?.includes('Hot Lead') ? 'bg-red-500' : lead.status === 'Follow-Up' ? 'bg-amber-500' : 'bg-secondary';

  return (
    <div className="min-h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex flex-col overflow-auto md:overflow-hidden bg-surface">
      {/* ═══ ACTION BAR ═══ */}
      <div className="h-12 bg-card border-b border-card-border flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/leads" className="flex items-center gap-1 px-2 py-1 text-secondary hover:text-white hover:bg-white/5 rounded text-xs font-bold transition-colors shrink-0">
            <MaterialIcon icon="arrow_back" className="text-[16px]" /> Back
          </Link>
          <div className="h-5 w-px bg-outline-variant shrink-0" />
          <h1 className="text-xs md:text-sm font-bold text-on-surface truncate">{lead.owner_name || lead.name || 'Unknown'}</h1>
          <span className="text-xs text-secondary truncate hidden md:inline">{lead.property_address}</span>
          <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold text-white shrink-0', priorityColor)}>
            {lead.status}
          </span>
          {siblingProperties.length > 0 && (
            <span className="text-[10px] font-bold text-violet-400 shrink-0">+{siblingProperties.length} props</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => adjacentIds.prev && router.push(`/leads/${adjacentIds.prev}`)}
            disabled={!adjacentIds.prev}
            className="p-1.5 text-secondary hover:text-white hover:bg-white/5 rounded transition-colors disabled:opacity-30"
            title="Previous lead (Left arrow)"
          >
            <MaterialIcon icon="chevron_left" className="text-[20px]" />
          </button>
          <button
            onClick={() => adjacentIds.next && router.push(`/leads/${adjacentIds.next}`)}
            disabled={!adjacentIds.next}
            className="p-1.5 text-secondary hover:text-white hover:bg-white/5 rounded transition-colors disabled:opacity-30"
            title="Next lead (Right arrow)"
          >
            <MaterialIcon icon="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* ═══ COCKPIT: LEFT + RIGHT ═══ */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* ─── LEFT PANEL: Street View ─── */}
        <div className="w-full md:w-3/5 h-56 md:h-auto relative flex flex-col bg-card border-b md:border-b-0 md:border-r border-card-border shrink-0 md:shrink">
          {/* View toggle buttons (top-left overlay) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 md:left-3 md:translate-x-0 z-10 flex gap-1">
            {(['Street View', 'Map', 'Satellite'] as const).map((view) => (
              <button
                key={view}
                onClick={() => setActiveTab(view)}
                className={cn(
                  'px-3 py-1.5 rounded text-[11px] font-bold transition-all backdrop-blur-md border',
                  activeTab === view
                    ? 'bg-primary text-white border-primary shadow-lg'
                    : 'bg-black/50 text-on-surface-variant border-card-border hover:bg-black/70 hover:text-white'
                )}
              >
                {view}
              </button>
            ))}
          </div>

          {/* Map / Street View content */}
          <div className="flex-1 relative">
            {!isSubscribed ? (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
                <div className="text-center">
                  <MaterialIcon icon="lock" className="text-[48px] text-primary mb-3" />
                  <h3 className="text-lg font-bold text-white mb-2">Street View Locked</h3>
                  <p className="text-sm text-secondary mb-4">Subscribe to see properties at street level</p>
                  <a href="/subscribe" className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors">Upgrade</a>
                </div>
              </div>
            ) : (activeTab === 'Map' || activeTab === 'Satellite') && lead.latitude != null && lead.longitude != null ? (
              <LeadMap
                lat={lead.latitude}
                lng={lead.longitude}
                mapType={activeTab === 'Satellite' ? 'satellite' : 'roadmap'}
              />
            ) : mapUrl ? (
              <iframe src={mapUrl} className="h-full w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-secondary">
                <div className="text-center">
                  <MaterialIcon icon="location_off" className="text-[48px] text-secondary" />
                  <p className="mt-2 text-sm">No location data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Property stats overlay (bottom) */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white font-bold text-sm">{lead.property_address?.split(',')[0]}</p>
                <p className="text-secondary text-xs">{lead.property_address?.split(',').slice(1).join(',').trim()}</p>
              </div>
              <div className="flex gap-4 text-right">
                {lead.property_condition && (
                  <div>
                    <p className="text-[10px] text-secondary uppercase tracking-widest">Type</p>
                    <p className="text-xs text-white font-bold">{lead.property_condition}</p>
                  </div>
                )}
                {lead.price_range && (
                  <div>
                    <p className="text-[10px] text-secondary uppercase tracking-widest">Value</p>
                    <p className="text-xs text-primary font-bold">{lead.price_range}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── RIGHT PANEL: Contact + Actions ─── */}
        <div className="w-full md:w-2/5 flex-1 bg-card flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-3">

            {/* Owner card */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                {(lead.owner_name || lead.name || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">{lead.owner_name || lead.name || 'Unknown'}</p>
                {lead.price_range && (
                  <p className="text-primary text-xs font-bold">{lead.price_range}</p>
                )}
              </div>
              <div className="ml-auto shrink-0">
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(e.target.value as LeadStatus)}
                  className="appearance-none bg-surface border border-outline-variant rounded px-2 py-1 text-[11px] font-medium text-on-surface-variant outline-none focus:ring-1 focus:ring-primary pr-6 cursor-pointer"
                >
                  {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Phone cards */}
            <div className="space-y-1.5">
              {[lead.phone, lead.phone_2, lead.phone_3].filter(Boolean).map((phone, idx) => (
                <div key={idx} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 border border-card-border">
                  <div className="flex items-center gap-2">
                    <MaterialIcon icon="phone" className="text-[14px] text-secondary" />
                    <span className="text-xs font-mono text-on-surface font-medium">{formatPhone(phone!)}</span>
                    {idx === 0 && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">PRIMARY</span>}
                  </div>
                  <button
                    onClick={() => {
                      if (isDesktop) { makeCall(phone!, lead.owner_name || lead.name || 'Unknown', lead.id); }
                      else { window.location.href = `tel:${phone}`; }
                    }}
                    className="flex items-center gap-1 px-3 py-1 bg-primary text-white rounded text-[11px] font-bold hover:bg-primary/90 transition-colors"
                  >
                    <MaterialIcon icon="call" className="text-[14px]" /> Call
                  </button>
                </div>
              ))}
              {!lead.phone && !lookupResult?.hit && (
                <button
                  onClick={async () => {
                    setLookupLoading(true);
                    setLookupResult(null);
                    try {
                      const addr = lead.property_address || '';
                      const res = await fetch('/api/skip-trace/lookup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          leadId: lead.id,
                          address: addr,
                          city: lead.city || addr.split(',')[1]?.trim() || '',
                          state: lead.state || 'CA',
                          zip: lead.zip || '',
                        }),
                      });
                      const data = await res.json();
                      if (data.error === 'limit_reached') {
                        setLookupResult({ hit: false, error: data.message || 'No skip traces remaining. Upgrade your plan.' });
                      } else if (data.hit) {
                        setLookupResult({ hit: true, owner_name: data.owner_name, phones: data.phones });
                        refreshData();
                      } else {
                        setLookupResult({ hit: false, error: 'No owner data found for this address' });
                      }
                    } catch {
                      setLookupResult({ hit: false, error: 'Lookup failed' });
                    }
                    setLookupLoading(false);
                  }}
                  disabled={lookupLoading}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 rounded-lg px-3 py-3 text-xs font-bold transition-all disabled:opacity-50"
                >
                  {lookupLoading ? (
                    <><span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> Looking up owner...</>
                  ) : (
                    <><MaterialIcon icon="person_search" className="text-[16px]" /> Get Owner Info — 1 credit</>
                  )}
                </button>
              )}
              {lookupResult && !lookupResult.hit && (
                <p className="text-xs text-red-500 text-center py-1">{lookupResult.error}</p>
              )}
              {lookupResult?.hit && (
                <div className="space-y-1.5">
                  {lookupResult.owner_name && (
                    <div className="bg-surface rounded-lg px-3 py-2 border border-card-border">
                      <span className="text-xs font-bold text-on-surface">{lookupResult.owner_name}</span>
                    </div>
                  )}
                  {lookupResult.phones?.map((phone, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <MaterialIcon icon="phone" className="text-[14px] text-emerald-500" />
                        <span className="text-xs font-mono text-on-surface font-medium">{formatPhone(phone)}</span>
                        {idx === 0 && <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                      </div>
                      <button
                        onClick={() => {
                          if (isDesktop) makeCall(phone, lookupResult.owner_name || 'Unknown', lead.id);
                          else window.location.href = `tel:${phone}`;
                        }}
                        className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold hover:bg-emerald-500 transition-colors"
                      >
                        <MaterialIcon icon="call" className="text-[14px]" /> Call
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Email card */}
            {lead.email && (
              <div className="flex items-center justify-between bg-surface rounded-lg px-3 py-2 border border-card-border">
                <div className="flex items-center gap-2 min-w-0">
                  <MaterialIcon icon="mail" className="text-[14px] text-secondary shrink-0" />
                  <span className="text-xs text-on-surface truncate">{lead.email}</span>
                </div>
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-1 px-3 py-1 bg-surface-container text-white rounded text-[11px] font-bold hover:bg-surface-container-high transition-colors shrink-0 ml-2"
                >
                  <MaterialIcon icon="send" className="text-[14px]" /> Send
                </a>
              </div>
            )}

            {/* Talking Points */}
            {talkingPoints.length > 0 && (
              <div className="bg-surface rounded-lg px-3 py-2.5 border border-card-border">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Talking Points</p>
                <div className="space-y-1">
                  {talkingPoints.map((pt, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <MaterialIcon icon="arrow_right" className="text-[14px] text-primary mt-0.5 shrink-0" />
                      <span className="text-xs text-on-surface-variant">{pt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Notes */}
            <div className="bg-surface rounded-lg px-3 py-2.5 border border-card-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Notes</p>
                <button onClick={saveNote} disabled={savingNote || !note.trim()}
                  className="text-[10px] text-primary font-bold hover:text-primary/80 disabled:opacity-30 transition-colors">
                  {savingNote ? 'Saving...' : 'Save'} (Ctrl+Enter)
                </button>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) saveNote(); }}
                rows={3}
                className="w-full p-2 bg-card border border-outline-variant rounded-lg text-xs text-on-surface font-medium focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-secondary"
                placeholder="Type notes during the call..."
              />
            </div>

            {/* Opening Script */}
            {profile.openingScript && (
              <details className="bg-surface rounded-lg border border-card-border group">
                <summary className="px-3 py-2.5 cursor-pointer flex items-center justify-between text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-secondary transition-colors">
                  <span>Opening Script</span>
                  <MaterialIcon icon="expand_more" className="text-[16px] text-secondary group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-3 pb-3">
                  <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                    {profile.openingScript
                      .replace('{name}', lead.owner_name || '')
                      .replace('{street}', lead.property_address?.split(',')[0] || '')
                      .replace('{value}', lead.price_range || '')}
                  </p>
                </div>
              </details>
            )}

            {/* Call Script Checklist */}
            {activeScript && (
              <details className="bg-surface rounded-lg border border-card-border group">
                <summary className="px-3 py-2.5 cursor-pointer flex items-center justify-between text-[10px] font-bold text-secondary uppercase tracking-widest hover:text-secondary transition-colors">
                  <span>Call Script: {activeScript.category.replace('_', ' ')}</span>
                  <MaterialIcon icon="expand_more" className="text-[16px] text-secondary group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  {scripts.length > 1 && (
                    <select
                      value={activeScript.id}
                      onChange={(e) => { const s = scripts.find(s => s.id === e.target.value); if (s) setActiveScript(s); }}
                      className="w-full text-xs rounded border border-outline-variant bg-card text-on-surface-variant px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {scripts.map(s => <option key={s.id} value={s.id}>{s.category.replace('_', ' ')}</option>)}
                    </select>
                  )}
                  {(activeScript.questions as ScriptQuestion[]).sort((a, b) => a.order - b.order).map((q) => (
                    <div key={q.question} className="flex items-start gap-2">
                      <MaterialIcon
                        icon={checklistAnswers[q.question] ? 'check_box' : 'check_box_outline_blank'}
                        className={cn('text-[18px] mt-0.5 cursor-pointer', checklistAnswers[q.question] ? 'text-emerald-500' : 'text-secondary')}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-on-surface-variant">{q.question}</p>
                        <input
                          type="text"
                          value={checklistAnswers[q.question] || ''}
                          onChange={(e) => setChecklistAnswers(prev => ({ ...prev, [q.question]: e.target.value }))}
                          placeholder="Answer..."
                          className="mt-1 w-full rounded border border-outline-variant bg-card px-2 py-1 text-xs text-on-surface placeholder:text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  ))}
                  {Object.values(checklistAnswers).some(v => v.trim()) && (
                    <button onClick={saveChecklistAnswers} disabled={savingChecklist}
                      className="w-full flex items-center justify-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                      <MaterialIcon icon="save" className="text-[14px]" /> {savingChecklist ? 'Saving...' : 'Save Answers'}
                    </button>
                  )}
                  {previousResponses.length > 0 && (
                    <div className="border-t border-outline-variant pt-2 mt-2">
                      <p className="text-[9px] uppercase tracking-widest text-secondary font-bold mb-1">Previous</p>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {previousResponses.slice(0, 10).map((r) => (
                          <div key={r.id} className="text-[11px]">
                            <span className="text-secondary">{r.question}: </span>
                            <span className="text-on-surface-variant font-medium">{r.answer}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Groups / Tags */}
            <div className="bg-surface rounded-lg px-3 py-2.5 border border-card-border">
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2">Groups</p>
              <div className="flex flex-wrap gap-1">
                {GROUPS.map((group) => (
                  <button
                    key={group}
                    onClick={() => updateTags(group)}
                    className={cn(
                      'px-2 py-0.5 rounded text-[10px] font-bold transition-all border',
                      lead.tags?.includes(group)
                        ? 'bg-primary/20 border-primary/50 text-primary'
                        : 'bg-transparent border-outline-variant text-secondary hover:border-outline-variant/80 hover:text-secondary'
                    )}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── STICKY BOTTOM: Call Outcome Buttons ─── */}
          <div className="p-3 border-t border-card-border bg-surface shrink-0">
            <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-2 text-center">Log Call Outcome</p>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { outcome: 'No Answer' as CallOutcome, icon: 'phone_missed', label: 'No Ans', color: 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-container/50 dark:text-on-surface-variant dark:hover:bg-surface-container' },
                { outcome: 'Left VM' as CallOutcome, icon: 'voicemail', label: 'Left VM', color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50' },
                { outcome: 'Spoke with Owner' as CallOutcome, icon: 'record_voice_over', label: 'Spoke', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50' },
                { outcome: 'Follow-Up' as CallOutcome, icon: 'event', label: 'Follow-Up', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50' },
                { outcome: 'Not Interested' as CallOutcome, icon: 'thumb_down', label: 'Not Int.', color: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50' },
                { outcome: 'DNC' as CallOutcome, icon: 'block', label: 'DNC', color: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50' },
              ]).map(({ outcome, icon, label, color }) => (
                <button
                  key={outcome}
                  onClick={() => logOutcome(outcome)}
                  disabled={savingOutcome}
                  className={cn(
                    'flex flex-col items-center justify-center py-3 md:py-2 px-1 rounded-lg text-[10px] font-bold transition-all border border-card-border disabled:opacity-50',
                    color
                  )}
                >
                  <MaterialIcon icon={icon} className="text-[16px] mb-0.5" />
                  {label}
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
