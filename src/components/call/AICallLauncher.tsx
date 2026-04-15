"use client";

import { useEffect, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import type { Lead } from "@/types";

interface AssistantOption {
  key: string;
  label: string;
  description: string;
}

// Mirror of ASSISTANT_TEMPLATES keys so we don't bundle server code
const ASSISTANTS: AssistantOption[] = [
  {
    key: "neighbor_warmth",
    label: "Neighbor Warmth",
    description: "Friendly opener referencing a recent sale nearby. Best for circle prospecting.",
  },
  {
    key: "expired_opener",
    label: "Expired Listing Opener",
    description: "Empathetic opener for expired MLS listings. Not pushy.",
  },
  {
    key: "fsbo_outreach",
    label: "FSBO Outreach",
    description: "Respectful outreach to for-sale-by-owner leads.",
  },
];

interface UsageInfo {
  ai_minutes_remaining: number;
  ai_minutes_limit: number;
  ai_overage_per_min_cents: number;
  wallet_balance_cents: number;
  tier_label: string;
}

interface InitiateResponse {
  id?: string;
  vapi_call_id?: string;
  monitor_listen_url?: string | null;
  first_message?: string;
  error?: string;
  message?: string;
  upgrade?: boolean;
  needs_topup?: boolean;
}

interface Props {
  lead: Lead | null;
  phoneNumber: string;
  onClose: () => void;
  onStarted: (args: { aiCallId: string; vapiCallId: string; monitorListenUrl: string | null; firstMessage: string }) => void;
  onUpgrade?: () => void;
  onTopup?: () => void;
}

export default function AICallLauncher({ lead, phoneNumber, onClose, onStarted, onUpgrade, onTopup }: Props) {
  const [selectedKey, setSelectedKey] = useState<string>("neighbor_warmth");
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const [usageRes, walletRes] = await Promise.all([
          fetch("/api/usage").then((r) => r.json()),
          fetch("/api/wallet").then((r) => r.json()).catch(() => ({ balance_cents: 0 })),
        ]);
        setUsage({
          ai_minutes_remaining: Number(usageRes.ai_minutes_remaining || 0),
          ai_minutes_limit: Number(usageRes.ai_minutes_limit || 0),
          ai_overage_per_min_cents: Number(usageRes.ai_overage_per_min_cents || 0),
          wallet_balance_cents: Number(walletRes.balance_cents || 0),
          tier_label: usageRes.tier_label || "Free",
        });
      } catch {
        /* silent */
      }
    }
    fetchUsage();
  }, []);

  const currentAssistant = ASSISTANTS.find((a) => a.key === selectedKey) || ASSISTANTS[0];

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-call/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead?.id,
          phoneNumber,
          assistantKey: selectedKey,
        }),
      });
      const data: InitiateResponse = await res.json();
      if (!res.ok) {
        if (data.upgrade) {
          setError(data.message || "Upgrade to use AI caller.");
          setTimeout(() => onUpgrade?.(), 500);
        } else if (data.needs_topup) {
          setError(data.message || "Add funds to your wallet for AI caller overage.");
          setTimeout(() => onTopup?.(), 500);
        } else {
          setError(data.message || data.error || "Failed to start call");
        }
        setLoading(false);
        return;
      }
      if (!data.id || !data.vapi_call_id) {
        setError("Call did not start correctly");
        setLoading(false);
        return;
      }
      onStarted({
        aiCallId: data.id,
        vapiCallId: data.vapi_call_id,
        monitorListenUrl: data.monitor_listen_url || null,
        firstMessage: data.first_message || "",
      });
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  const hasIncluded = usage && usage.ai_minutes_remaining > 0;
  const walletDollars = usage ? (usage.wallet_balance_cents / 100).toFixed(2) : "0.00";
  const overageRate = usage ? (usage.ai_overage_per_min_cents / 100).toFixed(2) : "0.00";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card rounded-2xl border border-violet-500/30 shadow-2xl overflow-hidden">
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-violet-500/20 rounded-full blur-[60px]" />

        <div className="relative z-10 p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <MaterialIcon icon="smart_toy" className="text-[24px] text-violet-400" />
              </div>
              <div>
                <h2 className="font-headline text-lg font-extrabold text-on-surface">Launch AI Call</h2>
                <p className="text-xs text-on-surface-variant">
                  Call {lead?.owner_name || lead?.name || "prospect"} at {phoneNumber}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
              <MaterialIcon icon="close" className="text-[20px]" />
            </button>
          </div>

          {/* Assistant picker */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Assistant
            </p>
            <div className="grid grid-cols-1 gap-2">
              {ASSISTANTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => setSelectedKey(a.key)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${
                    selectedKey === a.key
                      ? "border-violet-500 bg-violet-500/10"
                      : "border-card-border bg-surface-container-low hover:border-violet-500/30"
                  }`}
                >
                  <p className="text-sm font-bold text-on-surface">{a.label}</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">{a.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Opening preview */}
          <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              What the AI will say first
            </p>
            <p className="text-sm text-on-surface italic leading-relaxed">
              &ldquo;{currentAssistant.description}&rdquo;
            </p>
            <p className="text-[10px] text-on-surface-variant/60 mt-2">
              The AI will reference your nearest sold comp, owner name (if known), and your opening script from Settings.
            </p>
          </div>

          {/* Budget */}
          {usage && (
            <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">Included AI minutes</span>
                <span className={`font-bold ${hasIncluded ? "text-violet-400" : "text-on-surface-variant"}`}>
                  {Math.round(usage.ai_minutes_remaining)} / {usage.ai_minutes_limit} left
                </span>
              </div>
              {usage.ai_overage_per_min_cents > 0 && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Overage rate</span>
                    <span className="font-semibold text-on-surface">${overageRate}/min</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant">Wallet balance</span>
                    <span className="font-semibold text-emerald-400">${walletDollars}</span>
                  </div>
                </>
              )}
              <p className="text-[10px] text-on-surface-variant/60 pt-1 border-t border-card-border/50">
                {usage.tier_label} plan. Calls are billed per minute at end of call.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-400">{error}</div>
          )}

          {/* CTA */}
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-5px_rgba(139,92,246,0.4)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Dialing...
              </>
            ) : (
              <>
                <MaterialIcon icon="smart_toy" className="text-[18px]" />
                Start AI Call
              </>
            )}
          </button>
          <p className="text-[10px] text-on-surface-variant/60 text-center">
            You&apos;ll listen live and can jump in at any time.
          </p>
        </div>
      </div>
    </div>
  );
}
