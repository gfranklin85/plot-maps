"use client";

import { useEffect, useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { supabase } from "@/lib/supabase";
import type { Lead } from "@/types";

interface AssistantOption {
  key: string;
  label: string;
  description: string;
  firstMessageTemplate: string;
}

const ASSISTANTS: AssistantOption[] = [
  {
    key: "neighbor_warmth",
    label: "Neighbor Warmth",
    description: "Friendly opener referencing a recent sale nearby. Best for circle prospecting.",
    firstMessageTemplate:
      "Hi, is this {owner_first_name}? This is an assistant calling on behalf of {agent_first_name} with {agent_company}. I'm reaching out because a home just sold right near you at {reference_address} for {sold_price}. Quick question — have you been thinking about selling anytime soon, or are you pretty settled in for now?",
  },
  {
    key: "expired_opener",
    label: "Expired Listing Opener",
    description: "Empathetic opener for expired MLS listings. Not pushy.",
    firstMessageTemplate:
      "Hi, is this {owner_first_name}? This is {agent_first_name}'s assistant with {agent_company}. I saw your home at {reference_address} came off the market recently and I just wanted to reach out and see — are you still hoping to sell, or have you decided to stay put for now?",
  },
  {
    key: "fsbo_outreach",
    label: "FSBO Outreach",
    description: "Respectful outreach to for-sale-by-owner leads.",
    firstMessageTemplate:
      "Hi, is this {owner_first_name}? This is an assistant calling on behalf of {agent_first_name} at {agent_company}. I noticed your home at {reference_address} is for sale by owner — I'm not calling to convince you to list with an agent, I just wanted to see if you might be open to talking with {agent_first_name} briefly.",
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

const STATUS_COLORS: Record<string, string> = {
  Sold: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Pending: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function formatPrice(p: number | null | undefined): string | null {
  if (!p) return null;
  if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(p / 1000)}K`;
}

export default function AICallLauncher({ lead, phoneNumber, onClose, onStarted, onUpgrade, onTopup }: Props) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [selectedKey, setSelectedKey] = useState<string>("neighbor_warmth");
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference property state
  const [refOptions, setRefOptions] = useState<Lead[]>([]);
  const [selectedRef, setSelectedRef] = useState<Lead | null>(null);
  const [refLoading, setRefLoading] = useState(true);

  // Fetch usage + nearby reference properties on mount
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
      } catch { /* silent */ }
    }
    fetchUsage();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setRefLoading(true);
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .not("listing_status", "is", null)
        .order("selling_date", { ascending: false, nullsFirst: false })
        .limit(25);
      const refs = (data as Lead[]) || [];

      // Sort by distance from target lead if coordinates available
      if (lead?.latitude && lead?.longitude) {
        refs.sort((a, b) => {
          const distA = a.latitude && a.longitude
            ? Math.hypot(a.latitude - lead.latitude!, a.longitude - lead.longitude!)
            : Infinity;
          const distB = b.latitude && b.longitude
            ? Math.hypot(b.latitude - lead.latitude!, b.longitude - lead.longitude!)
            : Infinity;
          return distA - distB;
        });
      }

      setRefOptions(refs);
      if (refs.length > 0) setSelectedRef(refs[0]);
      setRefLoading(false);
    })();
  }, [user, lead]);

  const currentAssistant = ASSISTANTS.find((a) => a.key === selectedKey) || ASSISTANTS[0];

  // Build live preview of first message
  const previewMessage = (() => {
    const ownerFirst = (lead?.owner_name || lead?.name || "there").split(" ")[0];
    const agentFirst = (profile.fullName || "your agent").split(" ")[0];
    const company = profile.company || "Plot Maps";
    const refAddr = selectedRef?.property_address?.split(",")[0] || "a nearby home";
    const price = formatPrice(selectedRef?.selling_price || selectedRef?.listing_price) || "";

    return currentAssistant.firstMessageTemplate
      .replace("{owner_first_name}", ownerFirst)
      .replace("{agent_first_name}", agentFirst)
      .replace("{agent_company}", company)
      .replace("{reference_address}", refAddr)
      .replace("{sold_price}", price)
      .replace(/\s+/g, " ")
      .trim();
  })();

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
          referenceLeadId: selectedRef?.id || null,
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
      <div className="relative w-full max-w-lg bg-card rounded-2xl border border-violet-500/30 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-violet-500/20 rounded-full blur-[60px]" />

        <div className="relative z-10 p-6 space-y-4 overflow-y-auto">
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

          {/* Reference property picker */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Reference Property
            </p>
            {refLoading ? (
              <div className="flex items-center gap-2 p-3 text-xs text-on-surface-variant">
                <span className="h-3 w-3 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                Loading nearby properties...
              </div>
            ) : refOptions.length === 0 ? (
              <div className="p-3 rounded-xl border border-card-border bg-surface-container-lowest">
                <p className="text-xs text-on-surface-variant">
                  No MLS listings found. Import listings to reference nearby activity on calls.
                </p>
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto rounded-xl border border-card-border divide-y divide-card-border/50">
                {refOptions.map((ref) => (
                  <button
                    key={ref.id}
                    onClick={() => setSelectedRef(ref)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all ${
                      selectedRef?.id === ref.id
                        ? "bg-violet-500/10"
                        : "hover:bg-surface-container-high/30"
                    }`}
                  >
                    <div className={`w-1.5 h-8 rounded-full shrink-0 ${
                      selectedRef?.id === ref.id ? "bg-violet-500" : "bg-transparent"
                    }`} />
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      STATUS_COLORS[ref.listing_status || ""] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
                    }`}>
                      {ref.listing_status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">
                        {ref.property_address?.split(",")[0]}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-on-surface-variant shrink-0">
                      {formatPrice(ref.selling_price || ref.listing_price) || ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Live opening preview */}
          <div className="rounded-xl bg-surface-container-lowest border border-card-border p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              What the AI will say first
            </p>
            <p className="text-sm text-on-surface italic leading-relaxed">
              &ldquo;{previewMessage}&rdquo;
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
