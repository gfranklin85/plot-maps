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

interface ProspectAddress {
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface Props {
  lead: Lead;
  onUpdate?: () => void;
  walkMode?: boolean;
  onWalkHere?: (lead: Lead) => void;
  onAutoTarget?: (lead: Lead) => void;
  onAddProspects?: (addresses: ProspectAddress[]) => void;
}

const OUTCOME_STATUS: Partial<Record<CallOutcome, LeadStatus>> = {
  'No Answer': 'Called',
  'Left VM': 'Called',
  'Spoke with Owner': 'Interested',
  'Not Interested': 'Not Interested',
  'Follow-Up': 'Follow-Up',
  'DNC': 'Do Not Call',
};

// Street View Static API removed — using Walk Here button instead

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

function generateTalkingPoints(lead: Lead): string[] {
  const points: string[] = [];

  if (lead.listing_status === 'Sold') {
    // Price analysis
    if (lead.listing_price && lead.selling_price && lead.selling_price > 0) {
      const diff = lead.selling_price - lead.listing_price;
      if (diff > 0) {
        points.push(`Sold $${diff.toLocaleString()} OVER asking — competitive market`);
      } else if (diff < 0) {
        points.push(`Sold $${Math.abs(diff).toLocaleString()} below asking ($${lead.listing_price.toLocaleString()} list)`);
      } else {
        points.push(`Sold at full asking price — strong demand`);
      }
    }

    // Days on market
    if (lead.dom != null) {
      if (lead.dom <= 7) points.push(`Only ${lead.dom} days on market — extremely fast sale`);
      else if (lead.dom <= 30) points.push(`${lead.dom} days on market — quick sale`);
      else if (lead.dom <= 90) points.push(`${lead.dom} days on market — normal pace`);
      else points.push(`${lead.dom} days on market — sat a while, possibly overpriced initially`);
    }

    // Price per sqft
    if (lead.selling_price && lead.sqft && lead.sqft > 0) {
      const ppsf = Math.round(lead.selling_price / lead.sqft);
      points.push(`$${ppsf}/sqft — use as comp for neighboring properties`);
    }

    // Recency
    if (lead.selling_date) {
      const daysSinceSale = Math.floor((Date.now() - new Date(lead.selling_date + 'T00:00:00').getTime()) / 86400000);
      if (daysSinceSale <= 30) points.push(`Sold ${daysSinceSale} days ago — very fresh comp`);
      else if (daysSinceSale <= 90) points.push(`Sold ${Math.round(daysSinceSale / 7)} weeks ago — recent comp`);
      else if (daysSinceSale <= 180) points.push(`Sold ${Math.round(daysSinceSale / 30)} months ago — still relevant comp`);
    }
  }

  if (lead.listing_status === 'Active') {
    if (lead.listing_price) points.push(`Asking $${lead.listing_price.toLocaleString()}`);
    if (lead.dom != null) {
      if (lead.dom > 60) points.push(`${lead.dom} DOM — been sitting, price may be too high`);
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

  // Property details for any type
  if (lead.sqft) points.push(`${lead.sqft.toLocaleString()} sqft`);
  if (lead.year_built) points.push(`Built ${lead.year_built}`);
  if (lead.lot_acres) points.push(`${lead.lot_acres} acre lot`);

  return points;
}

export default function PropertyPopup({ lead, onUpdate, walkMode = false, onWalkHere, onAutoTarget, onAddProspects }: Props) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { makeCall, isDesktop } = usePhone();
  const [note, setNote] = useState('');
  const [, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outcomeLogged, setOutcomeLogged] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false); // always collapsed by default
  const [editingScript, setEditingScript] = useState(false);
  const [localScript, setLocalScript] = useState('');
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);
  const [prospectPickerOpen, setProspectPickerOpen] = useState(false);
  const [prospectMode, setProspectMode] = useState<'nearest' | 'street' | 'radius'>('nearest');
  const [prospectCount, setProspectCount] = useState(12);
  const [prospectRadius, setProspectRadius] = useState(0.25);
  const [prospectLoading, setProspectLoading] = useState(false);
  const [prospectResult, setProspectResult] = useState<string | null>(null);

  const isFree = profile.subscriptionStatus !== 'active';

