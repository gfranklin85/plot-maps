'use client';

import { useState } from 'react';
import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useProfile } from '@/lib/profile-context';
import UpgradeGate from '@/components/ui/UpgradeGate';

interface Props {
  lead: Lead;
  onEmailSent: () => void;
}

export default function EmailComposer({ lead, onEmailSent }: Props) {
  const { profile } = useProfile();
  const [showGate, setShowGate] = useState(false);
  const isSubscribed = profile.subscriptionStatus === 'active';
  const [to, setTo] = useState(lead.email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleAiDraft() {
    if (!isSubscribed) { setShowGate(true); return; }
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/email-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          leadName: lead.name,
          propertyAddress: lead.property_address,
          ownerName: lead.owner_name,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate draft');
      }
      const data = await res.json();
      if (data.subject) setSubject(data.subject);
      if (data.body) setBody(data.body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate AI draft');
    } finally {
      setDrafting(false);
    }
  }

  async function handleSend() {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    if (!isSubscribed) { setShowGate(true); return; }

    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          body: body.trim(),
          leadId: lead.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send email');
      }

      // Log activity
      await supabase.from('activities').insert({
        lead_id: lead.id,
        type: 'email',
        title: `Email: ${subject.trim()}`,
        description: `Sent to ${to.trim()}`,
      });

      setSubject('');
      setBody('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
      onEmailSent();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  }

  const canSend = to.trim() && subject.trim() && body.trim() && !sending;

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
            <MaterialIcon icon="mail" className="text-[20px] text-violet-600" filled />
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">Email</h3>
        </div>

        <button
          onClick={handleAiDraft}
          disabled={drafting}
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all',
            drafting
              ? 'bg-slate-100 text-slate-400'
              : 'bg-violet-100 text-violet-700 hover:bg-violet-200'
          )}
        >
          {drafting ? (
            <>
              <MaterialIcon icon="progress_activity" className="text-[14px] animate-spin" />
              Drafting...
            </>
          ) : (
            <>
              <MaterialIcon icon="auto_awesome" className="text-[14px]" />
              AI Draft
            </>
          )}
        </button>
      </div>

      {/* To field */}
      <div className="mb-3">
        <label className="font-label text-xs font-semibold uppercase tracking-wide text-secondary mb-1 block">
          To
        </label>
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="email@example.com"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Subject field */}
      <div className="mb-3">
        <label className="font-label text-xs font-semibold uppercase tracking-wide text-secondary mb-1 block">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line..."
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Body */}
      <div className="mb-4">
        <label className="font-label text-xs font-semibold uppercase tracking-wide text-secondary mb-1 block">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          rows={8}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSend}
        disabled={!canSend}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
          canSend
            ? 'action-gradient text-white shadow-sm hover:shadow-md'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        )}
      >
        {sending ? (
          <>
            <MaterialIcon icon="progress_activity" className="text-[18px] animate-spin" />
            Sending...
          </>
        ) : success ? (
          <>
            <MaterialIcon icon="check_circle" className="text-[18px]" />
            Sent!
          </>
        ) : (
          <>
            <MaterialIcon icon="send" className="text-[18px]" />
            Send Email
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

      <UpgradeGate feature="email" show={showGate} onClose={() => setShowGate(false)} />
    </div>
  );
}
