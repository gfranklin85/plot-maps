"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Lead, LeadStatus, Priority } from "@/types";
import MapDynamic from "@/components/map/MapDynamic";
import type { PinMode } from "@/components/map/MapView";
import StreetViewProspecting from "@/components/map/StreetViewProspecting";
import PlacesSearch from "@/components/map/PlacesSearch";
import { PRIORITIES } from "@/lib/constants";
import { useProfile } from "@/lib/profile-context";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/ui/MaterialIcon";
import UpgradeGate from "@/components/ui/UpgradeGate";
import PropertyPopup from "@/components/map/PropertyPopup";

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
  const { user } = useAuth();
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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [pinnedRef, setPinnedRef] = useState<Lead | null>(null);
  const [expandedView, setExpandedView] = useState(false);
  const [pinMode, setPinMode] = useState<PinMode>('dots');
  const isSubscribed = profile.subscriptionStatus === 'active';

  useEffect(() => {
    if (profile.defaultMapCenter && !hasUserPanned) {
      setMapCenter(profile.defaultMapCenter);
    }
  }, [profile.defaultMapCenter, hasUserPanned]);

  useEffect(() => {
    async function fetchLeads() {
      if (!user) return;

      // Fetch user's own leads + shared context records
      const { data } = await supabase
        .from("leads")
        .select("*")
        .or(`user_id.eq.${user.id},record_type.eq.context`)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (data) setLeads(data as Lead[]);
      setLoading(false);
    }
    fetchLeads();
  }, [user]);

  function refetchLeads() {
    if (!user) return;
    supabase.from("leads").select("*")
      .or(`user_id.eq.${user.id},record_type.eq.context`)
      .not("latitude", "is", null).not("longitude", "is", null)
      .then(({ data }) => { if (data) setLeads(data as Lead[]); });
  }

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
            className="group flex items-center gap-2 bg-surface text-white px-5 py-2.5 rounded-full shadow-2xl border border-card-border hover:bg-primary/20 transition-all"
          >
            <MaterialIcon icon="map" className="text-[18px] text-primary" />
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
          <div className="flex gap-0.5 bg-surface p-1 rounded-xl shadow-lg">
            {(["roadmap", "satellite", "hybrid"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setMapType(type)}
                className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  mapType === type
                    ? "bg-primary text-white"
                    : "text-on-surface-variant hover:text-white"
                }`}
              >
                {type === "roadmap" ? "Map" : type === "satellite" ? "Sat" : "Hybrid"}
              </button>
            ))}
          </div>

          {/* Listing filter */}
          <div className="flex gap-0.5 bg-surface p-1 rounded-xl shadow-lg">
            {[
              { key: 'all', label: 'All', dot: 'bg-primary' },
              { key: 'prospects', label: 'Prospects', dot: 'bg-orange-400' },
              { key: 'Active', label: 'Active', dot: 'bg-green-500' },
              { key: 'Sold', label: 'Sold', dot: 'bg-yellow-400' },
              { key: 'Pending', label: 'Pending', dot: 'bg-purple-500' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setListingFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  listingFilter === f.key
                    ? 'bg-surface-container text-white'
                    : 'text-on-surface-variant hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
                {f.label}
              </button>
            ))}
          </div>

          {/* Pins View Mode */}
          <div className="flex items-center gap-0.5 bg-surface p-1 rounded-xl shadow-lg">
            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider px-2">Pins</span>
            {([
              { mode: 'dots' as PinMode, icon: 'fiber_manual_record', label: 'Dots' },
              { mode: 'labels' as PinMode, icon: 'sell', label: 'Labels' },
              { mode: 'detail' as PinMode, icon: 'view_agenda', label: 'Cards' },
            ]).map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setPinMode(mode)}
                title={label}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                  pinMode === mode
                    ? 'bg-primary text-white'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <MaterialIcon icon={icon} className="text-[14px]" />
                {label}
              </button>
            ))}
          </div>

          {/* Walk Mode */}
          <button
            onClick={() => isSubscribed ? setWalkMode(true) : setShowGate(true)}
            title="Walk Mode"
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface text-on-surface-variant shadow-lg hover:text-primary transition-all"
          >
            <MaterialIcon icon="directions_walk" className="text-[20px]" />
          </button>

          {/* Filters */}
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            title="Filters"
            className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
              filtersOpen || hasActiveFilters
                ? "bg-primary text-white"
                : "bg-surface text-on-surface-variant hover:text-primary"
            }`}
          >
            <MaterialIcon icon="tune" className="text-[20px]" />
          </button>
        </div>
      )}

      {/* Collapsible filter panel */}
      {filtersOpen && !walkMode && (
        <div className="absolute top-16 right-4 z-10 w-72 bg-surface rounded-2xl p-5 shadow-2xl border border-card-border space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary">Refine Map</h3>
            <button onClick={() => setFiltersOpen(false)} className="text-secondary hover:text-primary transition-colors">
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary mb-2 block">Priority</label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => {
                const isActive = selectedPriority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedPriority(isActive ? "" : p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                      isActive
                        ? "bg-primary text-white"
                        : "bg-surface-container/50 text-on-surface-variant border border-card-border hover:border-primary/30 hover:text-white"
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
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary mb-2 block">City</label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full rounded-xl bg-surface/60 border border-card-border px-3 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All Cities</option>
              {distinctCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Source */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary mb-2 block">Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full rounded-xl bg-surface/60 border border-card-border px-3 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">All Sources</option>
              {distinctSources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary mb-2 block">Tags</label>
            {distinctTags.length === 0 ? (
              <p className="text-xs text-secondary italic">No tags yet</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                {distinctTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selectedTags.includes(tag)
                        ? "bg-primary/20 text-primary border-primary/30"
                        : "bg-surface-container/50 text-on-surface-variant border-card-border hover:border-primary/20 hover:text-white"
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
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-secondary mb-2 block">Property Type</label>
            <select
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-surface/60 border border-card-border px-3 py-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
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
            pinMode={pinMode}
            onLeadClick={(_id, lead) => { setSelectedLead(lead); setExpandedView(false); }}
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
            <div className="bg-surface/80 backdrop-blur-xl rounded-2xl border border-card-border p-5 flex items-center gap-4 shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-surface-container/50 flex items-center justify-center border border-card-border shrink-0">
                <MaterialIcon icon="add_location_alt" className="text-[24px] text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-on-surface font-bold text-sm">Import your first list</h3>
                <p className="text-secondary text-xs leading-relaxed">Drop a CSV to see pins appear on the map.</p>
              </div>
              <a href="/imports" className="px-4 py-2.5 bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 hover:opacity-90 transition-all whitespace-nowrap">
                Import
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ═══ PINNED REFERENCE SIDEBAR — persistent comp while prospecting ═══ */}
      {pinnedRef && !walkMode && (
        <div className="absolute left-0 top-0 h-full w-[400px] z-20 bg-card/95 backdrop-blur-xl border-r border-card-border shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-primary/10 border-b border-card-border shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Reference Property</span>
              <button onClick={() => setPinnedRef(null)} className="text-secondary hover:text-on-surface">
                <MaterialIcon icon="close" className="text-[18px]" />
              </button>
            </div>
            <p className="text-sm font-bold text-on-surface mt-1 truncate">{pinnedRef.property_address?.split(',')[0]}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PropertyPopup
              lead={pinnedRef}
              onUpdate={refetchLeads}
              onWalkHere={(lead) => {
                if (!isSubscribed) { setShowGate(true); return; }
                if (lead.latitude && lead.longitude) {
                  setMapCenter({ lat: lead.latitude, lng: lead.longitude });
                  setWalkMode(true);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ ACTIVE SELECTION CARD — bottom, changes with each click ═══ */}
      {selectedLead && !walkMode && (
        <div className={`absolute bottom-6 z-20 w-[380px] max-h-[60vh] overflow-y-auto rounded-2xl bg-card border border-card-border shadow-2xl ${pinnedRef ? 'left-[416px]' : 'left-6'}`}>
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="flex items-center gap-2">
              {/* Pin to sidebar as reference */}
              <button
                onClick={() => { setPinnedRef(selectedLead); setSelectedLead(null); }}
                className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
                title="Pin as reference property"
              >
                <MaterialIcon icon="push_pin" className="text-[14px]" />
                Pin
              </button>
              <button
                onClick={() => setExpandedView(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
              >
                <MaterialIcon icon="open_in_full" className="text-[14px]" />
                Expand
              </button>
            </div>
            <button onClick={() => setSelectedLead(null)} className="text-secondary hover:text-on-surface transition-colors">
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>
          <PropertyPopup
            lead={selectedLead}
            onUpdate={refetchLeads}
            onWalkHere={(lead) => {
              if (!isSubscribed) { setShowGate(true); return; }
              if (lead.latitude && lead.longitude) {
                setMapCenter({ lat: lead.latitude, lng: lead.longitude });
                setWalkMode(true);
                setSelectedLead(null);
              }
            }}
          />
        </div>
      )}

      {/* ═══ EXPANDED FULL SIDEBAR — deep dive on selected property ═══ */}
      {selectedLead && expandedView && !walkMode && (
        <div className="absolute right-0 top-0 h-full w-[440px] z-20 bg-card border-l border-card-border shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setPinnedRef(selectedLead); setExpandedView(false); setSelectedLead(null); }}
                className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
              >
                <MaterialIcon icon="push_pin" className="text-[14px]" />
                Pin as Reference
              </button>
              <button onClick={() => setExpandedView(false)} className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:underline">
                Collapse
              </button>
            </div>
            <button onClick={() => { setSelectedLead(null); setExpandedView(false); }} className="text-secondary hover:text-on-surface transition-colors">
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PropertyPopup
              lead={selectedLead}
              onUpdate={refetchLeads}
              onWalkHere={(lead) => {
                if (!isSubscribed) { setShowGate(true); return; }
                if (lead.latitude && lead.longitude) {
                  setMapCenter({ lat: lead.latitude, lng: lead.longitude });
                  setWalkMode(true);
                  setSelectedLead(null);
                  setExpandedView(false);
                }
              }}
            />
          </div>
        </div>
      )}

      <UpgradeGate feature="walkMode" show={showGate} onClose={() => setShowGate(false)} />
    </div>
  );
}
