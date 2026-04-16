"use client";

import { useState, useEffect } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { WizardState } from "../CampaignWizard";
import type { Lead } from "@/types";

interface Props {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

const STATUS_COLORS: Record<string, string> = {
  Sold: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Pending: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  Active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function StepReferences({ state, update }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || search.length < 2) { setResults([]); return; }
    setLoading(true);
    const timer = setTimeout(async () => {
      const q = search.toLowerCase();
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .not("listing_status", "is", null)
        .or(`property_address.ilike.%${q}%,owner_name.ilike.%${q}%`)
        .limit(20);
      setResults((data as Lead[]) || []);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, user]);

  // Load initial results on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
        .not("listing_status", "is", null)
        .order("selling_date", { ascending: false, nullsFirst: false })
        .limit(20);
      setResults((data as Lead[]) || []);
    })();
  }, [user]);

  function toggleRef(lead: Lead) {
    const isSelected = state.referenceLeadIds.includes(lead.id);
    if (isSelected) {
      update({
        referenceLeadIds: state.referenceLeadIds.filter((id) => id !== lead.id),
        referenceLeads: state.referenceLeads.filter((l) => l.id !== lead.id),
      });
    } else if (state.referenceLeadIds.length < 3) {
      update({
        referenceLeadIds: [...state.referenceLeadIds, lead.id],
        referenceLeads: [...state.referenceLeads, lead],
      });
    }
  }

  const formatPrice = (p: number | null) => {
    if (!p) return null;
    if (p >= 1_000_000) return `$${(p / 1_000_000).toFixed(1)}M`;
    return `$${Math.round(p / 1000)}K`;
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-headline text-xl font-extrabold text-on-surface">
          Select Reference Properties
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Choose 1-3 nearby sold, pending, or active listings your AI will reference on calls.
        </p>
      </div>

      {/* Selected refs */}
      {state.referenceLeads.length > 0 && (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Selected ({state.referenceLeads.length}/3)
          </label>
          {state.referenceLeads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center justify-between p-3 rounded-xl border border-violet-500/30 bg-violet-500/5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[lead.listing_status || ""] || "bg-zinc-500/20 text-zinc-400"}`}>
                    {lead.listing_status}
                  </span>
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {lead.property_address?.split(",")[0]}
                  </p>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {[
                    formatPrice(lead.selling_price || lead.listing_price),
                    lead.dom != null ? `${lead.dom} DOM` : null,
                    lead.city,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button
                onClick={() => toggleRef(lead)}
                className="text-red-400 hover:text-red-300 ml-2"
              >
                <MaterialIcon icon="close" className="text-[16px]" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <MaterialIcon
          icon="search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by address or owner name..."
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-input-bg border border-input-border text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      {/* Results */}
      <div className="max-h-64 overflow-y-auto rounded-xl border border-card-border divide-y divide-card-border/50">
        {loading && (
          <div className="p-4 text-center text-xs text-on-surface-variant">Searching...</div>
        )}
        {!loading && results.length === 0 && (
          <div className="p-4 text-center text-xs text-on-surface-variant">
            {search.length >= 2 ? "No results found" : "Your MLS listings will appear here"}
          </div>
        )}
        {results
          .filter((r) => !state.referenceLeadIds.includes(r.id))
          .map((lead) => (
            <button
              key={lead.id}
              onClick={() => toggleRef(lead)}
              disabled={state.referenceLeadIds.length >= 3}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-500/5 transition-colors disabled:opacity-40"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[lead.listing_status || ""] || "bg-zinc-500/20 text-zinc-400"}`}>
                    {lead.listing_status}
                  </span>
                  <p className="text-sm font-medium text-on-surface truncate">
                    {lead.property_address?.split(",")[0]}
                  </p>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  {[
                    formatPrice(lead.selling_price || lead.listing_price),
                    lead.dom != null ? `${lead.dom} DOM` : null,
                    lead.city,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
              <MaterialIcon icon="add_circle" className="text-[20px] text-violet-400 shrink-0 ml-2" />
            </button>
          ))}
      </div>
    </div>
  );
}
