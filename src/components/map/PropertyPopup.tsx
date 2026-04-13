"use client";

import { useState } from "react";
import Link from "next/link";
import { Lead, CallOutcome, LeadStatus } from "@/types";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { cn, formatPhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/profile-context";
import { useAuth } from "@/lib/auth-context";
import { usePhone } from "@/lib/phone-context";
import UpgradeGate from "@/components/ui/UpgradeGate";

interface Props {
  lead: Lead;
  onUpdate?: () => void;
  walkMode?: boolean;
  onWalkHere?: (lead: Lead) => void;
  onToggleProspectMode?: () => void;
  prospectMode?: boolean;
}

const OUTCOME_STATUS: Partial<Record<CallOutcome, LeadStatus>> = {
  'No Answer': 'Called',
  'Left VM': 'Called',
  'Spoke with Owner': 'Interested',
  'Not Interested': 'Not Interested',
  'Follow-Up': 'Follow-Up',
  'DNC': 'Do Not Call',
};

function fillScript(template: string, lead: Lead): string {
  const name = lead.owner_name || lead.name || 'there';
  const firstName = name.split(' ')[0];
  const street = lead.property_address?.split(',')[0] || 'your street';
  const value = lead.selling_price
    ? `$${lead.selling_price.toLocaleString()}`
    : lead.price_range || '$XXX,XXX';
  return template
    .replace(/\{name\}/g, firstName)
    .replace(/\{street\}/g, street)
    .replace(/\{value\}/g, value);
}

// Generate talking points for reference properties — focused on how this helps nearby calls
function generateTalkingPoints(lead: Lead): string[] {
  const points: string[] = [];

  if (lead.listing_status === 'Sold') {
    if (lead.listing_price && lead.selling_price && lead.selling_price > 0) {
      const diff = lead.selling_price - lead.listing_price;
      if (diff > 0) points.push(`Sold $${diff.toLocaleString()} OVER asking — competitive market`);
      else if (diff < 0) points.push(`Sold $${Math.abs(diff).toLocaleString()} below asking`);
      else points.push(`Sold at full asking price — strong demand`);
    }
    if (lead.dom != null) {
      if (lead.dom <= 7) points.push(`Only ${lead.dom} days on market — extremely fast sale`);
      else if (lead.dom <= 30) points.push(`${lead.dom} days on market — quick sale`);
      else if (lead.dom <= 90) points.push(`${lead.dom} days on market — normal pace`);
      else points.push(`${lead.dom} DOM — sat a while, possibly overpriced initially`);
    }
    if (lead.selling_price && lead.sqft && lead.sqft > 0) {
      points.push(`$${Math.round(lead.selling_price / lead.sqft)}/sqft — use as comp for neighbors`);
    }
    if (lead.selling_date) {
      const days = Math.floor((Date.now() - new Date(lead.selling_date + 'T00:00:00').getTime()) / 86400000);
      if (days <= 30) points.push(`Sold ${days} days ago — very fresh comp`);
      else if (days <= 90) points.push(`Sold ${Math.round(days / 7)} weeks ago — recent comp`);
      else if (days <= 180) points.push(`Sold ${Math.round(days / 30)} months ago — still relevant`);
    }
  }

  if (lead.listing_status === 'Active') {
    if (lead.listing_price) points.push(`Asking $${lead.listing_price.toLocaleString()}`);
    if (lead.dom != null) {
      if (lead.dom > 60) points.push(`${lead.dom} DOM — sitting, price may be high`);
      else if (lead.dom > 30) points.push(`${lead.dom} DOM — moderate time on market`);
      else points.push(`${lead.dom} DOM — freshly listed`);
    }
    if (lead.listing_price && lead.sqft && lead.sqft > 0) {
      points.push(`Asking $${Math.round(lead.listing_price / lead.sqft)}/sqft`);
    }
  }

  if (lead.listing_status === 'Pending') {
    if (lead.listing_price) points.push(`Listed at $${lead.listing_price.toLocaleString()} — now under contract`);
    if (lead.dom != null) points.push(`Went pending after ${lead.dom} days`);
  }

  return points;
}

// Generate "how this relates to neighbors" insights
function generateNeighborContext(lead: Lead): string[] {
  const insights: string[] = [];

  if (lead.listing_status === 'Sold') {
    if (lead.dom != null && lead.dom <= 14) insights.push(`Fast-sale signal for neighbors — "your area is moving"`);
    if (lead.selling_price && lead.sqft && lead.sqft > 0) {
      const ppsf = Math.round(lead.selling_price / lead.sqft);
      insights.push(`$${ppsf}/sqft sets the comp for this street`);
    }
    if (lead.selling_date) {
      const days = Math.floor((Date.now() - new Date(lead.selling_date + 'T00:00:00').getTime()) / 86400000);
      if (days <= 30) insights.push(`Very recent sale — strong "your neighbor just sold" opener`);
    }
  }

  if (lead.listing_status === 'Active') {
    insights.push(`Active listing nearby — creates urgency for neighbors`);
    if (lead.dom != null && lead.dom > 30) insights.push(`Sitting on market — possible price reduction coming`);
  }

  if (lead.listing_status === 'Pending') {
    insights.push(`Under contract — shows buyer demand on this street`);
  }

  return insights;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PropertyPopup({ lead, onUpdate, walkMode = false, onWalkHere, onToggleProspectMode, prospectMode }: Props) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { makeCall, isDesktop } = usePhone();
  const [note, setNote] = useState('');
  const [, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outcomeLogged, setOutcomeLogged] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [editingScript, setEditingScript] = useState(false);
  const [localScript, setLocalScript] = useState('');
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const [contextPaste, setContextPaste] = useState('');
  const [contextSaved, setContextSaved] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ hit: boolean; owner_name?: string; phones?: string[]; error?: string } | null>(null);

  const isFree = profile.subscriptionStatus !== 'active';

  // Determine card type: reference property vs callable lead
  const isReference = !!lead.listing_status;
  const phones = [lead.phone, lead.phone_2, lead.phone_3].filter(Boolean) as string[];
  const isCallable = phones.length > 0;
  const isSold = lead.listing_status === 'Sold';
  const isActive = lead.listing_status === 'Active';
  const isPending = lead.listing_status === 'Pending';

  const talkingPoints = isReference ? generateTalkingPoints(lead) : [];
  const neighborContext = isReference ? generateNeighborContext(lead) : [];

  const statusColor = isSold ? 'text-yellow-400' : isActive ? 'text-green-400' : isPending ? 'text-purple-400' : 'text-on-surface-variant';
  const statusText = isSold ? 'Sold' : isActive ? 'Active' : isPending ? 'Pending' : '';
  const price = lead.selling_price || lead.listing_price;
  const priceStr = price ? `$${price.toLocaleString()}` : '';
  const ppsf = (lead.selling_price || lead.listing_price) && lead.sqft && lead.sqft > 0
    ? `$${Math.round((lead.selling_price || lead.listing_price || 0) / lead.sqft)}/sqft`
    : '';

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'note', title: 'Note (from map)', description: note.trim(),
    });
    setNote(''); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onUpdate?.();
  }

  async function saveContext() {
    if (!contextPaste.trim()) return;
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'note', title: 'Market Context', description: contextPaste.trim(),
    });
    setContextPaste(''); setContextSaved(true);
    setTimeout(() => setContextSaved(false), 2000);
    onUpdate?.();
  }

  async function logOutcome(outcome: CallOutcome) {
    const newStatus = OUTCOME_STATUS[outcome];
    if (newStatus) {
      await supabase.from('leads').update({
        status: newStatus, last_contact_date: new Date().toISOString(),
      }).eq('id', lead.id).eq('user_id', user!.id);
    }
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'call', title: `Call: ${outcome}`, outcome, description: note || undefined,
    });
    setOutcomeLogged(outcome); setNote('');
    onUpdate?.();
  }

  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden", walkMode ? "min-w-[280px] max-w-[320px]" : "w-full")}>
      <div className="px-5 pt-4 pb-3 space-y-3">
        {/* ── ADDRESS + ACTION PILLS ── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-extrabold tracking-tight text-on-surface leading-tight">
              {lead.property_address?.split(',')[0] || 'No address'}
            </h2>
            <p className="text-xs text-on-surface-variant font-medium">
              {lead.property_address?.split(',').slice(1).join(',').trim() || ''}
            </p>
            {!isReference && (lead.owner_name || lead.name) && (
              <p className="text-xs text-on-surface-variant mt-0.5">{lead.owner_name || lead.name}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!walkMode && isReference && lead.latitude != null && lead.longitude != null && onToggleProspectMode && (
              <button
                onClick={onToggleProspectMode}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  prospectMode ? 'bg-primary text-white border-primary' : 'bg-surface-container-high border-card-border text-primary hover:bg-primary hover:text-white'
                }`}
              >
                <MaterialIcon icon="ads_click" className="text-[14px]" />
                {prospectMode ? 'Selecting...' : 'Select Prospects'}
              </button>
            )}
            {!walkMode && onWalkHere && lead.latitude != null && lead.longitude != null && (
              <button onClick={() => onWalkHere(lead)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-surface-container-high border border-card-border text-xs font-medium text-primary hover:bg-primary hover:text-white transition-all">
                <MaterialIcon icon="directions_walk" className="text-[14px]" />
                Walk
              </button>
            )}
          </div>
        </div>


        {/* ════════════════════════════════════════════════════════ */}
        {/* REFERENCE PROPERTY CARD — market context, not call workflow */}
        {/* ════════════════════════════════════════════════════════ */}
        {isReference && (
          <>
            {/* Snapshot: price + status + DOM */}
            <div className={cn("flex items-center gap-2 flex-wrap", isFree && "relative")}>
              <div className={cn(isFree && "blur-sm select-none", "flex items-center gap-2 flex-wrap")}>
                {priceStr && <span className="font-bold text-on-surface">{priceStr}</span>}
                {statusText && <span className={`font-semibold text-sm ${statusColor}`}>{statusText}</span>}
                {ppsf && <span className="text-xs text-on-surface-variant">{ppsf}</span>}
              </div>
              {isFree && (
                <button onClick={() => setUpgradeFeature('marketData')} className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary bg-card/80 px-2 py-0.5 rounded-full border border-primary/30">Upgrade to see</span>
                </button>
              )}
            </div>

            {/* Key dates + facts grid */}
            <div className={cn(isFree && "blur-sm select-none")}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                {lead.sqft && <div className="flex justify-between"><span className="text-on-surface-variant">Sqft</span><span className="text-on-surface font-medium">{lead.sqft.toLocaleString()}</span></div>}
                {lead.year_built && <div className="flex justify-between"><span className="text-on-surface-variant">Built</span><span className="text-on-surface font-medium">{lead.year_built}</span></div>}
                {lead.lot_acres && <div className="flex justify-between"><span className="text-on-surface-variant">Lot</span><span className="text-on-surface font-medium">{lead.lot_acres} ac</span></div>}
                {lead.dom != null && <div className="flex justify-between"><span className="text-on-surface-variant">DOM</span><span className="text-on-surface font-medium">{lead.dom} days</span></div>}
                {lead.listing_date && <div className="flex justify-between"><span className="text-on-surface-variant">Listed</span><span className="text-on-surface font-medium">{formatDate(lead.listing_date)}</span></div>}
                {lead.pending_date && <div className="flex justify-between"><span className="text-on-surface-variant">Pending</span><span className="text-on-surface font-medium">{formatDate(lead.pending_date)}</span></div>}
                {lead.selling_date && <div className="flex justify-between"><span className="text-on-surface-variant">Sold</span><span className="text-on-surface font-medium">{formatDate(lead.selling_date)}</span></div>}
              </div>
            </div>

            {/* Talking points — what happened here */}
            {talkingPoints.length > 0 && (
              <div className={cn("py-2 border-t border-card-border/50", isFree && "blur-sm select-none")}>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">What happened</p>
                {talkingPoints.map((pt, i) => (
                  <p key={i} className="text-xs text-on-surface-variant leading-relaxed">
                    <span className="text-primary mr-1">·</span>{pt}
                  </p>
                ))}
              </div>
            )}

            {/* Neighbor context — how to use this in calls */}
            {neighborContext.length > 0 && (
              <div className={cn("py-2 border-t border-card-border/50", isFree && "blur-sm select-none")}>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Use in nearby calls</p>
                {neighborContext.map((pt, i) => (
                  <p key={i} className="text-xs text-on-surface-variant leading-relaxed">
                    <span className="text-emerald-400 mr-1">→</span>{pt}
                  </p>
                ))}
              </div>
            )}

            {/* Add context — paste box for admin/users to add market data */}
            <div className="pt-2 border-t border-card-border/50">
              <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Add Market Context</p>
              <div className="relative">
                <textarea
                  value={contextPaste}
                  onChange={(e) => setContextPaste(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs text-on-surface focus:ring-1 focus:ring-primary outline-none resize-none placeholder:text-on-surface-variant/40"
                  placeholder="Paste MLS remarks, agent notes, concessions..."
                />
                {contextPaste.trim() && (
                  <button onClick={saveContext}
                    className="absolute right-2 bottom-2 text-[10px] font-bold text-primary hover:underline">
                    Save
                  </button>
                )}
                {contextSaved && <span className="absolute right-2 bottom-2 text-[10px] text-emerald-500 font-bold">Saved</span>}
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/* LEAD / PROSPECT CARD — call workflow */}
        {/* ════════════════════════════════════════════════════════ */}
        {!isReference && (
          <>
            {/* Owner name if present */}
            {(lead.owner_name || lead.name) && (
              <p className="text-sm font-semibold text-on-surface">{lead.owner_name || lead.name}</p>
            )}

            {/* Phone numbers + call buttons */}
            {isCallable && (
              <div className="flex flex-wrap gap-2">
                {phones.map((phone, idx) => (
                  <button key={idx}
                    onClick={() => {
                      if (isFree) { setUpgradeFeature('dialer'); return; }
                      if (isDesktop) makeCall(phone, lead.owner_name || lead.name || 'Unknown', lead.id);
                      else window.location.href = `tel:${phone}`;
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:underline">
                    <MaterialIcon icon="call" className="text-[12px]" />
                    {formatPhone(phone)}
                  </button>
                ))}
              </div>
            )}

            {/* Get Owner Info — skip trace lookup for leads without phone */}
            {!isCallable && !isReference && !lookupResult && (
              <button
                onClick={async () => {
                  if (isFree) { setUpgradeFeature('dialer'); return; }
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
                    if (data.error === 'insufficient_balance') {
                      setLookupResult({ hit: false, error: 'Add funds to your wallet first' });
                    } else if (data.hit) {
                      setLookupResult({ hit: true, owner_name: data.owner_name, phones: data.phones });
                      onUpdate?.(); // refresh lead data
                    } else {
                      setLookupResult({ hit: false, error: 'No owner data found' });
                    }
                  } catch {
                    setLookupResult({ hit: false, error: 'Lookup failed' });
                  }
                  setLookupLoading(false);
                }}
                disabled={lookupLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-all disabled:opacity-50"
              >
                {lookupLoading ? (
                  <><span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" /> Looking up owner...</>
                ) : (
                  <><MaterialIcon icon="person_search" className="text-[14px]" /> Get Owner Info — $0.50</>
                )}
              </button>
            )}
            {lookupResult && !lookupResult.hit && (
              <p className="text-xs text-red-400">{lookupResult.error || 'No data found'}</p>
            )}
            {lookupResult?.hit && (
              <div className="text-xs space-y-1">
                {lookupResult.owner_name && <p className="font-semibold text-on-surface">{lookupResult.owner_name}</p>}
                {lookupResult.phones?.map((p, i) => (
                  <button key={i}
                    onClick={() => {
                      if (isDesktop) makeCall(p, lookupResult.owner_name || 'Unknown', lead.id);
                      else window.location.href = `tel:${p}`;
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:underline">
                    <MaterialIcon icon="call" className="text-[12px]" />
                    {formatPhone(p)}
                  </button>
                ))}
              </div>
            )}

            {/* Script (collapsed by default) */}
            {profile.openingScript && isCallable && (
              <div>
                <button onClick={() => setScriptOpen(!scriptOpen)}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary/80">
                  <MaterialIcon icon={scriptOpen ? 'expand_less' : 'expand_more'} className="text-[14px]" />
                  Script
                </button>
                {scriptOpen && (
                  <div className="mt-1 rounded-lg bg-surface-container-low border border-card-border p-2">
                    {editingScript ? (
                      <div>
                        <textarea value={localScript} onChange={(e) => setLocalScript(e.target.value)} rows={4}
                          className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-[11px] text-on-surface leading-snug focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                        <button onClick={() => setEditingScript(false)} className="text-[10px] font-bold text-primary hover:underline mt-1">Done</button>
                      </div>
                    ) : (
                      <div onClick={() => { setLocalScript(fillScript(profile.openingScript, lead)); setEditingScript(true); }} className="cursor-pointer">
                        <p className="text-[11px] text-on-surface-variant leading-snug whitespace-pre-line">{fillScript(profile.openingScript, lead)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Note input */}
            <div className="relative">
              <input type="text" value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); }}
                className="w-full rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-on-surface-variant/50"
                placeholder="Quick note..." />
              {saved && <span className="absolute right-2 top-2 text-[10px] text-emerald-500 font-bold">Saved</span>}
            </div>

            {/* Call outcomes — ONLY if callable */}
            {isCallable && (
              outcomeLogged ? (
                <div className="flex items-center gap-2 justify-center py-1">
                  <MaterialIcon icon="check_circle" className="text-[16px] text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-600">Logged: {outcomeLogged}</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { outcome: 'No Answer' as CallOutcome, icon: 'phone_disabled', label: 'No Ans' },
                    { outcome: 'Left VM' as CallOutcome, icon: 'voicemail', label: 'VM' },
                    { outcome: 'Spoke with Owner' as CallOutcome, icon: 'forum', label: 'Spoke' },
                    { outcome: 'DNC' as CallOutcome, icon: 'block', label: 'DNC' },
                  ]).map(({ outcome, icon, label }) => (
                    <button key={outcome} onClick={() => logOutcome(outcome)}
                      className="flex flex-col items-center py-1.5 rounded-lg bg-surface-container-high hover:bg-primary/20 text-[9px] font-semibold text-on-surface-variant hover:text-primary transition-all">
                      <MaterialIcon icon={icon} className="text-[14px] mb-0.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* ── OPEN FULL RECORD (both types) ── */}
        <Link href={`/leads/${lead.id}`}
          className="block w-full text-center rounded-lg bg-primary text-white text-xs font-bold py-2 hover:bg-primary/90 transition-colors">
          Open Full Record
        </Link>
      </div>

      <UpgradeGate
        feature={upgradeFeature as 'dialer' | 'marketData'}
        show={!!upgradeFeature}
        onClose={() => setUpgradeFeature(null)}
      />
    </div>
  );
}
