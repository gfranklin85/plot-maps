'use client';

import { useState } from 'react';
import { Lead } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  lead: Lead;
  onScheduled: () => void;
}

const QUICK_OPTIONS = [
  { label: 'Tomorrow', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
] as const;

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export default function FollowUpScheduler({ lead, onScheduled }: Props) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    lead.follow_up_date ? lead.follow_up_date.split('T')[0] : ''
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function selectQuickDate(days: number) {
    setSelectedDate(addDays(days));
  }

  async function handleSchedule() {
    if (!selectedDate) return;

    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ follow_up_date: selectedDate })
        .eq('id', lead.id)
        .eq('user_id', user?.id);
      if (updateError) throw updateError;

      const { error: insertError } = await supabase.from('activities').insert({
        lead_id: lead.id,
        type: 'note',
        title: 'Follow-up scheduled',
        description: note.trim()
          ? `Follow-up set for ${formatDate(selectedDate)}. ${note.trim()}`
          : `Follow-up set for ${formatDate(selectedDate)}`,
      });
      if (insertError) throw insertError;

      setNote('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      onScheduled();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule follow-up');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
          <MaterialIcon icon="event" className="text-[20px] text-amber-600" filled />
        </div>
        <div>
          <h3 className="font-headline text-sm font-bold text-on-surface">Follow-Up</h3>
          {lead.follow_up_date && (
            <p className="text-xs text-secondary">
              Current: {formatDate(lead.follow_up_date)}
            </p>
          )}
        </div>
      </div>

      {/* Quick buttons */}
      <p className="font-label text-xs font-semibold uppercase tracking-wide text-secondary mb-2">
        Quick Set
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {QUICK_OPTIONS.map((opt) => {
          const optDate = addDays(opt.days);
          const isSelected = selectedDate === optDate;
          return (
            <button
              key={opt.label}
              onClick={() => selectQuickDate(opt.days)}
              className={cn(
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                isSelected
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Custom date */}
      <div className="mb-3">
        <label className="font-label text-xs font-semibold uppercase tracking-wide text-secondary mb-1 block">
          Custom Date
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Optional note */}
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note..."
        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary mb-3"
      />

      {/* Schedule button */}
      <button
        onClick={handleSchedule}
        disabled={!selectedDate || saving}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
          selectedDate && !saving
            ? 'action-gradient text-white shadow-sm hover:shadow-md'
            : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
        )}
      >
        {saving ? (
          <>
            <MaterialIcon icon="progress_activity" className="text-[18px] animate-spin" />
            Scheduling...
          </>
        ) : success ? (
          <>
            <MaterialIcon icon="check_circle" className="text-[18px]" />
            Scheduled!
          </>
        ) : (
          <>
            <MaterialIcon icon="event_available" className="text-[18px]" />
            Schedule Follow-Up
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
