"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { INTENT_LABELS } from "@/types/campaign";
import type { CampaignWithReferences, CampaignProspect, CampaignStatus } from "@/types/campaign";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignWithReferences | null>(null);
  const [prospects, setProspects] = useState<CampaignProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [callResult, setCallResult] = useState<{ message: string; success: boolean } | null>(null);
  const [sortBy, setSortBy] = useState<"order" | "intent" | "status">("order");

  const fetchData = useCallback(async () => {
    try {
      const [campRes, prosRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`).then((r) => r.json()),
        fetch(`/api/campaigns/${id}/prospects`).then((r) => r.json()),
      ]);
      setCampaign(campRes);
      setProspects(Array.isArray(prosRes) ? prosRes : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleStatusChange(newStatus: CampaignStatus) {
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchData();
  }

  async function handleCallNext() {
    setCalling(true);
    setCallResult(null);

    try {
      const res = await fetch(`/api/campaigns/${id}/call`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        setCallResult({ success: false, message: data.message || data.error || "Call failed" });
        setCalling(false);
        return;
      }

      setCallResult({
        success: true,
        message: `Calling ${data.prospect_name} at ${data.prospect_address}`,
      });
      fetchData();
    } catch {
      setCallResult({ success: false, message: "Network error" });
    }
    setCalling(false);
  }

  const sortedProspects = [...prospects].sort((a, b) => {
    if (sortBy === "intent") {
      return (a.call_status || "").localeCompare(b.call_status || "");
    }
    if (sortBy === "status") {
      const order = { calling: 0, pending: 1, queued: 2, completed: 3, skipped: 4, failed: 5 };
      return (order[a.call_status] ?? 9) - (order[b.call_status] ?? 9);
    }
    return (a.call_order ?? 999) - (b.call_order ?? 999);
  });

  const pendingCount = prospects.filter((p) => p.call_status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="h-8 w-8 rounded-full border-3 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-8 text-center">
        <p className="text-on-surface-variant">Campaign not found</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => router.push("/campaigns")}
            className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-on-surface mb-2"
          >
            <MaterialIcon icon="arrow_back" className="text-[14px]" />
            All Campaigns
          </button>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">
            {campaign.name}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            AI: <span className="text-violet-400 font-semibold">{campaign.assistant_name}</span>
            {" "}&middot; {campaign.primary_reference_strategy === "fixed" ? "Fixed" : "Nearest"} reference strategy
          </p>
        </div>

        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <button
              onClick={() => handleStatusChange("active")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors"
            >
              <MaterialIcon icon="play_arrow" className="text-[18px]" />
              Activate
            </button>
          )}
          {campaign.status === "active" && (
            <>
              <button
                onClick={handleCallNext}
                disabled={calling || pendingCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {calling ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Dialing...
                  </>
                ) : (
                  <>
                    <MaterialIcon icon="call" className="text-[18px]" />
                    Call Next
                  </>
                )}
              </button>
              <button
                onClick={() => handleStatusChange("paused")}
                className="flex items-center gap-1 px-3 py-2 rounded-xl border border-card-border text-sm text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <MaterialIcon icon="pause" className="text-[16px]" />
                Pause
              </button>
            </>
          )}
          {campaign.status === "paused" && (
            <button
              onClick={() => handleStatusChange("active")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-colors"
            >
              <MaterialIcon icon="play_arrow" className="text-[18px]" />
              Resume
            </button>
          )}
        </div>
      </div>

      {callResult && (
        <div className={`mb-4 rounded-lg p-3 text-xs font-semibold ${callResult.success ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
          {callResult.message}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBox label="Total Prospects" value={campaign.total_prospects} />
        <StatBox label="Calls Made" value={campaign.calls_made} />
        <StatBox label="Answered" value={campaign.calls_answered} />
        <StatBox label="Remaining" value={pendingCount} highlight />
      </div>

      {/* Reference properties */}
      {campaign.reference_leads.length > 0 && (
        <div className="mb-6 rounded-xl bg-card border border-card-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Reference Properties
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {campaign.reference_leads.map((ref) => (
              <div key={ref.id} className="rounded-lg bg-surface-container-lowest border border-card-border/50 p-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    ref.listing_status === "Sold" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                    ref.listing_status === "Pending" ? "bg-violet-500/20 text-violet-400 border-violet-500/30" :
                    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  }`}>
                    {ref.listing_status}
                  </span>
                </div>
                <p className="text-sm font-semibold text-on-surface mt-1 truncate">
                  {ref.property_address?.split(",")[0]}
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  {[
                    ref.selling_price ? `$${Math.round(ref.selling_price / 1000)}K` : ref.listing_price ? `$${Math.round(ref.listing_price / 1000)}K` : null,
                    ref.dom != null ? `${ref.dom} DOM` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prospect table */}
      <div className="rounded-xl bg-card border border-card-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-card-border">
          <p className="text-sm font-bold text-on-surface">
            Prospects ({prospects.length})
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant">Sort:</span>
            {(["order", "status", "intent"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                  sortBy === s ? "bg-violet-500/20 text-violet-400" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto divide-y divide-card-border/50">
          {sortedProspects.map((p) => {
            const lead = p.lead;
            const intentObj = INTENT_LABELS.find((il) => il.value === (lead as unknown as Record<string, string>)?.intent_label);

            return (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-container-high/20 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <StatusDot status={p.call_status} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {lead?.owner_name || lead?.name || "Unknown"}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {lead?.property_address?.split(",")[0]}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {intentObj && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${intentObj.color}`}>
                      {intentObj.label}
                    </span>
                  )}
                  <span className="text-[10px] text-on-surface-variant/50 capitalize">
                    {p.call_status}
                  </span>
                </div>
              </div>
            );
          })}

          {prospects.length === 0 && (
            <div className="p-8 text-center text-sm text-on-surface-variant">
              No prospects added yet. Activate the campaign to add prospects automatically.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-card border border-card-border p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${highlight ? "text-violet-400" : "text-on-surface"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-zinc-400",
    queued: "bg-sky-400",
    calling: "bg-violet-400 animate-pulse",
    completed: "bg-emerald-400",
    skipped: "bg-orange-400",
    failed: "bg-red-400",
  };
  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[status] || "bg-zinc-400"}`} />;
}
