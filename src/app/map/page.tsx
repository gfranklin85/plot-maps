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
import UpgradeGate from "@/components/ui/UpgradeGate";

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
  const [showGate, setShowGate] = useState(false);
  const isSubscribed = profile.subscriptionStatus === 'active';

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
            className="group flex items-center gap-2 bg-[#0c1324] text-white px-5 py-2.5 rounded-full shadow-2xl border border-white/10 hover:bg-indigo-500/20 transition-all"
          >
            <MaterialIcon icon="map" className="text-[18px] text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-widest">Back to Map</span>
          </button>
        </div>
      ) : (
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center gap-2">
          {/* Search */}
          <div className="flex-1 max-w-sm">
            <PlacesSearch
              onPlaceSelected={(place) => {
                setMapCenter({ lat: place.lat, lng: place.lng });
                setSearch(place.address);
              }}
              className="shadow-lg"
            />
          </div>

          {/* Map type toggle */}
          <div className="flex gap-0.5 bg-[#0c1324] p-1 rounded-xl shadow-lg">
            {(["roadmap", "satellite", "hybrid"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setMapType(type)}
                className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  mapType === type
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {type === "roadmap" ? "Map" : type === "satellite" ? "Sat" : "Hybrid"}
              </button>
            ))}
          </div>

          {/* Listing filter */}
          <div className="flex gap-0.5 bg-[#0c1324] p-1 rounded-xl shadow-lg">
            {[
              { key: 'all', label: 'All', dot: 'bg-indigo-500' },
              { key: 'prospects', label: 'Prospects', dot: 'bg-orange-400' },
              { key: 'Sold', label: 'Sold', dot: 'bg-green-500' },
              { key: 'Active', label: 'Active', dot: 'bg-blue-500' },
              { key: 'Pending', label: 'Pending', dot: 'bg-yellow-500' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setListingFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  listingFilter === f.key
                    ? 'bg-[#23293c] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
                {f.label}
              </button>
            ))}
          </div>

          {/* Walk Mode */}
          <button
            onClick={() => isSubscribed ? setWalkMode(true) : setShowGate(true)}
            title="Walk Mode"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#0c1324] text-slate-400 shadow-lg hover:text-indigo-400 transition-all"
          >
            <MaterialIcon icon="directions_walk" className="text-[20px]" />
          </button>

          {/* Filters */}
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            title="Filters"
            className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
              filtersOpen || hasActiveFilters
                ? "bg-indigo-600 text-white"
                : "bg-[#0c1324] text-slate-400 hover:text-indigo-400"
            }`}
          >
            <MaterialIcon icon="tune" className="text-[20px]" />
          </button>
        </div>
      )}

      {/* Collapsible filter panel */}
      {filtersOpen && !walkMode && (
        <div className="absolute top-16 right-4 z-10 w-72 bg-[#0c1324] rounded-2xl p-5 shadow-2xl border border-white/10 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Refine Map</h3>
            <button onClick={() => setFiltersOpen(false)} className="text-slate-500 hover:text-indigo-400 transition-colors">
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 block">Priority</label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => {
                const isActive = selectedPriority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedPriority(isActive ? "" : p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "bg-[#23293c]/50 text-slate-400 border border-white/5 hover:border-indigo-500/30 hover:text-white"
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
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 block">City</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-xl bg-[#070d1f]/60 border border-white/10 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="">All Cities</option>
              {distinctCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Source */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 block">Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full rounded-xl bg-[#070d1f]/60 border border-white/10 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="">All Sources</option>
              {distinctSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 block">Tags</label>
            {distinctTags.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No tags yet</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {distinctTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selectedTags.includes(tag)
                        ? "bg-indigo-500/20 text-indigo-200 border-indigo-500/30"
                        : "bg-[#23293c]/50 text-slate-400 border-white/5 hover:border-indigo-500/20 hover:text-white"
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
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 mb-2 block">Property Type</label>
            <select
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-[#070d1f]/60 border border-white/10 px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
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
              className="w-full py-3 bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 hover:opacity-90 transition-all text-xs uppercase tracking-widest"
            >
              Reset Filters
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
              if (!isSubscribed) { setShowGate(true); return; }
              if (lead.latitude && lead.longitude) {
                setMapCenter({ lat: lead.latitude, lng: lead.longitude });
                setWalkMode(true);
              }
            }}
          />
        )}

        {/* Empty state — bottom center */}
        {!loading && leads.length === 0 && !walkMode && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 w-full max-w-md z-10 px-6">
            <div className="bg-[#0c1324]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-5 flex items-center gap-4 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-[#23293c]/50 flex items-center justify-center border border-white/5 shrink-0">
                <MaterialIcon icon="add_location_alt" className="text-[24px] text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-slate-200 font-bold text-sm">Import your first list</h3>
                <p className="text-slate-500 text-xs leading-relaxed">Drop a CSV to see pins appear on the map.</p>
              </div>
              <a href="/imports" className="px-4 py-2.5 bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 hover:opacity-90 transition-all whitespace-nowrap">
                Import
              </a>
            </div>
          </div>
        )}
      </div>

      <UpgradeGate feature="walkMode" show={showGate} onClose={() => setShowGate(false)} />
    </div>
  );
}