  async function grabProspects() {
    if (lead.latitude == null || lead.longitude == null) return;
    setProspectLoading(true);
    setProspectResult(null);
    try {
      const res = await fetch('/api/nearby-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: lead.latitude,
          lng: lead.longitude,
          mode: prospectMode,
          count: prospectCount,
          radiusMiles: prospectRadius,
          referenceStreet: lead.property_address?.split(',')[0]?.replace(/^\d+\s*/, '') || undefined,
        }),
      });
      const data = await res.json();
      if (data.addresses?.length > 0) {
        onAddProspects?.(data.addresses);
        setProspectResult(`Added ${data.addresses.length} addresses`);
        setTimeout(() => { setProspectResult(null); setProspectPickerOpen(false); }, 2000);
      } else {
        setProspectResult('No addresses found');
      }
    } catch {
      setProspectResult('Error grabbing addresses');
    }
    setProspectLoading(false);
  }

  const phones = [lead.phone, lead.phone_2, lead.phone_3].filter(Boolean) as string[];
  const isMLS = !!lead.listing_status;
  const isSold = lead.listing_status === 'Sold';
  const isActive = lead.listing_status === 'Active';
  const isPending = lead.listing_status === 'Pending';

  const talkingPoints = isMLS ? generateTalkingPoints(lead) : [];

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'note', title: 'Note (from map)', description: note.trim(),
    });
    setNote('');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
    setOutcomeLogged(outcome);
    setNote('');
    onUpdate?.();
  }

  // Status color for inline text
  const statusColor = isSold ? 'text-yellow-400' : isActive ? 'text-green-400' : isPending ? 'text-purple-400' : 'text-on-surface-variant';
  const statusText = isSold ? 'Sold' : isActive ? 'Active' : isPending ? 'Pending' : '';
  const price = lead.selling_price || lead.listing_price;
  const priceStr = price ? `$${price.toLocaleString()}` : '';

  // Compact facts line
  const facts = [
    lead.sqft ? `${lead.sqft.toLocaleString()} sqft` : '',
    lead.year_built ? `Built ${lead.year_built}` : '',
    lead.lot_acres ? `${lead.lot_acres} ac` : '',
  ].filter(Boolean).join(' · ');

  // Top 2 talking points only for compact view
  const topTalkingPoints = talkingPoints.slice(0, 2);

  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden", walkMode ? "min-w-[280px] max-w-[320px]" : "w-full")}>
      {/* ─── CONTENT ─── */}
      <div className="px-5 pt-4 pb-3 space-y-3">
        {/* 1. ADDRESS (primary — largest, boldest) */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-lg font-extrabold tracking-tight text-on-surface leading-tight">
              {lead.property_address?.split(',')[0] || 'No address'}
            </h2>
            <p className="text-xs text-on-surface-variant font-medium">
              {lead.property_address?.split(',').slice(1).join(',').trim() || ''}
            </p>
            {!isMLS && (lead.owner_name || lead.name) && (
              <p className="text-xs text-on-surface-variant mt-0.5">{lead.owner_name || lead.name}</p>
            )}
          </div>
          {/* Action pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Prospects — only on MLS reference records */}
            {!walkMode && isMLS && lead.latitude != null && lead.longitude != null && onAddProspects && (
              <button
                onClick={() => setProspectPickerOpen(!prospectPickerOpen)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  prospectPickerOpen
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface-container-high border-card-border text-primary hover:bg-primary hover:text-white'
                }`}
              >
                <MaterialIcon icon="my_location" className="text-[14px]" />
                Prospects
              </button>
            )}
            {/* Walk Here */}
            {!walkMode && onWalkHere && lead.latitude != null && lead.longitude != null && (
              <button
                onClick={() => onWalkHere(lead)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-surface-container-high border border-card-border text-xs font-medium text-primary hover:bg-primary hover:text-white transition-all"
              >
                <MaterialIcon icon="directions_walk" className="text-[14px]" />
                Walk
              </button>
            )}
          </div>
        </div>

        {/* PROSPECT PICKER — inline expandable */}
        {prospectPickerOpen && (
          <div className="rounded-lg bg-surface-container-lowest border border-card-border p-3 space-y-3">
            {/* Mode tabs */}
            <div className="flex gap-1">
              {([
                { mode: 'nearest' as const, label: 'Nearest', icon: 'near_me' },
                { mode: 'street' as const, label: 'Street', icon: 'add_road' },
                { mode: 'radius' as const, label: 'Radius', icon: 'radar' },
              ]).map(({ mode, label, icon }) => (
                <button
                  key={mode}
                  onClick={() => setProspectMode(mode)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                    prospectMode === mode
                      ? 'bg-primary text-white'
                      : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <MaterialIcon icon={icon} className="text-[12px]" />
                  {label}
                </button>
              ))}
            </div>

            {/* Mode-specific controls */}
            {prospectMode === 'nearest' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Count:</span>
                <div className="flex gap-1">
                  {[6, 12, 20].map(n => (
                    <button
                      key={n}
                      onClick={() => setProspectCount(n)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        prospectCount === n ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={prospectCount}
                  onChange={e => setProspectCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 6)))}
                  className="w-14 rounded border border-card-border bg-surface-container-high px-2 py-1 text-xs text-on-surface text-center focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            )}

            {prospectMode === 'radius' && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Radius:</span>
                <div className="flex gap-1">
                  {[0.25, 0.5, 1].map(r => (
                    <button
                      key={r}
                      onClick={() => setProspectRadius(r)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                        prospectRadius === r ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {r}mi
                    </button>
                  ))}
                </div>
              </div>
            )}

            {prospectMode === 'street' && (
              <p className="text-[10px] text-on-surface-variant">
                Grabs addresses along the same street as this property
              </p>
            )}

            {/* Grab button */}
            <button
              onClick={grabProspects}
              disabled={prospectLoading}
              className="w-full py-2 rounded-lg bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {prospectLoading ? (
                <>
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Grabbing...
                </>
              ) : (
                <>
                  <MaterialIcon icon="add_location_alt" className="text-[14px]" />
                  Grab {prospectMode === 'nearest' ? `${prospectCount} Nearest` : prospectMode === 'street' ? 'Street' : `${prospectRadius}mi Radius`}
                </>
              )}
            </button>

            {/* Result feedback */}
            {prospectResult && (
              <p className={`text-[11px] font-semibold text-center ${prospectResult.startsWith('Added') ? 'text-emerald-500' : 'text-red-400'}`}>
                {prospectResult}
              </p>
            )}
          </div>
        )}

        {/* 2. PRICE + STATUS (inline, not boxed) — blurred for free users on MLS data */}
        {(priceStr || statusText) && (
          <div className={cn("flex items-center gap-2", isFree && isMLS && "relative")}>
            <div className={cn(isFree && isMLS && "blur-sm select-none")}>
              {priceStr && <span className="font-bold text-on-surface">{priceStr}</span>}
              {priceStr && statusText && <span className="text-on-surface-variant/40 text-xs">·</span>}
              {statusText && <span className={`font-semibold ${statusColor}`}>{statusText}</span>}
              {lead.dom != null && (
                <>
                  <span className="text-on-surface-variant/40 text-xs">·</span>
                  <span className="text-xs text-on-surface-variant">{lead.dom}d DOM</span>
                </>
              )}
            </div>
            {isFree && isMLS && (
              <button onClick={() => setUpgradeFeature('marketData')} className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary bg-card/80 px-2 py-0.5 rounded-full border border-primary/30">Upgrade to see</span>
              </button>
            )}
          </div>
        )}

        {/* 3. KEY FACTS (one compressed line) — blurred for free on MLS */}
        {facts && (
          <div className={cn(isFree && isMLS && "relative")}>
            <p className={cn("text-[11px] font-medium text-on-surface-variant/70 uppercase tracking-wide", isFree && isMLS && "blur-sm select-none")}>{facts}</p>
            {isFree && isMLS && (
              <button onClick={() => setUpgradeFeature('marketData')} className="absolute inset-0" />
            )}
          </div>
        )}

        {/* 4. TALKING POINTS (condensed — max 2, inline) — blurred for free on MLS */}
        {topTalkingPoints.length > 0 && (
          <div className={cn("py-2 border-y border-card-border/50", isFree && isMLS && "relative")}>
            <div className={cn(isFree && isMLS && "blur-sm select-none")}>
              {topTalkingPoints.map((pt, i) => (
                <p key={i} className="text-xs text-on-surface-variant leading-relaxed">
                  <span className="text-primary mr-1">·</span>{pt}
                </p>
              ))}
            </div>
            {isFree && isMLS && (
              <button onClick={() => setUpgradeFeature('marketData')} className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-primary bg-card/80 px-2 py-0.5 rounded-full border border-primary/30">Upgrade to see</span>
              </button>
            )}
          </div>
        )}

        {/* 5. PHONES */}
        {phones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {phones.map((phone, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (isFree) { setUpgradeFeature('dialer'); return; }
                  if (isDesktop) makeCall(phone, lead.owner_name || lead.name || 'Unknown', lead.id);
                  else window.location.href = `tel:${phone}`;
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald-500 hover:underline"
              >
                <MaterialIcon icon="call" className="text-[12px]" />
                {formatPhone(phone)}
              </button>
            ))}
          </div>
        )}

        {/* 6. SCRIPT (collapsed by default) */}
        {profile.openingScript && (
          <div>
            <button
              onClick={() => setScriptOpen(!scriptOpen)}
              className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary/80"
            >
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

        {/* 7. NOTE INPUT */}
        <div className="relative">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveNote(); }}
            className="w-full rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs focus:ring-1 focus:ring-primary outline-none placeholder:text-on-surface-variant/50"
            placeholder="Quick note..."
          />
          {saved && <span className="absolute right-2 top-2 text-[10px] text-emerald-500 font-bold">Saved</span>}
        </div>

        {/* 8. CALL OUTCOMES (compact) */}
        {outcomeLogged ? (
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
        )}

        {/* 9. OPEN FULL RECORD */}
        <Link href={`/leads/${lead.id}`}
          className="block w-full text-center rounded-lg bg-primary text-white text-xs font-bold py-2 hover:bg-primary/90 transition-colors">
          Open Full Record
        </Link>
      </div>

      {/* Upgrade Gate Modal */}
      <UpgradeGate
        feature={upgradeFeature as 'dialer' | 'marketData'}
        show={!!upgradeFeature}
        onClose={() => setUpgradeFeature(null)}
      />
    </div>
  );
}
