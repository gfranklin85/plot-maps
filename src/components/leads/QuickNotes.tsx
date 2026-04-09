'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  leadId: string;
  onNoteSaved: () => void;
}

export default function QuickNotes({ leadId, onNoteSaved }: Props) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from('activities').insert({
        lead_id: leadId,
        type: 'note',
        title: 'Note',
        description: trimmed,
      });
      if (insertError) throw insertError;

      setText('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      onNoteSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  }

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
      <div className="flex items-center gap-2 mb-3">
        <MaterialIcon icon="sticky_note_2" className="text-[20px] text-amber-500" filled />
        <h3 className="font-headline text-sm font-bold text-on-surface">Quick Note</h3>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a note... (Ctrl+Enter to save)"
        rows={3}
        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y mb-3"
      />

      <div className="flex items-center justify-between">
        <div>
          {success && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <MaterialIcon icon="check_circle" className="text-[14px]" />
              Note saved
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1 text-xs font-medium text-rose-600">
              <MaterialIcon icon="error" className="text-[14px]" />
              {error}
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
            text.trim() && !saving
              ? 'bg-primary text-on-primary shadow-sm hover:shadow-md'
              : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
          )}
        >
          {saving ? (
            <>
              <MaterialIcon icon="progress_activity" className="text-[16px] animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <MaterialIcon icon="save" className="text-[16px]" />
              Save Note
            </>
          )}
        </button>
      </div>
    </div>
  );
}
