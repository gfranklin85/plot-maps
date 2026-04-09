'use client';

import { useState } from 'react';
import { Lead, CallOutcome, LeadStatus } from '@/types';
import { CALL_OUTCOMES } from '@/lib/constants';
import { cn, formatPhone } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  lead: Lead;
  onActivityLogged: () => void;
}

const OUTCOME_CONFIG: Record<CallOutcome, { icon: string; color: string }> = {
  'No Answer': { icon: 'phone_missed', color: 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high' },
  'Left VM': { icon: 'voicemail', color: 'bg-violet-100 text-violet-700 hover:bg-violet-200' },
  'Spoke with Owner': { icon: 'record_voice_over', color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
  'Not Interested': { icon: 'thumb_down', color: 'bg-rose-100 text-rose-700 hover:bg-rose-200' },
  'Follow-Up': { icon: 'event', color: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
  'DNC': { icon: 'block', color: 'bg-red-100 text-red-700 hover:bg-red-200' },
};

const OUTCOME_STATUS_MAP: Partial<Record<CallOutcome, LeadStatus>> = {
  'No Answer': 'Called',
  'Left VM': 'Called',
  'Spoke with Owner': 'Interested',
  'Not Interested': 'Not Interested',
  'Follow-Up': 'Follow-Up',
  'DNC': 'Do Not Call',
};

export default function CallPanel({ lead, onActivityLogged }: Props) {
  const { user } = useAuth();
  const [calling, setCalling] = useState(false);
  const [callingNumber, setCallingNumber] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const phoneNumbers = [lead.phone, lead.phone_2, lead.phone_3].filter(Boolean) as string[];

  async function initiateCall(phone: string) {
    setCalling(true);
    setCallingNumber(phone);
    setError(null);
    try {
      const res = await fetch('/api/call/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, leadId: lead.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to initiate call');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate call');
    } finally {
      setCalling(false);
      setCallingNumber(null);
    }
  }

  async function saveCall() {
    if (!selectedOutcome) return;
    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('activities').insert({
        lead_id: lead.id,
        type: 'call',
        title: `Call — ${selectedOutcome}`,
        outcome: selectedOutcome,
        description: notes.trim() || null,
      });
      if (insertError) throw insertError;

      const newStatus = OUTCOME_STATUS_MAP[selectedOutcome];
      const updates: Record<string, unknown> = {
        last_contact_date: new Date().toISOString(),
      };
      if (newStatus) updates.status = newStatus;

      const { error: updateError } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id)
        .eq('user_id', user?.id);
      if (updateError) throw updateError;

      setSelectedOutcome(null);
      setNotes('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onActivityLogged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save call');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
          <MaterialIcon icon="call" className="text-[20px] text-blue-600" filled />
        </div>
        <h3 className="font-headline text-lg font-bold text-on-surface">Call</h3>
      </div>

      {/* Phone number buttons */}
      {phoneNumbers.length === 0 ? (
        <p className="text-sm text-secondary mb-4">No phone numbers on file</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {phoneNumbers.map((phone, i) => (
            <button
              key={phone}
              disabled={calling}
              onClick={() => initiateCall(phone)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                callingNumber === phone
                  ? 'action-gradient text-white shadow-md animate-pulse'
                  : 'bg-primary text-on-primary shadow-sm hover:shadow-md'
              )}
            >
              <MaterialIcon icon="call" className="text-[16px]" />
              {formatPhone(phone)}
              {i > 0 && (
                <span className="text-xs opacity-75">#{i + 1}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Calling indicator */}
      {calling && (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 mb-4 text-sm text-primary">
          <MaterialIcon icon="ring_volume" className="text-[18px] animate-pulse" />
          Calling {formatPhone(callingNumber)}...
        </div>
      )}

      {/* Outcome selector */}
      <div className="mb-3">
        <p className="font-label text-xs font-semibold uppercase tracking-wide text-secondary mb-2">
          Call Outcome
        </p>
        <div className="grid grid-cols-3 gap-2">
          {CALL_OUTCOMES.map((outcome) => {
            const config = OUTCOME_CONFIG[outcome];
            const isSelected = selectedOutcome === outcome;
            return (
              <button
                key={outcome}
                onClick={() => setSelectedOutcome(outcome)}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                  isSelected
                    ? 'ring-2 ring-primary shadow-sm'
                    : '',
                  config.color
                )}
              >
                <MaterialIcon icon={config.icon} className="text-[16px]" />
                {outcome}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Quick notes about the call..."
        rows={2}
        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y mb-3"
      />

      {/* Save button */}
      <button
        onClick={saveCall}
        disabled={!selectedOutcome || saving}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
          selectedOutcome && !saving
            ? 'action-gradient text-white shadow-sm hover:shadow-md'
            : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
        )}
      >
        {saving ? (
          <>
            <MaterialIcon icon="progress_activity" className="text-[18px] animate-spin" />
            Saving...
          </>
        ) : success ? (
          <>
            <MaterialIcon icon="check_circle" className="text-[18px]" />
            Saved!
          </>
        ) : (
          <>
            <MaterialIcon icon="save" className="text-[18px]" />
            Save Call
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <MaterialIcon icon="error" className="text-[16px]" />
          {error}
        </div>
      )}
    </div>
  );
}
