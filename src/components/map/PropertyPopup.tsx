"use client";

import { useState } from "react";
import Link from "next/link";
import { Lead, STATUS_BG_COLORS, CallOutcome, LeadStatus } from "@/types";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { cn, formatPhone } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/profile-context";

interface Props {
  lead: Lead;
  onUpdate?: () => void;
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
  const value = lead.price_range || '$XXX,XXX';
  return template
    .replace(/\{name\}/g, firstName)
    .replace(/\{street\}/g, street)
    .replace(/\{value\}/g, value);
}

export default function PropertyPopup({ lead, onUpdate }: Props) {
  const { profile } = useProfile();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [outcomeLogged, setOutcomeLogged] = useState<string | null>(null);

  const phones = [lead.phone, lead.phone_2, lead.phone_3].filter(Boolean) as string[];

  async function saveNote() {
    if (!note.trim()) return;
    setSaving(true);
    await supabase.from('activities').insert({
      lead_id: lead.id,
      type: 'note',
      title: 'Note (from map)',
      description: note.trim(),
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
        status: newStatus,
        last_contact_date: new Date().toISOString(),
      }).eq('id', lead.id);
    }
    await supabase.from('activities').insert({
      lead_id: lead.id,
      type: 'call',
      title: `Call: ${outcome}`,
      outcome,
      description: note || undefined,
    });
    setOutcomeLogged(outcome);
    setNote('');
    onUpdate?.();
  }

  return (
    <div className="bg-white rounded-2xl min-w-[340px] max-w-[380px]">
      {/* Header: status + address */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", STATUS_BG_COLORS[lead.status])}>
            {lead.status}
          </span>
          {lead.price_range && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
              {lead.price_range}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-gray-900 leading-snug">{lead.property_address || 'No address'}</p>
        <p className="text-xs text-gray-600 font-medium">{lead.owner_name || lead.name}</p>
      </div>

      {/* Phones */}
      {phones.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {phones.map((phone, idx) => (
            <a key={idx} href={`tel:${phone}`} className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:underline">
              <MaterialIcon icon="call" className="text-[12px] text-green-600" />
              {formatPhone(phone)}
            </a>
          ))}
        </div>
      )}

      {/* Opening Script */}
      {profile.openingScript && (
        <div className="px-4 pb-2">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 max-h-32 overflow-y-auto">
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">Script</p>
            <p className="text-[11px] text-blue-900 leading-snug whitespace-pre-line">{fillScript(profile.openingScript, lead)}</p>
          </div>
        </div>
      )}

      {/* Notes Input */}
      <div className="px-4 pb-2">
        <div className="relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) saveNote(); }}
            rows={2}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder:text-gray-400"
            placeholder="Type note here... (Ctrl+Enter to save)"
          />
          {note.trim() && (
            <button
              onClick={saveNote}
              disabled={saving}
              className="absolute bottom-2 right-2 text-[10px] font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {saving ? '...' : 'Save'}
            </button>
          )}
        </div>
        {saved && <p className="text-[10px] text-emerald-600 font-bold mt-0.5">Note saved!</p>}
      </div>

      {/* Call Outcome Buttons */}
      <div className="px-4 pb-3">
        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Call Outcome</p>
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
              <button
                key={outcome}
                onClick={() => logOutcome(outcome)}
                className="flex items-center justify-center gap-1 py-1.5 bg-white border border-gray-200 rounded-lg text-[9px] font-bold text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-all"
              >
                <MaterialIcon icon={icon} className="text-[12px]" /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Open Full Record */}
      <div className="px-4 pb-4">
        <Link
          href={`/leads/${lead.id}`}
          className="block w-full text-center rounded-xl bg-blue-600 text-white text-xs font-bold py-2 hover:bg-blue-700 transition-colors"
        >
          Open Full Record
        </Link>
      </div>
    </div>
  );
}
