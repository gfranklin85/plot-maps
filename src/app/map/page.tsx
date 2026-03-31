"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Lead, LeadStatus } from "@/types";
import MapDynamic from "@/components/map/MapDynamic";
import SearchInput from "@/components/ui/SearchInput";

const FILTER_TABS: { label: string; key: string; statuses: LeadStatus[] }[] = [
  { label: "All", key: "all", statuses: [] },
  { label: "New", key: "new", statuses: ["New"] },
  { label: "Hot Leads", key: "hot", statuses: ["Hot Lead"] },
  { label: "Interested", key: "interested", statuses: ["Interested"] },
  { label: "Follow-Up", key: "followup", statuses: ["Follow-Up"] },
  { label: "Called", key: "called", statuses: ["Called"] },
  { label: "Not Contacted", key: "not-contacted", statuses: ["Not Contacted"] },
];

export default function MapPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchLeads() {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (data) setLeads(data as Lead[]);
      setLoading(false);
    }
    fetchLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Filter by tab
    const tab = FILTER_TABS.find((t) => t.key === activeTab);
    if (tab && tab.statuses.length > 0) {
      result = result.filter((l) => tab.statuses.includes(l.status));
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.property_address?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [leads, activeTab, search]);

  // Compute summary counts
  const newCount = leads.filter((l) => l.status === "New").length;
  const followUpCount = leads.filter((l) => l.status === "Follow-Up").length;
  const hotCount = leads.filter((l) => l.status === "Hot Lead").length;

  return (
    <div className="relative h-[calc(100vh-5rem)] w-full">
      {/* Search overlay */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-3">
        <div className="flex-1 max-w-md">
          <SearchInput
            placeholder="Search area or address..."
            onChange={setSearch}
            className="shadow-lg"
          />
        </div>
      </div>

      {/* Filter tabs overlay */}
      <div className="absolute top-16 left-4 z-10">
        <div className="inline-flex items-center gap-1 rounded-full glass-card p-1 shadow-lg">
          {FILTER_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            const count =
              tab.key === "all"
                ? leads.length
                : leads.filter((l) => tab.statuses.includes(l.status)).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-white font-bold text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                {tab.label}
                <span
                  className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 text-[10px] ${
                    isActive
                      ? "bg-blue-100 text-blue-600"
                      : "bg-slate-200/60 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stat card overlay */}
      <div className="absolute top-28 left-4 z-10">
        <div className="glass-card rounded-2xl p-4 shadow-lg min-w-[180px]">
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
            Today&apos;s Potential
          </p>
          <p className="font-headline text-2xl font-extrabold text-slate-900">
            {leads.length}
          </p>
          <div className="flex flex-col gap-0.5 mt-1 text-xs">
            {newCount > 0 && (
              <span className="text-blue-600 font-medium">
                {newCount} New
              </span>
            )}
            {followUpCount > 0 && (
              <span className="text-amber-600 font-medium">
                {followUpCount} Follow-up
              </span>
            )}
            {hotCount > 0 && (
              <span className="text-emerald-600 font-medium">
                {hotCount} Hot Lead
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      {loading ? (
        <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
      ) : (
        <MapDynamic leads={filteredLeads} />
      )}
    </div>
  );
}
