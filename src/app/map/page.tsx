"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Lead, LeadStatus, Priority } from "@/types";
import MapDynamic from "@/components/map/MapDynamic";
import SearchInput from "@/components/ui/SearchInput";
import { PRIORITIES } from "@/lib/constants";

const FILTER_TABS: { label: string; key: string; statuses: LeadStatus[] }[] = [
  { label: "All", key: "all", statuses: [] },
  { label: "New", key: "new", statuses: ["New"] },
  { label: "Hot Leads", key: "hot", statuses: ["Hot Lead"] },
  { label: "Interested", key: "interested", statuses: ["Interested"] },
  { label: "Follow-Up", key: "followup", statuses: ["Follow-Up"] },
  { label: "Called", key: "called", statuses: ["Called"] },
  { label: "Not Contacted", key: "not-contacted", statuses: ["Not Contacted"] },
];

const PRIORITY_BTN_STYLES: Record<Priority, { active: string; inactive: string }> = {
  high: {
    active: "bg-red-100 text-red-700 ring-1 ring-red-300",
    inactive: "text-red-600 hover:bg-red-50",
  },
  medium: {
    active: "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
    inactive: "text-amber-600 hover:bg-amber-50",
  },
  low: {
    active: "bg-slate-200 text-slate-700 ring-1 ring-slate-300",
    inactive: "text-slate-500 hover:bg-slate-50",
  },
};

export default function MapPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // New filter state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<Priority | "">("");
  const [selectedSource, setSelectedSource] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Derive distinct values from leads for filter dropdowns
  const distinctTags = useMemo(() => {
    const tagSet = new Set<string>();
    leads.forEach((l) => l.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [leads]);

  const distinctCities = useMemo(() => {
    const citySet = new Set<string>();
    leads.forEach((l) => {
      if (l.city) citySet.add(l.city);
    });
    return Array.from(citySet).sort();
  }, [leads]);

  const distinctSources = useMemo(() => {
    const srcSet = new Set<string>();
    leads.forEach((l) => {
      if (l.source) srcSet.add(l.source);
    });
    return Array.from(srcSet).sort();
  }, [leads]);

  const hasActiveFilters =
    selectedTags.length > 0 ||
    selectedCity !== "" ||
    selectedPriority !== "" ||
    selectedSource !== "";

  function resetFilters() {
    setSelectedTags([]);
    setSelectedCity("");
    setSelectedPriority("");
    setSelectedSource("");
    setActiveTab("all");
    setSearch("");
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const filteredLeads = useMemo(() => {
    let result = leads;

    // Filter by tab (status)
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

    // Filter by tags (OR within tags)
    if (selectedTags.length > 0) {
      result = result.filter((l) =>
        l.tags?.some((t) => selectedTags.includes(t))
      );
    }

    // Filter by city
    if (selectedCity) {
      result = result.filter((l) => l.city === selectedCity);
    }

    // Filter by priority
    if (selectedPriority) {
      result = result.filter((l) => l.priority === selectedPriority);
    }

    // Filter by source
    if (selectedSource) {
      result = result.filter((l) => l.source === selectedSource);
    }

    return result;
  }, [leads, activeTab, search, selectedTags, selectedCity, selectedPriority, selectedSource]);

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

        {/* Toggle filters button */}
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium shadow-lg transition-all ${
            filtersOpen || hasActiveFilters
              ? "bg-blue-600 text-white"
              : "glass-card text-slate-600 hover:text-slate-800"
          }`}
        >
          <span className="material-symbols-rounded text-[18px]">tune</span>
          Filters
          {hasActiveFilters && (
            <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
              {
                [selectedTags.length > 0, selectedCity, selectedPriority, selectedSource].filter(
                  Boolean
                ).length
              }
            </span>
          )}
        </button>
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

        {/* Lead count + Reset */}
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full glass-card px-3 py-1 text-xs font-medium text-slate-600 shadow-lg">
            Showing {filteredLeads.length} of {leads.length} leads
          </span>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="rounded-full glass-card px-3 py-1 text-xs font-medium text-red-600 shadow-lg hover:bg-red-50 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div className="absolute top-16 right-4 z-10 w-72 glass-card rounded-2xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Filters
            </h3>
            <button
              onClick={() => setFiltersOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>

          {/* Priority filter */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">
              Priority
            </label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => {
                const isActive = selectedPriority === p;
                const styles = PRIORITY_BTN_STYLES[p];
                return (
                  <button
                    key={p}
                    onClick={() =>
                      setSelectedPriority(isActive ? "" : p)
                    }
                    className={`flex-1 rounded-full px-2 py-1 text-xs font-medium capitalize transition-all ${
                      isActive ? styles.active : styles.inactive
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* City filter */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">
              City
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Cities</option>
              {distinctCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Source filter */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">
              Source
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Sources</option>
              {distinctSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Tags multi-select */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">
              Tags
            </label>
            {distinctTags.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No tags found</p>
            ) : (
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                {distinctTags.map((tag) => {
                  const isActive = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reset inside panel */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="w-full rounded-lg bg-slate-100 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {/* Stat card overlay */}
      <div className="absolute top-28 left-4 z-10 mt-8">
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
