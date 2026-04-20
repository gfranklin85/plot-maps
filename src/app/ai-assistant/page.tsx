'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useProfile } from '@/lib/profile-context';
import { ASSISTANT_TEMPLATES } from '@/lib/ai-assistant-templates';

interface UsageData {
  ai_minutes_used: number;
  ai_minutes_limit: number;
  ai_minutes_remaining: number;
  ai_overage_per_min_cents: number;
  tier_label: string;
}

interface WalletData {
  balance_cents: number;
}

const VOICE_OPTIONS = [
  { id: 'rachel', label: 'Rachel', description: 'Warm, professional — default' },
  { id: 'adam', label: 'Adam', description: 'Confident, grounded male voice' },
  { id: 'bella', label: 'Bella', description: 'Friendly, upbeat female voice' },
  { id: 'antoni', label: 'Antoni', description: 'Articulate, measured male voice' },
  { id: 'elli', label: 'Elli', description: 'Young, approachable female voice' },
];

export default function AIAssistantPage() {
  const { profile, updateProfile, loading: profileLoading } = useProfile();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [openingDraft, setOpeningDraft] = useState(profile.aiCustomOpening);
  const [openingSaved, setOpeningSaved] = useState(false);

  useEffect(() => {
    setOpeningDraft(profile.aiCustomOpening);
  }, [profile.aiCustomOpening]);

  useEffect(() => {
    (async () => {
      try {
        const [usageRes, walletRes] = await Promise.all([
          fetch('/api/usage').then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/wallet').then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (usageRes) setUsage(usageRes);
        if (walletRes) setWallet(walletRes);
      } catch { /* silent */ }
    })();
  }, []);

  function pickTemplate(key: string) {
    updateProfile({ aiDefaultAssistant: key });
  }

  function pickVoice(id: string) {
    updateProfile({ aiVoiceId: id });
  }

  function saveOpening() {
    updateProfile({ aiCustomOpening: openingDraft });
    setOpeningSaved(true);
    setTimeout(() => setOpeningSaved(false), 2000);
  }

  const templates = Object.values(ASSISTANT_TEMPLATES);
  const minutesRemaining = usage?.ai_minutes_remaining ?? 0;
  const minutesLimit = usage?.ai_minutes_limit ?? 0;
  const overageRate = usage ? (usage.ai_overage_per_min_cents / 100).toFixed(2) : '0.00';
  const walletDollars = wallet ? (wallet.balance_cents / 100).toFixed(2) : '0.00';

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <MaterialIcon icon="smart_toy" className="text-[24px] text-violet-400" />
          </div>
          <div>
            <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">AI Receptionist</h1>
            <p className="text-sm text-on-surface-variant">Configure how your AI answers calls.</p>
          </div>
        </div>
      </div>

      {/* Compliance disclaimer */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
        <MaterialIcon icon="info" className="text-[20px] text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-on-surface leading-relaxed">
          This assistant handles <span className="font-bold">inbound calls</span> and follow-up with{' '}
          <span className="font-bold">opted-in contacts</span> only. It does not make cold outbound calls.
        </div>
      </div>

      {/* Assistant template picker */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface font-headline">Tone</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Pick the conversational style the assistant uses when following up with a contact.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {templates.map((t) => {
            const active = profile.aiDefaultAssistant === t.key;
            return (
              <button
                key={t.key}
                onClick={() => pickTemplate(t.key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-card-border bg-surface-container-low hover:border-violet-500/30'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-on-surface">{t.label}</p>
                  {active && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400">Selected</span>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Voice picker */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface font-headline">Voice</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            The ElevenLabs voice used for the assistant&apos;s speech.
          </p>
        </div>

        <select
          value={profile.aiVoiceId}
          onChange={(e) => pickVoice(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          {VOICE_OPTIONS.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} — {v.description}
            </option>
          ))}
        </select>
      </section>

      {/* Custom opening */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface font-headline">Custom Opening</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Override the assistant&apos;s first line. Leave blank to use the default for the selected tone.
          </p>
        </div>

        <p className="text-[11px] text-on-surface-variant">
          Placeholders:{' '}
          <code className="bg-surface-container px-1 rounded">{'{agent_first_name}'}</code>{' '}
          <code className="bg-surface-container px-1 rounded">{'{agent_company}'}</code>{' '}
          <code className="bg-surface-container px-1 rounded">{'{owner_first_name}'}</code>{' '}
          <code className="bg-surface-container px-1 rounded">{'{reference_address}'}</code>{' '}
          <code className="bg-surface-container px-1 rounded">{'{sold_price}'}</code>{' '}
          <code className="bg-surface-container px-1 rounded">{'{property_city}'}</code>
        </p>

        <textarea
          value={openingDraft}
          onChange={(e) => setOpeningDraft(e.target.value)}
          rows={4}
          placeholder="Hi, is this {owner_first_name}? This is an assistant calling on behalf of {agent_first_name}..."
          className="w-full px-4 py-3 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono leading-relaxed"
        />

        <div className="flex items-center gap-3">
          <button
            onClick={saveOpening}
            disabled={profileLoading || openingDraft === profile.aiCustomOpening}
            className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            Save opening
          </button>
          {openingSaved && (
            <span className="text-xs text-emerald-400 font-semibold">Saved</span>
          )}
        </div>
      </section>

      {/* Usage + wallet */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface font-headline">Usage</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">Minutes included in your plan this month.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">AI Minutes</p>
            <p className="text-2xl font-extrabold text-on-surface mt-1">
              {Math.round(minutesRemaining)}
              <span className="text-sm text-on-surface-variant font-semibold"> / {minutesLimit}</span>
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">remaining</p>
          </div>
          <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider">Wallet</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">${walletDollars}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Overage ${overageRate}/min
            </p>
          </div>
        </div>

        <a
          href="/subscribe"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          Upgrade plan <MaterialIcon icon="arrow_forward" className="text-[16px]" />
        </a>
      </section>
    </div>
  );
}
