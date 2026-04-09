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

interface Props {
  lead: Lead;
  onUpdate?: () => void;
  walkMode?: boolean;
  onWalkHere?: (lead: Lead) => void;
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

function formatSaleDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
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

export default function PropertyPopup({ lead, onUpdate, walkMode = false, onWalkHere }: Props) {
  const { profile } = useProfile();
  const { user } = useAuth();
  const { makeCall, isDesktop } = usePhone();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outcomeLogged, setOutcomeLogged] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false); // always collapsed by default
  const [editingScript, setEditingScript] = useState(false);
  const [localScript, setLocalScript] = useState('');

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

  return (
    <div className={cn("bg-card rounded-2xl overflow-hidden", walkMode ? "min-w-[280px] max-w-[320px]" : "min-w-[360px] max-w-[400px]")}>
      {/* ─── Walk Here button (aerial mode only) ─── */}
      {!walkMode && onWalkHere && lead.latitude != null && lead.longitude != null && (
        <div className="px-4 pt-3 pb-1">
          <button
            onClick={() => onWalkHere(lead)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">streetview</span>
            Walk Here
          </button>
        </div>
      )}

      {/* ─── HEADLINE ─── */}
      <div className="px-4 pt-3 pb-2">
        {/* Sold/Active headline — BIG and prominent for MLS */}
        {isSold && lead.selling_price && (
          <div className="mb-2 rounded-lg bg-green-50 border border-green-200 p-2.5 text-center">
            <p className="text-lg font-black text-green-800">
              Sold for ${lead.selling_price.toLocaleString()}
            </p>
            {lead.selling_date && (
              <p className="text-xs font-bold text-green-600">{formatSaleDate(lead.selling_date)}</p>
            )}
            {lead.dom != null && (
              <p className="text-[10px] text-green-500 mt-0.5">{lead.dom} days on market</p>
            )}
          </div>
        )}

        {isActive && lead.listing_price && (
          <div className="mb-2 rounded-lg bg-orange-50 border border-orange-200 p-2.5 text-center">
            <p className="text-lg font-black text-orange-800">
              Listed ${lead.listing_price.toLocaleString()}
            </p>
            {lead.dom != null && (
              <p className="text-xs font-bold text-orange-600">{lead.dom} days on market</p>
            )}
          </div>
        )}

        {isPending && (
          <div className="mb-2 rounded-lg bg-yellow-50 border border-yellow-200 p-2.5 text-center">
            <p className="text-lg font-black text-yellow-800">
              Pending {lead.listing_price ? `— $${lead.listing_price.toLocaleString()}` : ''}
            </p>
          </div>
        )}

        <p className="text-sm font-bold text-on-surface leading-snug">{lead.property_address || 'No address'}</p>
        {!isMLS && (
          <p className="text-xs text-on-surface-variant font-medium">{lead.owner_name || lead.name}</p>
        )}

        {/* MLS detail row */}
        {isMLS && lead.listing_price && lead.selling_price && lead.selling_price > 0 && (
          <p className="text-[11px] text-secondary mt-0.5">
            Listed ${lead.listing_price.toLocaleString()} → Sold ${lead.selling_price.toLocaleString()}
          </p>
        )}
      </div>

      {/* ─── TALKING POINTS (MLS only) ─── */}
      {talkingPoints.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Talking Points</p>
          <ul className="space-y-1">
            {talkingPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-on-surface">
                <MaterialIcon icon="arrow_right" className="text-[14px] text-blue-500 mt-0 shrink-0" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── PHONES (prospects with phone data) ─── */}
      {phones.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {phones.map((phone, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (isDesktop) {
                  makeCall(phone, lead.owner_name || lead.name || 'Unknown', lead.id);
                } else {
                  window.location.href = `tel:${phone}`;
                }
              }}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline cursor-pointer"
            >
              <MaterialIcon icon="call" className="text-[12px] text-green-600" />
              {formatPhone(phone)}
            </button>
          ))}
        </div>
      )}

      {/* ─── SCRIPT (collapsible, editable) ─── */}
      {profile.openingScript && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setScriptOpen(!scriptOpen)}
            className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:text-primary/80 w-full"
          >
            <MaterialIcon icon={scriptOpen ? 'expand_less' : 'expand_more'} className="text-[16px]" />
            Script
            {!scriptOpen && <span className="text-on-surface-variant normal-case font-normal ml-1">tap to expand</span>}
          </button>
          {scriptOpen && (
            <div className="mt-1 rounded-lg bg-primary/10 border border-primary/20 p-2 max-h-40 overflow-y-auto">
              {editingScript ? (
                <div>
                  <textarea
                    value={localScript}
                    onChange={(e) => setLocalScript(e.target.value)}
                    rows={5}
                    className="w-full rounded border border-primary/20 bg-card px-2 py-1.5 text-[11px] text-primary leading-snug focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setEditingScript(false)} className="text-[10px] font-bold text-primary hover:underline">Done</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => { setLocalScript(fillScript(profile.openingScript, lead)); setEditingScript(true); }} className="cursor-pointer">
                  <p className="text-[11px] text-primary leading-snug whitespace-pre-line">{fillScript(profile.openingScript, lead)}</p>
                  <p className="text-[9px] text-primary/60 mt-1 italic">Click to edit</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── NOTES ─── */}
      <div className="px-4 pb-2">
        <div className="relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) saveNote(); }}
            rows={2}
            className="w-full rounded-lg border border-card-border bg-surface-container-low px-3 py-2 text-xs focus:ring-2 focus:ring-primary outline-none resize-none placeholder:text-on-surface-variant"
            placeholder="Type note here... (Ctrl+Enter to save)"
          />
          {note.trim() && (
            <button onClick={saveNote} disabled={saving}
              className="absolute bottom-2 right-2 text-[10px] font-bold text-primary hover:text-primary/80 disabled:opacity-50">
              {saving ? '...' : 'Save'}
            </button>
          )}
        </div>
        {saved && <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Note saved!</p>}
      </div>

      {/* ─── CALL OUTCOMES ─── */}
      <div className="px-4 pb-3">
        <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest mb-1.5">Call Outcome</p>
        {outcomeLogged ? (
          <div className="text-center py-2">
            <MaterialIcon icon="check_circle" className="text-[20px] text-emerald-500" />
            <p className="text-[11px] font-bold text-emerald-700 mt-0.5">Logged: {outcomeLogged}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {([
              { outcome: 'No Answer' as CallOutcome, icon: 'phone_missed', label: 'No Answer' },
              { outcome: 'Left VM' as CallOutcome, icon: 'voicemail', label: 'Left VM' },
              { outcome: 'Spoke with Owner' as CallOutcome, icon: 'record_voice_over', label: 'Spoke' },
              { outcome: 'Follow-Up' as CallOutcome, icon: 'event', label: 'Follow-Up' },
              { outcome: 'Not Interested' as CallOutcome, icon: 'thumb_down', label: 'Not Int.' },
              { outcome: 'DNC' as CallOutcome, icon: 'block', label: 'DNC' },
            ]).map(({ outcome, icon, label }) => (
              <button key={outcome} onClick={() => logOutcome(outcome)}
                className="flex items-center justify-center gap-1 py-1.5 bg-card border border-card-border rounded-lg text-[9px] font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-all">
                <MaterialIcon icon={icon} className="text-[12px]" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── OPEN FULL RECORD ─── */}
      <div className="px-4 pb-4">
        <Link href={`/leads/${lead.id}`}
          className="block w-full text-center rounded-xl bg-primary text-white text-xs font-bold py-2 hover:bg-primary/90 transition-colors">
          Open Full Record
        </Link>
      </div>
    </div>
  );
}
