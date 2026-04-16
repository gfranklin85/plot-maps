"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import MaterialIcon from "@/components/ui/MaterialIcon";
import CampaignCard from "@/components/campaigns/CampaignCard";
import type { Campaign } from "@/types/campaign";

interface BroadcastSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  total_calls: number;
  total_answered: number;
  total_heard: number;
  total_press_1: number;
  total_press_2: number;
  total_press_3: number;
  created_at: string;
  sent_at: string | null;
}

type TabKey = "ai" | "broadcasts";

export default function CampaignsPage() {
  const [tab, setTab] = useState<TabKey>("ai");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (tab === "ai") {
      fetch("/api/campaigns").then(r => r.json()).then(setCampaigns).catch(() => {}).finally(() => setLoading(false));
    } else {
      fetch("/api/broadcast").then(r => r.json()).then(setBroadcasts).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab]);

  return (
    <div className="p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">Campaigns</h1>
          <p className="text-sm text-on-surface-variant mt-1">AI calls and broadcast outreach</p>
        </div>
        <Link
          href={tab === "ai" ? "/campaigns/new" : "/campaigns/broadcast/new"}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white font-bold text-sm shadow-[0_8px_25px_-5px_rgba(139,92,246,0.4)] hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <MaterialIcon icon="add" className="text-[18px]" />
          <span className="hidden sm:inline">{tab === "ai" ? "New AI Campaign" : "New Broadcast"}</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container-high p-1 rounded-xl mb-6 w-fit">
        {([
          { key: "ai" as TabKey, label: "AI Calls", icon: "smart_toy" },
          { key: "broadcasts" as TabKey, label: "Broadcasts", icon: "volume_up" },
        ]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === key
                ? "bg-primary text-white"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <MaterialIcon icon={icon} className="text-[16px]" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="h-8 w-8 rounded-full border-3 border-violet-500/30 border-t-violet-500 animate-spin" />
        </div>
      ) : tab === "ai" ? (
        /* AI Campaigns */
        campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
              <MaterialIcon icon="smart_toy" className="text-[32px] text-violet-400" />
            </div>
            <h2 className="text-lg font-bold text-on-surface">No AI campaigns yet</h2>
            <p className="text-sm text-on-surface-variant mt-1 max-w-sm">
              Create your first AI voice campaign to start automated circle prospecting calls.
            </p>
            <Link href="/campaigns/new" className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 text-white font-bold text-sm">
              <MaterialIcon icon="add" className="text-[18px]" />
              Create First Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )
      ) : (
        /* Broadcasts */
        broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
              <MaterialIcon icon="volume_up" className="text-[32px] text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-on-surface">No broadcasts yet</h2>
            <p className="text-sm text-on-surface-variant mt-1 max-w-sm">
              Send short market update audio to homeowners and capture intent signals.
            </p>
            <Link href="/campaigns/broadcast/new" className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm">
              <MaterialIcon icon="add" className="text-[18px]" />
              Create First Broadcast
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {broadcasts.map((b) => (
              <Link
                key={b.id}
                href={`/campaigns/broadcast/${b.id}`}
                className="bg-card rounded-2xl border border-card-border p-5 hover:border-emerald-500/30 transition-all group"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-on-surface group-hover:text-emerald-400 transition-colors truncate">{b.name}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    b.status === 'sending' ? 'bg-orange-500/10 text-orange-400' :
                    b.status === 'ready' ? 'bg-primary/10 text-primary' :
                    'bg-surface-container-high text-on-surface-variant'
                  }`}>{b.status}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-on-surface">{b.total_calls}</p>
                    <p className="text-[9px] text-on-surface-variant uppercase">Calls</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-400">{b.total_press_1}</p>
                    <p className="text-[9px] text-on-surface-variant uppercase">Curious</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-400">{b.total_press_2}</p>
                    <p className="text-[9px] text-on-surface-variant uppercase">Seller</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-on-surface-variant">{b.total_press_3}</p>
                    <p className="text-[9px] text-on-surface-variant uppercase">No</p>
                  </div>
                </div>
                <p className="text-[10px] text-on-surface-variant mt-3">
                  {b.sent_at ? `Sent ${new Date(b.sent_at).toLocaleDateString()}` : 'Not sent yet'}
                </p>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
