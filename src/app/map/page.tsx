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
import { usePhone } from "@/lib/phone-context";

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
  // Map type is locked to Hybrid — satellite imagery + label overlay is the
  // only mode that makes sense for circle prospecting. The toggle was UI clutter.
  const [mapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('hybrid');
  const [listingFilters, setListingFilters] = useState<Set<string>>(new Set());
  // Zoning overlay is wired but not surfaced — the toggle didn't pull its
  // weight visually. Code stays for when we revive it with a better design.
  const [showZoning] = useState(false);
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
  const [grabbedLead, setGrabbedLead] = useState<Lead | null>(null);
  const [orbitDirection, setOrbitDirection] = useState<'cw' | 'ccw' | null>(null);
  // Latest hover target as a ref so onGrabStart (which fires inside the
  // gamepad RAF loop) can read the current value without re-deriving.
  const reticleTargetRef = useRef<Lead | null>(null);
  // Grabbed lead as a ref so onFireArmed (also fires inside the RAF loop)
  // can read the current grabbed lead without the gamepadActions useMemo
  // having to re-create on every grab/release.
  const grabbedLeadRef = useRef<Lead | null>(null);
  // Open-grab mode state (page-level, not persisted in v1).
  const [grabMode, setGrabMode] = useState<'pin_only' | 'open_grab'>('pin_only');
  // When LT-press in open-grab mode finds no DOM hit, the controller asks us
  // to synthesize a click at the focal pixel. We set this flag so the
  // resulting Google click event (delivered via onMapClick) is captured as
  // the active synthetic grab instead of falling through to prospect mode.
  const pendingSyntheticGrabRef = useRef(false);
  // Synthetic grab data captured from a Google click event. Read by
  // onFireArmed when there's no grabbedLeadRef.
  const grabbedSyntheticRef = useRef<{ lat: number; lng: number; placeId: string | null } | null>(null);

  // navigateTarget kept for compat with MapView's CenterController prop;
  // every flow now uses the camera choreographer's dispatchFlight() instead,
  // so this stays null in practice.
  const [navigateTarget] = useState<{ lat: number; lng: number } | null>(null);
  const [flight, setFlight] = useState<(import('@/lib/useCameraChoreographer').FlyToOptions & { _id?: number }) | null>(null);
  const flightCounterRef = useRef(0);

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
  const { makeCall } = usePhone();
  const [gamepad, setGamepad] = useState<{ connected: boolean; everConnected: boolean }>({ connected: false, everConnected: false });
  const handleGamepadStatus = useCallback((connected: boolean) => {
    setGamepad(prev => ({ connected, everConnected: prev.everConnected || connected }));
  }, []);

  const searchParams = useSearchParams();
  const urlInitDone = useRef(false);

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

  async function handleMapClick(
    latLng: { lat: number; lng: number },
    opts?: { placeId?: string | null },
  ) {
    // Open-grab synthetic-click path: if the reticle synthesized a click and
    // we're waiting on a placeId+latLng, capture it as the active grab and
    // return early. The fire path (RT) reads grabbedSyntheticRef and sends
    // lat/lng to /api/inquiry/send. The Google info window is suppressed by
    // PoiClickCatcher when a placeId is present, so this doesn't pop anything.
    if (pendingSyntheticGrabRef.current) {
      pendingSyntheticGrabRef.current = false;
      grabbedSyntheticRef.current = {
        lat: latLng.lat,
        lng: latLng.lng,
        placeId: opts?.placeId || null,
      };
      return;
    }
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

  // Reticle screen-Y fraction for visual placement (controller updates
  // each frame as a function of camera tilt).
  const [reticleTopFraction, setReticleTopFraction] = useState(0.5);

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
        setReticleHovering(false);
      } else {
        const lead = leadsById.get(target.id) || null;
        reticleTargetRef.current = lead;
        setReticleHovering(!!lead);
      }
    },
    [leadsById],
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

    return {
      onPrimary: () => {
        // A — open popup. If no selection yet, pick nearest visible lead.
        if (selectedLead) return; // popup already shows when selectedLead is set
        if (!mapCenter) return;
        const withCoords = filteredLeads.filter(l => l.latitude != null && l.longitude != null);
        if (withCoords.length === 0) return;
        let nearest = withCoords[0];
        let nearestD = Infinity;
        for (const l of withCoords) {
          const dLat = (l.latitude as number) - mapCenter.lat;
          const dLng = (l.longitude as number) - mapCenter.lng;
          const d = dLat * dLat + dLng * dLng;
          if (d < nearestD) { nearestD = d; nearest = l; }
        }
        setSelectedLead(nearest);
      },
      onCancel: () => {
        if (walkMode) { setWalkMode(false); return; }
        if (selectedLead) setSelectedLead(null);
      },
      onSkiptrace: () => {
        // PropertyPopup owns the skiptrace UI; ensure the popup is open
        // first (the user can then press X again or click the button).
        // For now, surface the selection so the lines-of-light animation
        // is visible to the user. A future refactor can fire the lookup
        // directly via a ref into PropertyPopup.
        if (!selectedLead) return;
        // No-op for now — PropertyPopup auto-shows the trigger button
        // when the lead has no owner data. The user presses A first to
        // open the popup, then X is reserved for the skiptrace trigger.
        // We document this in the chip help so users know.
      },
      onDial: () => {
        if (!selectedLead) return;
        const phone = selectedLead.phone || selectedLead.phone_2 || selectedLead.phone_3;
        if (!phone) return;
        const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
        if (isDesktop) {
          makeCall(phone, selectedLead.owner_name || selectedLead.name || 'Unknown', selectedLead.id);
        } else {
          window.location.href = `tel:${phone}`;
        }
      },
      onCyclePrev: () => cycleLead(-1),
      onCycleNext: () => cycleLead(1),
      onDropProspect: () => {
        if (!mapCenter) return;
        // Reuse the bare-ground click path so the orange pin behaves
        // identically to a mouse-click drop. handleMapClick already
        // gates on prospectMode, so RB is a no-op outside it.
        if (!prospectMode) return;
        handleMapClick(mapCenter);
      },
      onRecenter: () => {
        if (!profile.defaultMapCenter) return;
        dispatchFlight({
          center: profile.defaultMapCenter,
          zoom: 14,
          duration: 1100,
          easing: 'easeInOutCubic',
        });
      },
      onToggleWalk: () => {
        if (!isSubscribed) return;
        setWalkMode(prev => !prev);
      },
      onGrabStart: () => {
        // LT pressed while reticle was hovering. Snapshot the lead the
        // reticle was over and store it; the rest of the app can consume
        // grabbedLead from state. Phase B1: just stores. Phase B2 will
        // open menus / cards off this state.
        const target = reticleTargetRef.current;
        if (target) {
          setGrabbedLead(target);
          grabbedLeadRef.current = target;
        }
      },
      onGrabEnd: () => {
        // LT released. Drop the grab. Orbit state (if any) ends here too.
        setGrabbedLead(null);
        grabbedLeadRef.current = null;
        grabbedSyntheticRef.current = null;
        pendingSyntheticGrabRef.current = false;
        setOrbitDirection(null);
      },
      onSyntheticGrab: (focalClientX: number, focalClientY: number) => {
        // Open-grab LT-press onset with no DOM hit. Synthesize a real
        // mouse click on the map's container at the focal pixel so
        // Google's own click listener resolves the property under the
        // reticle (placeId + lat/lng). The listener calls back into
        // handleMapClick, which sees pendingSyntheticGrabRef and
        // captures the result as grabbedSyntheticRef.
        pendingSyntheticGrabRef.current = true;
        grabbedSyntheticRef.current = null;
        // Hit-test the topmost element at the focal pixel and dispatch
        // a click event on it. Google's gmp-map-3d / classic Map listens
        // on its own container.
        const el = document.elementFromPoint(focalClientX, focalClientY);
        if (!el) {
          pendingSyntheticGrabRef.current = false;
          return;
        }
        const evt = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: focalClientX,
          clientY: focalClientY,
          view: window,
        });
        el.dispatchEvent(evt);
        // Clear the pending flag after a short window if Google didn't
        // pick up the synthesized click. Prevents a stuck pending flag
        // from capturing the next unrelated map click.
        setTimeout(() => {
          if (pendingSyntheticGrabRef.current) {
            pendingSyntheticGrabRef.current = false;
          }
        }, 500);
      },
      onOrbitInit: (direction) => {
        // Right-X held 2s in a direction while grabbed. B1 just records
        // the direction in state — actual orbit camera animation is
        // Phase B3. For now this is the hook the next phase plugs into.
        setOrbitDirection(direction);
      },
      onFireArmed: () => {
        // RT pressed while LT-grabbed. Read the user's armed channel and
        // dispatch /api/inquiry/send for whatever's grabbed. Two paths:
        //   1) grabbedLeadRef set → existing Lead, send by leadId.
        //   2) grabbedSyntheticRef set → open-grab on empty map; send by
        //      lat/lng. Server reverse-geocodes + auto-creates the Lead.
        const lead = grabbedLeadRef.current;
        const synthetic = grabbedSyntheticRef.current;
        if (!lead && !synthetic) return;
        void (async () => {
          try {
            const armedRes = await fetch('/api/profile/arm-channel', { method: 'GET' });
            const armed = await armedRes.json().catch(() => ({}));
            const channel = armed?.armed_channel;
            if (!channel) return;
            const phasePart = channel === 'phone_call' ? { phase: 'primer' } : {};
            const body = lead
              ? { leadId: lead.id, channel, ...phasePart }
              : {
                  lat: synthetic!.lat,
                  lng: synthetic!.lng,
                  placeId: synthetic!.placeId,
                  channel,
                  ...phasePart,
                };
            const res = await fetch('/api/inquiry/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            // If we just auto-created a Lead, refetch so the new marker
            // paints on the map.
            if (!lead && res.ok) {
              refetchLeads();
            }
          } catch (err) {
            console.error('onFireArmed inquiry/send failed', err);
          }
        })();
      },
    };
    // handleMapClick is stable enough; including all deps would re-create
    // the actions every render. The ones that matter for behavior change
    // (selectedLead, walkMode, prospectMode, etc.) are listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead, mapCenter, filteredLeads, walkMode, prospectMode, isSubscribed, makeCall, dispatchFlight, profile.defaultMapCenter]);

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

            {/* 3D toggle. Entering: Tilt3DController animates tilt to 67°.
                Exiting: dispatch a single flight that resets tilt to 0,
                heading to north, and zoom to 17 (street names visible)
                in one smooth motion — much nicer than the previous behavior
                of just snapping tilt to 0 with whatever rotation was left. */}
            <button
              onClick={() => {
                if (!has3DSupport) {
                  alert('3D requires NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID with Photorealistic 3D Tiles enabled in Google Cloud Console.');
                  return;
                }
                if (view3D) {
                  // Exiting — fly back to a clean overhead view
                  setView3D(false);
                  dispatchFlight({
                    tilt: 0,
                    heading: 0,
                    zoom: 17,
                    duration: 700,
                    easing: 'easeInOutCubic',
                  });
                } else {
                  setView3D(true);
                }
              }}
              title={has3DSupport ? (view3D ? 'Exit 3D' : 'View in 3D') : '3D not configured — set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID'}
              className={`relative w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                view3D ? 'bg-violet-500 text-white' : 'bg-surface text-on-surface-variant hover:text-violet-400'
              } ${!has3DSupport ? 'opacity-60' : ''}`}
            >
              <span className="text-[12px] font-black tracking-tighter">3D</span>
              {!has3DSupport && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
            </button>

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

            {/* Grab-mode toggle (airplane mode only). pin_only = reticle
                grabs only existing pins (free). open_grab = reticle can
                grab any property — synthesizes a click at the focal pixel
                so Google's picker resolves it. */}
            {flightMode === 'airplane' && (
              <button
                onClick={() => setGrabMode(m => (m === 'pin_only' ? 'open_grab' : 'pin_only'))}
                title={
                  grabMode === 'open_grab'
                    ? 'Open grab: reticle grabs any property (auto-creates a Lead on fire). Click to switch to pin-only.'
                    : 'Pin-only grab: reticle only grabs existing leads (free). Click to enable open grab.'
                }
                className={`w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all ${
                  grabMode === 'open_grab'
                    ? 'bg-emerald-500/80 text-white'
                    : 'bg-surface text-on-surface-variant hover:text-emerald-400'
                }`}
              >
                <MaterialIcon
                  icon={grabMode === 'open_grab' ? 'add_location' : 'place'}
                  className="text-[20px]"
                />
              </button>
            )}

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
            gamepadEnabled
            gamepadActions={gamepadActions}
            gamepadMode={flightMode}
            gamepadGrabMode={grabMode}
            gamepadAirplaneTargets={airplaneTargets}
            onGamepadReticleTargetChange={handleReticleTargetChange}
            onGamepadFocalScreenYChange={setReticleTopFraction}
            onGamepadStatusChange={handleGamepadStatus}
          />
        )}

        {/* Center reticle — visible only in airplane mode. Driven by
            page-level reticleHovering / grabbedLead state; the gamepad
            controller decides LT semantics from reticleHovering. */}
        <MapReticle
          visible={!walkMode && flightMode === 'airplane'}
          hovering={reticleHovering}
          grabbed={!!grabbedLead}
          topFraction={reticleTopFraction}
        />

        {/* Tiny orbit-direction indicator while grabbed + orbit set.
            B1 just shows we captured the dwell — B3 will animate orbit. */}
        {grabbedLead && orbitDirection && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 translate-y-8 rounded-full bg-emerald-500/85 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg"
          >
            Orbit {orbitDirection === 'cw' ? 'CW' : 'CCW'}
          </div>
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
    </div>
  );
}
