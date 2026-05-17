"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Lead, LeadStatus, Priority } from "@/types";
import MapDynamic from "@/components/map/MapDynamic";
import type { PinMode } from "@/components/map/MapView";
import StreetViewProspecting from "@/components/map/StreetViewProspecting";
import ProspectSearch from "@/components/dashboard/ProspectSearch";
import { PRIORITIES } from "@/lib/constants";
import { useProfile } from "@/lib/profile-context";
import { useAuth } from "@/lib/auth-context";
import MaterialIcon from "@/components/ui/MaterialIcon";
import UpgradeGate from "@/components/ui/UpgradeGate";
import PropertyPopup from "@/components/map/PropertyPopup";
import ProspectListPanel from "@/components/map/ProspectListPanel";
import OnboardingTooltips from "@/components/ui/OnboardingTooltips";
import ProspectCoachOverlay from "@/components/map/ProspectCoachOverlay";
import Mobile3DCoachOverlay from "@/components/map/Mobile3DCoachOverlay";
import GamepadStatusChip from "@/components/map/GamepadStatusChip";
import MapReticle from "@/components/map/MapReticle";
import type { GamepadActions } from "@/components/map/GamepadFlightController";
import { useReticlePosition } from "@/lib/useReticlePosition";
import { playShotSound, type ShotChannel } from "@/lib/shotSounds";
import ShotAnimation, { type Shot } from "@/components/map/ShotAnimation";
import type { ParcelHitTester } from "@/components/map/ParcelOverlay";

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
  const { profile, updateProfile } = useProfile();
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
  // Map type is locked to Hybrid — satellite imagery + label overlay is the
  // only mode that makes sense for circle prospecting. The toggle was UI clutter.
  const [mapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const [listingFilters, setListingFilters] = useState<Set<string>>(new Set());
  // Zoning overlay is wired but not surfaced — the toggle didn't pull its
  // weight visually. Code stays for when we revive it with a better design.
  const [showZoning] = useState(false);
  // Parcel overlay — full Plot-owned parcel polygons from local DB. The
  // picker (Layer button on toolbar) controls visibility + color mode.
  const [showParcels, setShowParcels] = useState(false);
  const [parcelColorMode, setParcelColorMode] = useState<import('@/components/map/ParcelOverlay').ParcelColorMode>('land_use');
  const [layerPickerOpen, setLayerPickerOpen] = useState(false);
  const [view3D, setView3D] = useState(false);
  const has3DSupport = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const [show3DCoach, setShow3DCoach] = useState(false);
  // Two flight models for the gamepad. 'overhead' = free pan + rotate
  // (everyday work). 'airplane' = game-feel cockpit (throttle on left Y,
  // yaw on left X, climb/dive on right Y, bank on right X). Toggle with
  // the airplane button in the toolbar — only meaningful with a controller
  // plugged in. Airplane mode auto-engages 3D since steep tilt is the feel.
  const [flightMode, setFlightMode] = useState<'overhead' | 'airplane'>('overhead');

  // On mobile, default to tilted 3D view — that's where the magic is and
  // touch users can rotate freely to flatten it. Coach overlay teaches the
  // gestures on first visit. Desktop keeps view3D=false; cursor users
  // toggle the desktop 3D button explicitly.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile || !has3DSupport) return;
    setView3D(true);
    const dismissed = window.localStorage.getItem('plotmaps.coachDismissed.mobile3D') === '1';
    if (!dismissed) {
      const t = setTimeout(() => setShow3DCoach(true), 600);
      return () => clearTimeout(t);
    }
  }, [has3DSupport]);

  function dismiss3DCoach() {
    setShow3DCoach(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('plotmaps.coachDismissed.mobile3D', '1');
    }
  }
  const [walkMode, setWalkMode] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(profile.defaultMapCenter);
  const [hasUserPanned, setHasUserPanned] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [pinnedRef, setPinnedRef] = useState<Lead | null>(null);
  const [expandedLead, setExpandedLead] = useState<Lead | null>(null);
  const [pinMode, setPinMode] = useState<PinMode>('dots');
  const [prospectList, setProspectList] = useState<{ address: string; lat: number; lng: number; city: string | null; state: string | null; zip: string | null }[]>([]);
  const [showProspectPanel, setShowProspectPanel] = useState(false);
  const [prospectMode, setProspectMode] = useState(false);
  const [prospectToast, setProspectToast] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState<number | null>(null);

  // ── Airplane-mode reticle + grab state ──────────────────────────────
  // The reticle sits at screen center in airplane mode. Each frame, we
  // recompute which lead (if any) the reticle is hovering. When the user
  // presses LT while hovering, the lead is "grabbed" — Phase B1 just
  // stores the grab; Phase B2 will open menus off this state. Right-X
  // 2s hold while grabbed records an orbit direction (Phase B3 will
  // animate the orbit; B1 just stores the direction).
  const [reticleHovering, setReticleHovering] = useState(false);
  // Latest hover target as a ref so onShoot (fires inside the gamepad
  // RAF loop) can read the current value without re-deriving.
  const reticleTargetRef = useRef<Lead | null>(null);
  // Parallel ref for parcel-under-reticle. ParcelOverlay drives this via
  // its mouseover/mouseout listeners (mouse path) AND the gamepad
  // controller drives it via its per-frame parcel hit-test (reticle
  // path). Pin (reticleTargetRef) wins on overlap — the shoot handler
  // checks the lead ref first.
  const reticleParcelRef = useRef<{ apn: string; lat: number; lng: number } | null>(null);
  // ParcelOverlay writes its hit-tester here; the gamepad controller
  // reads it each frame to ask "what parcel is under the reticle pixel?"
  // Null while the layer is hidden or before features have loaded.
  const parcelHitTesterRef = useRef<ParcelHitTester | null>(null);
  // Brief toast surfaced when the shoot action can't fire (target rejects
  // the armed channel, or the target is a parcel without a Lead row).
  const [reticleToast, setReticleToast] = useState<string | null>(null);

  // ── Airplane-mode armed channel + shot animation ─────────────────────
  // The "weapon" the user is currently shooting with. X rotates through
  // text → mail → call. Default = text since it's the cheapest, fastest
  // first contact. Live ref mirrors the state so onShoot (inside the
  // gamepad RAF loop) reads the current value without re-creating the
  // actions object every rotate.
  const [armedChannel, setArmedChannel] = useState<ShotChannel>('text_invite');
  const armedChannelRef = useRef<ShotChannel>('text_invite');
  armedChannelRef.current = armedChannel;
  // Current shot animation; cleared after the visual finishes.
  const [shot, setShot] = useState<Shot | null>(null);
  const shotCounterRef = useRef<number>(0);

  // navigateTarget kept for compat with MapView's CenterController prop;
  // every flow now uses the camera choreographer's dispatchFlight() instead,
  // so this stays null in practice.
  const [navigateTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [flight, setFlight] = useState<(import('@/lib/useCameraChoreographer').FlyToOptions & { _id?: number }) | null>(null);
  const flightCounterRef = useRef(0);

  // Debug-only state for POI hover diagnosis. Gated to ?debug=hover URL
  // param so we can ship this without exposing it to regular users.
  // Toggles let us isolate the cause of the POI hover bug in airplane mode.
  const [debugSuspendMoveCamera, setDebugSuspendMoveCamera] = useState(false);
  const [debugUnmountController, setDebugUnmountController] = useState(false);
  const [debugForceFallbackPath, setDebugForceFallbackPath] = useState(false);
  const [debugTickleAfterMoveCamera, setDebugTickleAfterMoveCamera] = useState(false);

  // Dispatch a choreographed camera flight. Each call gets a unique _id so
  // the controller treats it as a fresh animation even if the target shape
  // matches the previous one.
  const dispatchFlight = useCallback((opts: import('@/lib/useCameraChoreographer').FlyToOptions) => {
    flightCounterRef.current += 1;
    setFlight({ ...opts, _id: flightCounterRef.current });
  }, []);
  const [showCoach, setShowCoach] = useState(false);
  const firstProspectClickRef = useRef(false);
  const isSubscribed = profile.subscriptionStatus === 'active';

  // Gamepad — auto-detected. Status drives the bottom-right chip; the map's
  // GamepadFlightController owns the input loop and reports up via
  // onGamepadStatusChange. Once a controller has ever connected this session,
  // we keep the chip mounted so disconnect events can announce themselves.
  const [gamepad, setGamepad] = useState<{ connected: boolean; everConnected: boolean }>({ connected: false, everConnected: false });
  const handleGamepadStatus = useCallback((connected: boolean) => {
    setGamepad(prev => ({ connected, everConnected: prev.everConnected || connected }));
  }, []);

  const searchParams = useSearchParams();
  const urlInitDone = useRef(false);
  const debugHoverMode = searchParams?.get('debug') === 'hover';

  useEffect(() => {
    if (urlInitDone.current) return;
    if (!searchParams) return;

    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const zoomStr = searchParams.get('zoom');
    const prospectParam = searchParams.get('prospect');
    const leadIdParam = searchParams.get('leadId');

    const lat = latStr ? parseFloat(latStr) : NaN;
    const lng = lngStr ? parseFloat(lngStr) : NaN;
    const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

    if (!hasCoords && !leadIdParam) return;

    urlInitDone.current = true;

    if (hasCoords) {
      setMapCenter({ lat, lng });
      setHasUserPanned(true);
      const zoom = zoomStr ? parseInt(zoomStr, 10) : 19;
      // Smooth fly-in instead of an instant snap. Slightly slower than
      // search picks (1100ms) since this is the user's "I just landed
      // here from somewhere else" moment and deserves a beat of context.
      dispatchFlight({
        center: { lat, lng },
        zoom: Number.isNaN(zoom) ? 19 : zoom,
        duration: 1100,
        easing: 'easeInOutCubic',
      });
    }

    if (prospectParam === '1') {
      setProspectMode(true);
      const dismissed = typeof window !== 'undefined'
        && window.localStorage.getItem('plotmaps.coachDismissed.prospect') === '1';
      if (!dismissed) setShowCoach(true);
    }

    if (leadIdParam && user) {
      supabase
        .from('leads')
        .select('*')
        .eq('id', leadIdParam)
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setPinnedRef(data as Lead);
        });
    }
  }, [searchParams, user, dispatchFlight]);

  function dismissCoach() {
    setShowCoach(false);
    // Arm a one-time zoom-nudge for the user's next prospect click — small
    // affirmation that "yes, that one" right after they dismiss the coach.
    firstProspectClickRef.current = true;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('plotmaps.coachDismissed.prospect', '1');
    }
  }

  function handleToggleProspectMode(lead?: Lead) {
    const entering = !prospectMode;
    setProspectMode(entering);
    if (entering && lead?.latitude && lead?.longitude) {
      // Smooth fly to the target property (zoom to house level for prospecting)
      dispatchFlight({
        center: { lat: lead.latitude, lng: lead.longitude },
        zoom: 19,
        duration: 700,
        easing: 'easeInOutCubic',
      });
    } else if (!entering) {
      setMapZoom(null); // reset to user-controlled zoom
    }
  }

  function addToProspectList(addresses: { address: string; lat: number; lng: number; city: string | null; state: string | null; zip: string | null }[]) {
    setProspectList(prev => {
      const existing = new Set(prev.map(a => a.address.split(',')[0].trim().toLowerCase()));
      const newAddrs = addresses.filter(a => !existing.has(a.address.split(',')[0].trim().toLowerCase()));
      return [...prev, ...newAddrs];
    });
  }

  function removeFromProspectList(address: string) {
    setProspectList(prev => prev.filter(a => a.address !== address));
  }

  async function handleMapClick(latLng: { lat: number; lng: number }) {
    if (!prospectMode) return;
    if (showCoach) dismissCoach();
    // First click after dismissing the coach gets a tiny affirming zoom nudge
    // toward the click point. Fires once, then disarms.
    if (firstProspectClickRef.current) {
      firstProspectClickRef.current = false;
      dispatchFlight({
        center: latLng,
        zoom: Math.min(20, (mapZoom ?? 19) + 0.5),
        duration: 350,
        easing: 'easeOutCubic',
      });
    }
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latlng: latLng }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.formatted_address) {
        addToProspectList([{
          address: data.formatted_address,
          lat: data.lat,
          lng: data.lng,
          city: data.city,
          state: data.state,
          zip: data.zip,
        }]);
        setProspectToast(data.formatted_address.split(',')[0]);
        setTimeout(() => setProspectToast(null), 2000);
      }
    } catch { /* silent */ }
  }

  function handleLeadClickInProspectMode(lead: Lead) {
    // In prospect mode, any pin with coordinates is selectable. Skiptrace
    // stubs and freshly-imported leads can be missing property_address until
    // the webhook fills it in — fall back to a coord-derived label so the
    // user can still drop them into the prospect list.
    if (prospectMode && lead.latitude != null && lead.longitude != null) {
      const address = lead.property_address?.trim() ||
        `${lead.latitude.toFixed(5)}, ${lead.longitude.toFixed(5)}`;
      addToProspectList([{
        address,
        lat: lead.latitude,
        lng: lead.longitude,
        city: lead.city || null,
        state: lead.state || null,
        zip: lead.zip || null,
      }]);
      setProspectToast(address.split(',')[0]);
      setTimeout(() => setProspectToast(null), 2000);
      return;
    }
    setSelectedLead(lead);
  }

  function clearProspectList() {
    setProspectList([]);
  }

  useEffect(() => {
    if (profile.defaultMapCenter && !hasUserPanned) {
      setMapCenter(profile.defaultMapCenter);
    }
  }, [profile.defaultMapCenter, hasUserPanned]);

  function toggleListingFilter(key: string) {
    setListingFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Expand map — nudge mobile browser chrome away
  function expandMap() {
    window.scrollTo(0, 1);
    try { document.documentElement.requestFullscreen?.(); } catch { /* not supported on all browsers */ }
  }

  useEffect(() => {
    async function fetchLeads() {
      if (!user) return;

      // Fetch user's own leads only (no shared data)
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("user_id", user.id)
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
      .eq("user_id", user.id)
      .not("latitude", "is", null).not("longitude", "is", null)
      .then(({ data }) => { if (data) setLeads(data as Lead[]); });
  }

  // Realtime: when a lead row owned by this user changes (e.g. the
  // Tracerfy webhook populates owner/phones), splice the new row into
  // local state so pins and the open popup update without a refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`leads-user-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as Lead;
          if (!next?.id) return;
          setLeads(prev => prev.map(l => l.id === next.id ? next : l));
          // Keep open popups in sync if they reference the changed lead.
          setSelectedLead(prev => prev?.id === next.id ? next : prev);
          setPinnedRef(prev => prev?.id === next.id ? next : prev);
          setExpandedLead(prev => prev?.id === next.id ? next : prev);
          // Toast on a completed skiptrace.
          if (next.skiptrace_status === 'completed' && next.phone) {
            const street = next.property_address?.split(',')[0] || 'Owner found';
            setProspectToast(`📞 ${street}`);
            setTimeout(() => setProspectToast(null), 3000);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = payload.new as Lead;
          if (!next?.id || next.latitude == null || next.longitude == null) return;
          setLeads(prev => prev.some(l => l.id === next.id) ? prev : [...prev, next]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

    if (listingFilters.size > 0) {
      result = result.filter((l) => {
        if (listingFilters.has('prospects') && !l.listing_status) return true;
        if (l.listing_status && listingFilters.has(l.listing_status)) return true;
        return false;
      });
    }

    return result;
  }, [leads, activeTab, search, selectedTags, selectedCity, selectedPriority, selectedSource, listingFilters]);

  // Targetable leads for airplane-mode reticle hover. Strip down to id +
  // lat/lng so the controller doesn't see the full Lead shape.
  const airplaneTargets = useMemo(() => {
    if (flightMode !== 'airplane') return [];
    return filteredLeads
      .filter(l => l.latitude != null && l.longitude != null)
      .map(l => ({ id: l.id, lat: l.latitude as number, lng: l.longitude as number }));
  }, [flightMode, filteredLeads]);

  // User-placed reticle position (localStorage-backed). The reticle
  // can be dragged anywhere on the map; this hook persists the position
  // and seeds the default. Both the visual MapReticle and the
  // controller's hit-test sample point read from this.
  const { position: reticlePosition, setPosition: setReticlePosition, resetPosition: resetReticlePosition } = useReticlePosition();

  // Lookup helper for resolving a target id back to a full Lead so the
  // grab handler can store the original Lead, not just the id.
  const leadsById = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of filteredLeads) m.set(l.id, l);
    return m;
  }, [filteredLeads]);

  const handleReticleTargetChange = useCallback(
    (target: { id: string; lat: number; lng: number } | null) => {
      if (target === null) {
        reticleTargetRef.current = null;
        // Reticle is "hovering" if a parcel is still under it, even when
        // the controller reports no lead. Pin precedence is enforced by
        // the grab handler reading reticleTargetRef first.
        setReticleHovering(reticleParcelRef.current !== null);
      } else {
        const lead = leadsById.get(target.id) || null;
        reticleTargetRef.current = lead;
        setReticleHovering(!!lead || reticleParcelRef.current !== null);
      }
    },
    [leadsById],
  );

  // ParcelOverlay tells us when the DOM cursor enters/leaves a parcel
  // polygon. In airplane mode the synthesized pointermove (commit e764410)
  // keeps these events firing under the stationary reticle during flight.
  // Pin DOM hover wins on overlap.
  const handleParcelHoverChange = useCallback(
    (apn: string | null, latLng: { lat: number; lng: number } | null) => {
      if (apn === null || latLng === null) {
        reticleParcelRef.current = null;
        setReticleHovering(reticleTargetRef.current !== null);
      } else {
        reticleParcelRef.current = { apn, lat: latLng.lat, lng: latLng.lng };
        setReticleHovering(true);
      }
    },
    [],
  );

  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);

  // ── Gamepad actions ─────────────────────────────────────────────────
  // Each action calls existing handlers — the controller is just a new
  // input device, not a new code path. Cycling logic sorts visible leads
  // by Haversine distance from the current map center so D-pad always
  // moves to the next-closest pin in the current view.
  const gamepadActions = useMemo<GamepadActions>(() => {
    function cycleLead(dir: 1 | -1) {
      if (!mapCenter || filteredLeads.length === 0) return;
      const leadsWithCoords = filteredLeads.filter(l => l.latitude != null && l.longitude != null);
      if (leadsWithCoords.length === 0) return;
      const dist = (l: Lead) => {
        const dLat = (l.latitude as number) - mapCenter.lat;
        const dLng = (l.longitude as number) - mapCenter.lng;
        return dLat * dLat + dLng * dLng; // squared distance is fine for ordering
      };
      const sorted = [...leadsWithCoords].sort((a, b) => dist(a) - dist(b));
      const currentIdx = selectedLead ? sorted.findIndex(l => l.id === selectedLead.id) : -1;
      const nextIdx = currentIdx === -1
        ? 0
        : (currentIdx + dir + sorted.length) % sorted.length;
      const next = sorted[nextIdx];
      setSelectedLead(next);
      if (next.latitude != null && next.longitude != null) {
        dispatchFlight({
          center: { lat: next.latitude, lng: next.longitude },
          duration: 350,
          easing: 'easeOutCubic',
        });
      }
    }

    function showReticleToast(message: string) {
      setReticleToast(message);
      window.setTimeout(() => setReticleToast(null), 2400);
    }

    const CHANNEL_ROTATION: ShotChannel[] = ['text_invite', 'direct_mail', 'phone_call'];

    return {
      onShoot: () => {
        // A — fire the armed channel at whatever's under the reticle.
        // Lead wins over parcel on overlap. Parcels can't fire (no
        // Lead row to send against yet) — toast suggests pinning.
        const lead = reticleTargetRef.current;
        const parcel = reticleParcelRef.current;
        if (!lead && !parcel) return;  // empty reticle — silent no-op

        const channel = armedChannelRef.current;

        if (parcel && !lead) {
          showReticleToast('Pin this parcel to your list first to fire.');
          return;
        }
        if (!lead) return;

        // Channel-specific can-fire checks. If the target rejects the
        // armed channel, toast and bail — user rotates with X and tries
        // again.
        if (channel === 'text_invite' && lead.text_declined) {
          showReticleToast('Text declined here. Press X to switch channel.');
          return;
        }
        if (channel === 'phone_call' && !lead.phone && !lead.phone_2 && !lead.phone_3) {
          showReticleToast('No phone on file. Press X to switch channel.');
          return;
        }

        // Fire the shot — visual + sound run in parallel with the API
        // dispatch so the user feels the trigger pull instantly.
        shotCounterRef.current += 1;
        setShot({
          id: shotCounterRef.current,
          channel,
          xFraction: reticlePosition.xFraction,
          yFraction: reticlePosition.yFraction,
        });
        window.setTimeout(() => setShot(null), 320);
        try { playShotSound(channel); } catch { /* ignore */ }

        void (async () => {
          try {
            await fetch('/api/inquiry/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId: lead.id,
                channel,
                ...(channel === 'phone_call' ? { phase: 'primer' } : {}),
              }),
            });
          } catch (err) {
            console.error('onShoot inquiry/send failed', err);
          }
        })();
      },
      onRotateChannel: () => {
        // X — cycle armed channel. Local state is the source of truth
        // for the current session; we don't persist to /api/profile/
        // arm-channel here because rotation is a frequent gameplay
        // gesture and we don't want a network round-trip per press.
        setArmedChannel(curr => {
          const idx = CHANNEL_ROTATION.indexOf(curr);
          return CHANNEL_ROTATION[(idx + 1) % CHANNEL_ROTATION.length];
        });
      },
      onInspect: () => {
        // Y — open info card for the hovered target only. Empty reticle
        // is a no-op (game-loop contract). Lead wins over parcel.
        const lead = reticleTargetRef.current;
        if (lead) {
          setSelectedLead(lead);
          return;
        }
        const parcel = reticleParcelRef.current;
        if (parcel) {
          const stub: Lead = {
            id: `parcel:${parcel.apn}`,
            user_id: '',
            name: '',
            property_address: null,
            owner_name: null,
            phone: null,
            phone_2: null,
            phone_3: null,
            email: null,
            status: 'New',
            latitude: parcel.lat,
            longitude: parcel.lng,
            created_at: new Date().toISOString(),
          } as unknown as Lead;
          setSelectedLead(stub);
        }
      },
      onCancel: () => {
        if (walkMode) { setWalkMode(false); return; }
        if (selectedLead) setSelectedLead(null);
      },
      onCyclePrev: () => cycleLead(-1),
      onCycleNext: () => cycleLead(1),
    };
    // handleMapClick is stable enough; including all deps would re-create
    // the actions every render. The ones that matter for behavior change
    // (selectedLead, walkMode, etc.) are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead, mapCenter, filteredLeads, walkMode, dispatchFlight, reticlePosition]);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] md:h-[calc(100vh-5rem)] w-full">
      {/* ═══ CONTROLS ═══ */}
      {walkMode ? (
        <button
          onClick={() => { setWalkMode(false); setMapZoom(18); }}
          className="absolute top-1/2 -translate-y-1/2 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-xl bg-surface/90 backdrop-blur-sm text-primary shadow-lg hover:bg-primary hover:text-white transition-all"
          title="Back to Map"
        >
          <MaterialIcon icon="map" className="text-[20px]" />
        </button>
      ) : (
        <>
          {/* ── DESKTOP TOOLBAR ── */}
          <div className="absolute top-4 left-4 right-4 z-10 hidden md:flex items-center gap-2">
            {/* Search — collapsed to an icon by default; expands on click. */}
            {desktopSearchOpen ? (
              <div className="w-[24rem]">
                <ProspectSearch
                  compact
                  placeholder="Search your leads or any address..."
                  onSelect={(payload) => {
                    setMapCenter({ lat: payload.lat, lng: payload.lng });
                    setHasUserPanned(true);
                    dispatchFlight({
                      center: { lat: payload.lat, lng: payload.lng },
                      zoom: 19,
                      duration: 900,
                      easing: 'easeInOutCubic',
                    });
                    if (payload.leadId && user) {
                      supabase
                        .from('leads')
                        .select('*')
                        .eq('id', payload.leadId)
                        .eq('user_id', user.id)
                        .single()
                        .then(({ data }) => { if (data) setPinnedRef(data as Lead); });
                    }
                    setDesktopSearchOpen(false);
                  }}
                />
              </div>
            ) : (
              <button
                onClick={() => setDesktopSearchOpen(true)}
                title="Search address or lead"
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface text-on-surface-variant shadow-lg hover:text-primary transition-all"
              >
                <MaterialIcon icon="search" className="text-[20px]" />
              </button>
            )}

            <span className="flex-1" />

            {/* Listing filter — multi-select toggles. Prospect dot now matches the actual indigo prospect pin. */}
            <div className="flex gap-0.5 bg-surface p-1 rounded-xl shadow-lg">
              {[
                { key: 'prospects', label: 'Prospects', dot: 'bg-indigo-500' },
                { key: 'Active', label: 'Active', dot: 'bg-green-500' },
                { key: 'Sold', label: 'Sold', dot: 'bg-yellow-400' },
                { key: 'Pending', label: 'Pending', dot: 'bg-purple-500' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => toggleListingFilter(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                    listingFilters.has(f.key)
                      ? 'bg-surface-container text-white'
                      : listingFilters.size === 0
                        ? 'text-on-surface-variant/60 hover:text-white'
                        : 'text-on-surface-variant/30 hover:text-white'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${listingFilters.size === 0 || listingFilters.has(f.key) ? f.dot : 'bg-on-surface-variant/20'}`} />
                  {f.label}
                </button>
              ))}
            </div>

            {/* Pin Style */}
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

            {/* Prospect Selection Mode */}
            <button
              onClick={() => handleToggleProspectMode()}
              title={prospectMode ? 'Exit prospect selection' : 'Select prospects'}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                prospectMode ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant hover:text-primary'
              }`}
            >
              <MaterialIcon icon="ads_click" className="text-[20px]" />
            </button>

            {/* Layers button — toggles parcel polygon overlay and opens a
                small picker for color mode. The overlay is the Plot-owned
                parcel data (Kings County, etc.), rendered live as the user
                pans, color-driven by the picked attribute. */}
            <div className="relative">
              <button
                onClick={() => {
                  if (showParcels) {
                    setShowParcels(false);
                    setLayerPickerOpen(false);
                  } else {
                    setShowParcels(true);
                    setLayerPickerOpen(true);
                  }
                }}
                onContextMenu={(e) => { e.preventDefault(); setLayerPickerOpen(o => !o); }}
                title="Parcel layer (right-click for color modes)"
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                  showParcels ? 'bg-sky-500 text-white' : 'bg-surface text-on-surface-variant hover:text-sky-400'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">layers</span>
              </button>
              {layerPickerOpen && (
                <>
                  {/* Invisible scrim — click anywhere outside the picker
                      to dismiss it. Stays behind the picker (z-40 vs z-50)
                      and doesn't block the map under itself when off. */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setLayerPickerOpen(false)}
                  />
                <div className="absolute right-12 top-0 z-50 w-56 rounded-xl bg-surface border border-card-border shadow-xl p-2 space-y-1">
                  <div className="text-[9px] uppercase tracking-widest text-on-surface-variant px-2 pt-1 pb-0.5">
                    Parcel color
                  </div>
                  {([
                    { key: 'land_use',   label: 'Land use',        hint: 'R/C/M/Ag/Vacant' },
                    { key: 'value',      label: 'Net assessed $',  hint: 'Heatmap by value' },
                    { key: 'year_built', label: 'Year built',      hint: 'Age heatmap' },
                    { key: 'developed',  label: 'Developed',       hint: 'Has building vs vacant' },
                    { key: 'occupancy',  label: 'Owner-occupied',  hint: 'Coming soon' },
                    { key: 'none',       label: 'Outline only',    hint: 'No fill' },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setParcelColorMode(opt.key);
                        setLayerPickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-[11px] transition-colors ${
                        parcelColorMode === opt.key ? 'bg-sky-500/20 text-sky-300' : 'hover:bg-surface-container-high text-on-surface'
                      }`}
                    >
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-[9px] text-on-surface-variant">{opt.hint}</span>
                    </button>
                  ))}
                  <div className="text-[9px] text-on-surface-variant px-2 pt-1 pb-0.5 italic">
                    Polygons appear at zoom 14+
                  </div>
                </div>
                </>
              )}
            </div>

            {/* (3D-tilt toolbar button removed: mouse + shift handles
                tilt on the standard map; airplane mode brings real
                flight; photoreal admin toggle below brings the full
                3D world. A separate "3D" button was redundant noise.) */}

            {/* Photorealistic 3D Tiles toggle — admin-only. Lives here
                next to the rest of the map controls instead of buried
                in Settings, since this is where the admin is when
                deciding whether to fly the photoreal world or the
                standard vector map. Persists via the same profile
                flag the Settings toggle wrote to before. */}
            {profile.isAdmin && (
              <button
                onClick={() => updateProfile({ enable3DTilesAdmin: !profile.enable3DTilesAdmin })}
                title={profile.enable3DTilesAdmin ? 'Exit Photorealistic 3D Tiles' : 'Photorealistic 3D Tiles (admin)'}
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                  profile.enable3DTilesAdmin
                    ? 'bg-gradient-to-br from-amber-500 to-rose-500 text-white'
                    : 'bg-surface text-on-surface-variant hover:text-amber-400'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">terrain</span>
                <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-500 text-white text-[8px] font-bold tracking-wider">ADM</span>
              </button>
            )}

            {/* Airplane / cockpit flight mode. Game-feel input model:
                left stick = throttle + yaw, right stick = climb/dive +
                bank. Auto-engages 3D since the steep tilt is the feel.
                Only meaningful with a controller plugged in. */}
            <button
              onClick={() => {
                if (flightMode === 'overhead') {
                  if (!has3DSupport) {
                    alert('Airplane mode requires NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID with Photorealistic 3D Tiles enabled.');
                    return;
                  }
                  setFlightMode('airplane');
                  if (!view3D) setView3D(true);
                  // Cinematic engage — fly to the Approach band at the
                  // most-horizontal-allowable tilt. 65° is just shy of
                  // Maps' 67° vector-mode max; the last 2° sometimes
                  // gets edge-clamped. This lands the user right where
                  // flight feel kicks in.
                  dispatchFlight({
                    zoom: 18,
                    tilt: 65,
                    duration: 700,
                    easing: 'easeInOutCubic',
                  });
                } else {
                  setFlightMode('overhead');
                }
              }}
              title={flightMode === 'airplane' ? 'Exit airplane mode' : 'Airplane mode (gamepad flight feel)'}
              className={`relative w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                flightMode === 'airplane' ? 'bg-emerald-500 text-white' : 'bg-surface text-on-surface-variant hover:text-emerald-400'
              } ${!has3DSupport ? 'opacity-60' : ''}`}
            >
              <MaterialIcon icon="flight" className="text-[20px]" />
              {!has3DSupport && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

          </div>

          {/* ── MOBILE TOOLBAR ── */}
          <div className="absolute top-2 left-2 right-2 z-10 flex items-center gap-2 md:hidden">
            <div className="flex-1 min-w-0">
              <ProspectSearch
                compact
                placeholder="Search leads or addresses..."
                onSelect={(payload) => {
                  setMapCenter({ lat: payload.lat, lng: payload.lng });
                  setHasUserPanned(true);
                  dispatchFlight({
                    center: { lat: payload.lat, lng: payload.lng },
                    zoom: 19,
                    duration: 900,
                    easing: 'easeInOutCubic',
                  });
                  if (payload.leadId && user) {
                    supabase
                      .from('leads')
                      .select('*')
                      .eq('id', payload.leadId)
                      .eq('user_id', user.id)
                      .single()
                      .then(({ data }) => { if (data) setPinnedRef(data as Lead); });
                  }
                }}
              />
            </div>
            <button
              onClick={() => setMobileControlsOpen(o => !o)}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                mobileControlsOpen ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant'
              }`}
            >
              <MaterialIcon icon="tune" className="text-[20px]" />
            </button>
            <button
              onClick={() => isSubscribed ? setWalkMode(true) : setShowGate(true)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface text-on-surface-variant shadow-lg"
            >
              <MaterialIcon icon="directions_walk" className="text-[20px]" />
            </button>
            <button
              onClick={() => handleToggleProspectMode()}
              className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                prospectMode ? 'bg-primary text-white' : 'bg-surface text-on-surface-variant'
              }`}
            >
              <MaterialIcon icon="ads_click" className="text-[20px]" />
            </button>
          </div>

          {/* ── MOBILE CONTROLS SHEET ── */}
          {mobileControlsOpen && (
            <div className="absolute top-16 left-2 right-2 z-10 bg-surface rounded-2xl p-4 shadow-2xl border border-card-border space-y-4 md:hidden">
              {/* Listing filter — only control that earns its place on mobile.
                  Prospect dot is indigo to match the actual pin color. */}
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Show</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'prospects', label: 'Prospects', dot: 'bg-indigo-500' },
                    { key: 'Active', label: 'Active', dot: 'bg-green-500' },
                    { key: 'Sold', label: 'Sold', dot: 'bg-yellow-400' },
                    { key: 'Pending', label: 'Pending', dot: 'bg-purple-500' },
                  ].map((f) => (
                    <button key={f.key} onClick={() => toggleListingFilter(f.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${listingFilters.has(f.key) ? 'bg-surface-container text-white' : 'text-on-surface-variant/50'}`}>
                      <span className={`w-2 h-2 rounded-full ${listingFilters.size === 0 || listingFilters.has(f.key) ? f.dot : 'bg-on-surface-variant/20'}`} />
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Pin Style */}
              <div>
                <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Pin Style</p>
                <div className="flex gap-1">
                  {([
                    { mode: 'dots' as PinMode, label: 'Dots' },
                    { mode: 'labels' as PinMode, label: 'Labels' },
                    { mode: 'detail' as PinMode, label: 'Cards' },
                  ]).map(({ mode, label }) => (
                    <button key={mode} onClick={() => setPinMode(mode)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${pinMode === mode ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setMobileControlsOpen(false)} className="w-full py-2 text-xs font-bold text-primary">Done</button>
            </div>
          )}
        </>
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
            pinMode={pinMode}
            onExitWalk={() => setWalkMode(false)}
          />
        ) : (
          <MapDynamic
            leads={filteredLeads}
            mapType={mapType}
            pinMode={pinMode}
            prospectMode={prospectMode}
            prospectPins={prospectList.map(a => ({ lat: a.lat, lng: a.lng, address: a.address }))}
            onProspectPinClick={removeFromProspectList}
            showZoningOverlay={showZoning}
            showParcelOverlay={showParcels}
            parcelColorMode={parcelColorMode}
            onParcelHoverChange={handleParcelHoverChange}
            parcelHitTesterRef={parcelHitTesterRef}
            onParcelClick={(apn, latLng) => {
              // Open the standard PropertyPopup against this parcel click.
              // PropertyPopup loads /api/parcel?lat&lng internally and the
              // resolver returns the full assessor stack. We pass a minimal
              // Lead-shaped stub so the existing popup machinery doesn't
              // need to learn a separate parcel-only mode. The "apn"
              // becomes the stub id so React keys are stable for the
              // session.
              const stub: Lead = {
                id: `parcel:${apn}`,
                user_id: '',
                name: '',
                property_address: null,
                owner_name: null,
                phone: null,
                phone_2: null,
                phone_3: null,
                email: null,
                status: 'New',
                latitude: latLng.lat,
                longitude: latLng.lng,
                created_at: new Date().toISOString(),
              } as unknown as Lead;
              setSelectedLead(stub);
            }}
            view3D={view3D}
            flight={flight}
            navigateTo={navigateTarget}
            zoom={mapZoom}
            onLeadClick={(_id, lead) => { handleLeadClickInProspectMode(lead); }}
            onCenterChanged={(c) => { setMapCenter(c); setHasUserPanned(true); }}
            onMapClick={handleMapClick}
            center={mapCenter}
            onWalkHere={(lead) => {
              if (!isSubscribed) { setShowGate(true); return; }
              if (lead.latitude && lead.longitude) {
                setMapCenter({ lat: lead.latitude, lng: lead.longitude });
                setWalkMode(true);
              }
            }}
            gamepadEnabled={flightMode === 'airplane' && !debugUnmountController}
            gamepadActions={gamepadActions}
            gamepadMode={flightMode}
            gamepadDebugSuspendMoveCamera={debugSuspendMoveCamera}
            gamepadDebugForceFallbackPath={debugForceFallbackPath}
            gamepadDebugTickleAfterMoveCamera={debugTickleAfterMoveCamera}
            gamepadAirplaneTargets={airplaneTargets}
            gamepadReticleXFraction={reticlePosition.xFraction}
            gamepadReticleYFraction={reticlePosition.yFraction}
            onGamepadReticleTargetChange={handleReticleTargetChange}
            onGamepadParcelHoverChange={handleParcelHoverChange}
            onGamepadStatusChange={handleGamepadStatus}
          />
        )}

        {/* Center reticle — visible only in airplane mode. Position is
            user-draggable; useReticlePosition persists the choice in
            localStorage and double-click resets to default. The
            `grabbed` prop is gone with the LT grab-gate; the reticle
            now just shows "hovering or not" since shoot/inspect are
            edge-triggered A/Y presses, not held states. */}
        <MapReticle
          visible={!walkMode && flightMode === 'airplane'}
          hovering={reticleHovering}
          grabbed={false}
          xFraction={reticlePosition.xFraction}
          yFraction={reticlePosition.yFraction}
          onPositionChange={setReticlePosition}
          onResetPosition={resetReticlePosition}
        />

        {/* Shot animation — fires at the reticle position whenever A
            successfully dispatches an outreach. Cleared after ~320ms. */}
        <ShotAnimation shot={shot} />

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
        <div className="absolute right-0 top-0 h-full w-full md:w-[400px] z-20 bg-card/95 backdrop-blur-xl border-l border-card-border shadow-2xl flex flex-col overflow-hidden">
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
              onToggleProspectMode={() => handleToggleProspectMode(pinnedRef)}
              prospectMode={prospectMode}
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
        <div className="absolute bottom-14 md:bottom-6 left-0 right-0 md:right-auto md:left-6 z-20 w-full md:w-[380px] max-h-[50vh] md:max-h-[70vh] overflow-y-auto rounded-t-2xl md:rounded-2xl bg-card border border-card-border shadow-2xl">
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
                onClick={() => { setExpandedLead(selectedLead); setSelectedLead(null); }}
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
            onToggleProspectMode={() => handleToggleProspectMode(selectedLead)}
            prospectMode={prospectMode}
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
      {expandedLead && !walkMode && (
        <div className="absolute right-0 top-0 h-full w-full md:w-[440px] z-20 bg-card border-l border-card-border shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-card-border shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setPinnedRef(expandedLead); setExpandedLead(null); }}
                className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest hover:underline"
              >
                <MaterialIcon icon="push_pin" className="text-[14px]" />
                Pin as Reference
              </button>
              <button onClick={() => setExpandedLead(null)} className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:underline">
                Collapse
              </button>
            </div>
            <button onClick={() => setExpandedLead(null)} className="text-secondary hover:text-on-surface transition-colors">
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PropertyPopup
              lead={expandedLead}
              onUpdate={refetchLeads}
              onToggleProspectMode={() => handleToggleProspectMode(expandedLead)}
              prospectMode={prospectMode}
              onWalkHere={(lead) => {
                if (!isSubscribed) { setShowGate(true); return; }
                if (lead.latitude && lead.longitude) {
                  setMapCenter({ lat: lead.latitude, lng: lead.longitude });
                  setWalkMode(true);
                  setExpandedLead(null);
                }
              }}
            />
          </div>
        </div>
      )}

      <UpgradeGate feature="walkMode" show={showGate} onClose={() => setShowGate(false)} />

      {showCoach && !walkMode && (
        <ProspectCoachOverlay onDismiss={dismissCoach} />
      )}

      {show3DCoach && !walkMode && !showCoach && (
        <Mobile3DCoachOverlay onDismiss={dismiss3DCoach} />
      )}

      {/* Expand map — hides mobile browser chrome */}
      <button
        onClick={expandMap}
        className="md:hidden fixed bottom-20 right-4 z-30 w-9 h-9 rounded-full bg-surface-container/80 backdrop-blur border border-card-border shadow-lg flex items-center justify-center text-on-surface-variant active:scale-90 transition-transform"
        aria-label="Expand map"
      >
        <MaterialIcon icon="fullscreen" className="text-[20px]" />
      </button>

      {/* Prospect toast */}
      {prospectToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-xl text-sm font-semibold">
          + {prospectToast}
        </div>
      )}

      {/* Reticle toast — fired when the gamepad tries to fire-armed on a
          parcel grab (no Lead row exists yet). Surfaces just below the
          prospect toast so they never collide visually. */}
      {reticleToast && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-4 py-2 rounded-lg shadow-xl text-sm font-semibold">
          {reticleToast}
        </div>
      )}

      {/* Compact prospect bar — single row at bottom */}
      {(prospectMode || prospectList.length > 0) && !walkMode && !showProspectPanel && (
        <div className="fixed bottom-16 md:bottom-4 left-2 right-2 md:left-auto md:right-4 md:w-auto z-40 flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl shadow-2xl">
          <MaterialIcon icon="ads_click" className="text-[16px]" />
          <span className="text-sm font-bold">{prospectList.length} addresses</span>
          <span className="text-xs opacity-80">· ${(prospectList.length * 0.25).toFixed(2)}</span>
          <span className="flex-1" />
          {prospectList.length > 0 && (
            <button
              onClick={() => setShowProspectPanel(true)}
              className="px-3 py-1 rounded-lg bg-white/20 text-xs font-bold hover:bg-white/30 transition-colors"
            >
              Review
            </button>
          )}
          {prospectMode && (
            <button
              onClick={() => handleToggleProspectMode()}
              className="px-3 py-1 rounded-lg bg-white/20 text-xs font-bold hover:bg-white/30 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* Prospect list panel */}
      {showProspectPanel && (
        <ProspectListPanel
          addresses={prospectList}
          onRemove={removeFromProspectList}
          onClear={clearProspectList}
          onClose={() => setShowProspectPanel(false)}
        />
      )}

      <OnboardingTooltips />
      {gamepad.everConnected && <GamepadStatusChip connected={gamepad.connected} />}

      {/* Debug panel — gated on ?debug=hover URL param. Intentionally ugly;
       *  this is a one-time diagnostic tool, not a real feature. Revert
       *  the commit that added it once the POI hover bug is diagnosed. */}
      {debugHoverMode && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border-2 border-yellow-400 bg-black/90 p-3 text-xs text-white shadow-2xl max-w-xs">
          <div className="mb-2 font-bold text-yellow-300">HOVER DEBUG</div>
          <div className="mb-2 text-[10px] text-white/70 italic">Round 1 (diagnostic):</div>
          <label className="mb-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={debugSuspendMoveCamera}
              onChange={e => setDebugSuspendMoveCamera(e.target.checked)}
            />
            <span>Suspend moveCamera()</span>
          </label>
          <label className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={debugUnmountController}
              onChange={e => setDebugUnmountController(e.target.checked)}
            />
            <span>Unmount gamepad controller</span>
          </label>
          <div className="mt-2 mb-2 border-t border-white/20 pt-2 text-[10px] text-white/70 italic">
            Round 2 (fix exploration):
          </div>
          <label className="mb-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={debugForceFallbackPath}
              onChange={e => setDebugForceFallbackPath(e.target.checked)}
            />
            <span>Force fallback path (setCenter etc.)</span>
          </label>
          <label className="mb-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={debugTickleAfterMoveCamera}
              onChange={e => setDebugTickleAfterMoveCamera(e.target.checked)}
            />
            <span>Tickle setOptions after moveCamera</span>
          </label>
          <div className="mt-2 text-[10px] text-white/60">
            Test 1: all off (broken). Test 2: Force fallback ON. Test 3: Tickle ON.
            For each: hover work? flight smooth?
          </div>
        </div>
      )}
    </div>
  );
}
