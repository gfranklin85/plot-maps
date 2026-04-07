"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Lead, LeadStatus, Priority } from "@/types";
import MapDynamic from "@/components/map/MapDynamic";
import StreetViewProspecting from "@/components/map/StreetViewProspecting";
import PlacesSearch from "@/components/map/PlacesSearch";
import { PRIORITIES } from "@/lib/constants";
import { useProfile } from "@/lib/profile-context";
import MaterialIcon from "@/components/ui/MaterialIcon";

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

const MAP_TYPE_ICONS: Record<string, string> = {
  roadmap: "map",
  satellite: "satellite_alt",
  hybrid: "layers",
};

export default function MapPage() {
  const { profile } = useProfile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // Filter state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<Priority | "">("");
  const [selectedSource, setSelectedSource] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const [listingFilter, setListingFilter] = useState<string>('all');
  const [walkMode, setWalkMode] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(profile.defaultMapCenter);
  const [hasUserPanned, setHasUserPanned] = useState(false);

  useEffect(() => {
    if (profile.defaultMapCenter && !hasUserPanned) {
      setMapCenter(profile.defaultMapCenter);
    }
  }, [profile.defaultMapCenter, hasUserPanned]);

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

  const distinctTags = useMemo(() => {
    const tagSet = new Set<string>();
    leads.forEach((l) => l.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [leads]);

  const distinctCities = useMemo(() => {
    const citySet = new Set<string>();
    leads.forEach((l) => { if (l.city) citySet.add(l.city); });
    return Array.from(citySet).sort();
  }, [leads]);

  const distinctSources = useMemo(() => {
    const srcSet = new Set<string>();
    leads.forEach((l) => { if (l.source) srcSet.add(l.source); });
    return Array.from(srcSet).sort();
  }, [leads]);

  const hasActiveFilters =
    selectedTags.length > 0 || selectedCity !== "" || selectedPriority !== "" || selectedSource !== "";

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

    const tab = FILTER_TABS.find((t) => t.key === activeTab);
    if (tab && tab.statuses.length > 0) {
      result = result.filter((l) => tab.statuses.includes(l.status));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.property_address?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q)
      );
    }

    if (selectedTags.length > 0) {
      result = result.filter((l) => l.tags?.some((t) => selectedTags.includes(t)));
    }
    if (selectedCity) result = result.filter((l) => l.city === selectedCity);
    if (selectedPriority) result = result.filter((l) => l.priority === selectedPriority);
    if (selectedSource) result = result.filter((l) => l.source === selectedSource);

    if (listingFilter === 'prospects') {
      result = result.filter((l) => !l.listing_status);
    } else if (listingFilter === 'Sold' || listingFilter === 'Active' || listingFilter === 'Pending') {
      result = result.filter((l) => l.listing_status === listingFilter);
    }

    return result;
  }, [leads, activeTab, search, selectedTags, selectedCity, selectedPriority, selectedSource, listingFilter]);

  return (
    <div className="relative h-[calc(100vh-5rem)] w-full">
      {/* ═══ CONTROLS ═══ */}
      {walkMode ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => setWalkMode(false)}
            className="flex items-center gap-1.5 rounded-full bg-blue-600/90 backdrop-blur text-white px-4 py-2 text-xs font-bold shadow-lg hover:bg-blue-700 transition-all"
          >
            <span className="material-symbols-rounded text-[18px]">map</span>
            Back to Map
          </button>
        </div>
      ) : (
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
          {/* Search */}
          <div className="flex-1 max-w-md">
            <PlacesSearch
              onPlaceSelected={(place) => {
                setMapCenter({ lat: place.lat, lng: place.lng });
                setSearch(place.address);
              }}
              className="shadow-lg"
            />
          </div>

          {/* Map type — icon-only toggle */}
          <div className="inline-flex items-center gap-0.5 rounded-full glass-card/80 backdrop-blur p-1 shadow-lg">
            {(["roadmap", "satellite", "hybrid"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setMapType(type)}
                title={type === "roadmap" ? "Map" : type === "satellite" ? "Satellite" : "Hybrid"}
                className={`rounded-full w-8 h-8 flex items-center justify-center transition-all ${
                  mapType === type
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <span className="material-symbols-rounded text-[18px]">{MAP_TYPE_ICONS[type]}</span>
              </button>
            ))}
          </div>

          {/* Listing filter */}
          <div className="inline-flex items-center gap-0.5 rounded-full glass-card/80 backdrop-blur p-1 shadow-lg">
            {[
              { key: 'all', label: 'All' },
              { key: 'prospects', label: 'Prospects' },
              { key: 'Sold', label: '● Sold', color: 'text-green-600' },
              { key: 'Active', label: '◆ Active', color: 'text-orange-500' },
              { key: 'Pending', label: '◆ Pending', color: 'text-yellow-600' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setListingFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  listingFilter === f.key
                    ? 'bg-white font-bold text-blue-600 shadow-sm'
                    : `${f.color || 'text-slate-500'} hover:text-slate-700`
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Walk Mode — icon only */}
          <button
            onClick={() => setWalkMode(true)}
            title="Walk Mode"
            className="rounded-full w-9 h-9 flex items-center justify-center glass-card/80 backdrop-blur text-slate-600 shadow-lg hover:text-blue-600 hover:shadow-xl transition-all"
          >
            <span className="material-symbols-rounded text-[20px]">streetview</span>
          </button>

          {/* Filters — icon only */}
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            title="Filters"
            className={`rounded-full w-9 h-9 flex items-center justify-center shadow-lg transition-all ${
              filtersOpen || hasActiveFilters
                ? "bg-blue-600/90 backdrop-blur text-white"
                : "glass-card/80 backdrop-blur text-slate-600 hover:text-blue-600"
            }`}
          >
            <span className="material-symbols-rounded text-[20px]">tune</span>
          </button>
        </div>
      )}

      {/* Collapsible filter panel */}
      {filtersOpen && !walkMode && (
        <div className="absolute top-16 right-4 z-10 w-72 glass-card/90 backdrop-blur rounded-2xl p-4 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Filters</h3>
            <button onClick={() => setFiltersOpen(false)} className="text-slate-400 hover:text-slate-600">
              <span className="material-symbols-rounded text-[18px]">close</span>
            </button>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">Priority</label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => {
                const isActive = selectedPriority === p;
                const styles = PRIORITY_BTN_STYLES[p];
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedPriority(isActive ? "" : p)}
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

          {/* City */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">City</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Cities</option>
              {distinctCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Source */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Sources</option>
              {distinctSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">Tags</label>
            {distinctTags.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No tags found</p>
            ) : (
              <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                {distinctTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property Type */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-1 block">Property Type</label>
            <select
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">All Types</option>
              <option value="Multi-Family">Multi-Family</option>
              <option value="Apartment">Apartments</option>
              <option value="Duplex">Duplex</option>
              <option value="Triplex">Triplex</option>
              <option value="Land">Vacant Land</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

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

      {/* Map or Walk Mode */}
      <div className="relative h-full w-full">
        {loading ? (
          <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
        ) : walkMode ? (
          <StreetViewProspecting
            leads={filteredLeads}
            startPosition={mapCenter || undefined}
            onPositionChanged={setMapCenter}
          />
        ) : (
          <MapDynamic
            leads={filteredLeads}
            mapType={mapType}
            onCenterChanged={(c) => { setMapCenter(c); setHasUserPanned(true); }}
            center={mapCenter}
            onWalkHere={(lead) => {
              if (lead.latitude && lead.longitude) {
                setMapCenter({ lat: lead.latitude, lng: lead.longitude });
                setWalkMode(true);
              }
            }}
          />
        )}

        {/* Empty state — bottom left, translucent, out of the way */}
        {!loading && leads.length === 0 && !walkMode && (
          <div className="absolute bottom-6 left-6 z-10">
            <div className="glass-card/80 backdrop-blur rounded-2xl p-5 shadow-lg max-w-xs">
              <div className="flex items-start gap-3">
                <MaterialIcon icon="add_location_alt" className="text-[28px] text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">Import your first list</h3>
                  <p className="text-xs text-slate-500 mb-3">Drop a CSV to see pins appear on the map.</p>
                  <a href="/imports" className="inline-flex items-center gap-1.5 action-gradient text-white px-4 py-2 rounded-lg font-bold text-xs hover:shadow-lg transition-shadow">
                    <MaterialIcon icon="upload_file" className="text-[14px]" />
                    Import
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
