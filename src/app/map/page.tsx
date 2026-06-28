"use client";

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { gsap } from "gsap";
import { EasePack } from "gsap/EasePack";
gsap.registerPlugin(EasePack);
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
import { BuyerSettingsProvider } from "@/lib/buyer-settings/context";
// BuyerSettingsPanel import removed 2026-06-06 — only callsite is
// commented out at ~1144; restore the import alongside the mount when
// the panel returns.
import PlotPropertyHighlight from "@/components/map/PlotPropertyHighlight";
// InWorldPropertyCard corner-pop removed 2026-06-26 — it double-rendered
// over the dash sheet's SidebarPropertyCard. Component kept on disk; the
// single card surface is now SidebarPropertyCard inside MapSidebar.
// PlotSummonedMonument, PlotWorldPopover, PropertyCardBillboard were
// unmounted 2026-06-04 during the world-aware-interface rebuild (HTML
// easel direction + zoom isolation). Components remain on disk parked
// for re-mount when the new card surface is wired. Re-add the imports
// when those mounts come back.
import GroundGlow from "@/components/map/GroundGlow";
// AnchoredPropertyCard import dropped 2026-06-06 — superseded by the
// windshield-sticker model (PropertyStickerCard). Component file kept.
import PlotPinMarker from "@/components/map/PlotPinMarker";
import MarketRequestPrompt from "@/components/map/MarketRequestPrompt";
import type { RitualTetherHandle } from "@/components/map/RitualTether";
import ProspectListPanel from "@/components/map/ProspectListPanel";
import OnboardingTooltips from "@/components/ui/OnboardingTooltips";
import ProspectCoachOverlay from "@/components/map/ProspectCoachOverlay";
import Mobile3DCoachOverlay from "@/components/map/Mobile3DCoachOverlay";
import GamepadStatusChip from "@/components/map/GamepadStatusChip";
import MapSidebar from "@/components/map/MapSidebar";
import SidebarPropertyCard from "@/components/map/SidebarPropertyCard";
import { useMapMode } from "@/lib/useMapMode";
import FlightTuningPanel from "@/components/map/FlightTuningPanel";
import { useFlightTuning } from "@/lib/useFlightTuning";
import { useIdleDetection } from "@/lib/useIdleDetection";
import { usePoiVisibility } from "@/lib/usePoiVisibility";
import DestinationsPanel from "@/components/map/DestinationsPanel";
import AltitudeGauge from "@/components/map/AltitudeGauge";
import type { GamepadActions } from "@/components/map/GamepadFlightController";
import { useReticlePosition } from "@/lib/useReticlePosition";
import { playShotSound, type ShotChannel } from "@/lib/shotSounds";
import ShotProjectile, { type Shot, type ShotMechanism, SHOT_TOTAL_MS } from "@/components/map/ShotProjectile";
import SimpleLaser from "@/components/map/SimpleLaser";
import PerfHUD from "@/components/map/PerfHUD";
import type { ParcelHitTester } from "@/components/map/ParcelOverlay";
import { DESTINATIONS } from "@/lib/destinations";
import { useInitialMapCenter } from "@/lib/useInitialMapCenter";
import { useSpatialPrefetch } from "@/lib/useSpatialPrefetch";
import { getCachedParcel, primeGeomCache } from "@/lib/parcelCache";
import { cancelAutoPan } from "@/lib/cancelAutoPan";
import SplatHUDLayer from "@/components/splat/SplatHUDLayer";
import MapCompanionLayer from "@/components/map/MapCompanionLayer";

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
  // listingFilters: read-only after the 2026-05-17 toolbar strip-down.
  // The empty default Set means "show all listings"; the filter UI
  // came out, the query behavior stayed.
  const [listingFilters] = useState<Set<string>>(new Set());
  // Zoning overlay is wired but not surfaced — the toggle didn't pull its
  // weight visually. Code stays for when we revive it with a better design.
  const [showZoning] = useState(false);
  // Parcel overlay — full Plot-owned parcel polygons from local DB.
  // Color mode picker was removed from the toolbar strip-down (2026-
  // 05-17); we default to 'land_use' until we redesign that surface.
  const [showParcels, setShowParcels] = useState(false);
  const parcelColorMode: import('@/components/map/ParcelOverlay').ParcelColorMode = 'land_use';
  const has3DSupport = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const [show3DCoach, setShow3DCoach] = useState(false);
  // view3D / flightMode / walkMode are now DERIVED from the single mapMode
  // state machine (declared below, after dispatchFlight). They used to be
  // three independent booleans that desynced and trapped the user in 3D.

  // Pending "enter 3D" intents raised before the mapMode machine is
  // declared (mobile default, URL/destination arrivals). A single effect
  // after the machine applies them. Bumping the counter requests ENTER_3D.
  const [request3DCount, setRequest3DCount] = useState(0);
  const requestEnter3D = useCallback(() => setRequest3DCount((c) => c + 1), []);

  // On mobile, default to tilted 3D view — that's where the magic is and
  // touch users can rotate freely to flatten it. Coach overlay teaches the
  // gestures on first visit. Desktop keeps 2D; cursor users tap 3D
  // explicitly via the Mode Switch.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile || !has3DSupport) return;
    requestEnter3D();
    const dismissed = window.localStorage.getItem('plotmaps.coachDismissed.mobile3D') === '1';
    if (!dismissed) {
      const t = setTimeout(() => setShow3DCoach(true), 600);
      return () => clearTimeout(t);
    }
  }, [has3DSupport, requestEnter3D]);

  function dismiss3DCoach() {
    setShow3DCoach(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('plotmaps.coachDismissed.mobile3D', '1');
    }
  }
  // Initial map center prefers a URL-resolved destination over the
  // profile default. This is what prevents the "flash of Lemoore"
  // when a visitor arrives via /map?destination=acapulco — the map
  // mounts already framed on the destination instead of having to
  // animate over from the default center.
  const initialCenter = useInitialMapCenter(profile.defaultMapCenter);
  // urlResolvedCenter is true when the initial center came from URL
  // params (a destination slug or explicit lat/lng), not from the
  // profile default. We treat this as "user has navigated here on
  // purpose" so the profile-default sync effect below doesn't reset
  // their camera away from the destination they asked for.
  const urlResolvedCenter =
    !!initialCenter &&
    (!profile.defaultMapCenter ||
      initialCenter.lat !== profile.defaultMapCenter.lat ||
      initialCenter.lng !== profile.defaultMapCenter.lng);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(initialCenter);
  const [hasUserPanned, setHasUserPanned] = useState(urlResolvedCenter);
  const [showGate, setShowGate] = useState(false);
  const [selectedLeadRaw, setSelectedLeadRaw] = useState<Lead | null>(null);
  const selectedLead = selectedLeadRaw;
  // Ref to the gmp-map-3d element, forwarded from MapView3D. Used to
  // mount the AnchoredPropertyCard inside Google's 3D world so the
  // card tracks the building at world coordinates, not screen pixels.
  const map3DElRef = useRef<HTMLElement | null>(null);
  // Live first-person camera state forwarded from MapView3D. The
  // windshield-sticker popup reads this each frame to slide the
  // popup as the camera moves. Greg locked 2026-06-06.
  const cameraStateRef = useRef<{
    lat: number; lng: number; altitude: number;
    heading: number; pitch: number; range: number;
  } | null>(null);
  // Click context for the sticker: the screen pixel the user clicked +
  // the camera state at that frame. Set when a parcel click resolves;
  // cleared when the selection clears. The sticker uses these as the
  // zero-point for camera-delta-to-pixel-delta math.
  // stickerContext is retained ONLY for its writes inside the click /
  // shot-impact handlers (harmless no-ops now). The card no longer
  // renders from it — it pins to the parcel centroid instead. The value
  // binding is dropped (unused) to satisfy the prod build; the setter
  // stays so those handlers don't need surgery. Locked 2026-06-10.
  const [, setStickerContext] = useState<{
    screenX: number;
    screenY: number;
    camera: { lat: number; lng: number; altitude: number; heading: number; pitch: number };
  } | null>(null);
  // Ref to the RitualTether's imperative handle. We call retract()
  // when the popup dismisses so the vertical rebound beam collapses
  // cleanly. Greg locked 2026-05-28: dismiss reverses the ritual.
  const ritualTetherRef = useRef<RitualTetherHandle | null>(null);
  // Ref to the popover DOM element forwarded from AnchoredPropertyCard.
  // The ritual tether's beam tracks this element each frame so the
  // umbilical stays glued to the popup as the camera moves through
  // the world. Greg locked 2026-05-28 evening: "the bounce stays
  // with the UI, not the reticle."
  const popoverElRef = useRef<HTMLElement | null>(null);
  // Wrap setSelectedLead so dismiss (null) also retracts the tether
  // and clears the highlight APN. The card-anchor snapshot logic was
  // removed when the HTML PlotCardMarker3D was dropped — the in-world
  // tower+slab glb (PlotPropertyBeam) is the only card surface now and
  // it mounts at the property's own lat/lng.
  const setSelectedLead = (next: Lead | null | ((prev: Lead | null) => Lead | null)) => {
    setSelectedLeadRaw((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (resolved === null && prev !== null) {
        try { ritualTetherRef.current?.retract(); } catch { /* noop */ }
        setSelectedApn(null);
        setStickerContext(null);
      } else if (resolved !== null) {
        // EVERY selection mounts gmp elements (popover/marker/polygon)
        // that auto-pan the camera to frame themselves — brutal when the
        // target is close/under the camera. Pin the user's pose here, the
        // single chokepoint for all selection paths (parcel/POI/address/
        // pin/shot/search), so the camera never moves on select. The
        // camera belongs to the user. [[feedback-no-zoom-to-ui-messes-up-flight]]
        cancelAutoPan(map3DElRef.current);
        // Extract APN from parcel:<APN> stub ids so the monument layer
        // knows which buried monument to rise. Non-parcel selections
        // (gpoi, addr, mock, real leads) leave the APN untouched and
        // the layer simply doesn't rise anything.
        const id = resolved.id ?? '';
        if (typeof id === 'string' && id.startsWith('parcel:')) {
          setSelectedApn(id.slice('parcel:'.length));
        }
      }
      return resolved;
    });
  };
  // When the popup opens, attach the rebound beam to it so the beam
  // tracks the popup's screen position each frame as the camera moves.
  // The popover mounts asynchronously (polling for gmp-popover registration);
  // we poll the ref ourselves on a few RAF ticks until it's set.
  useEffect(() => {
    if (!selectedLead) return;
    let attempts = 0;
    let rafId: number | null = null;
    const tryAttach = () => {
      attempts += 1;
      const el = popoverElRef.current;
      if (el) {
        try { ritualTetherRef.current?.attachTo(el); } catch { /* noop */ }
        return;
      }
      if (attempts < 60) {
        rafId = requestAnimationFrame(tryAttach);
      }
    };
    rafId = requestAnimationFrame(tryAttach);
    return () => { if (rafId !== null) cancelAnimationFrame(rafId); };
  }, [selectedLead]);
  const [pinnedRef, setPinnedRef] = useState<Lead | null>(null);
  const [expandedLead, setExpandedLead] = useState<Lead | null>(null);
  // APN of the currently-selected property's parcel, surfaced upward
  // from PropertyCardBillboard's resolver. Feeds PlotPropertyHighlight
  // so the actual lot polygon (from PostGIS) outlines under the card.
  // Locked 2026-05-30 evening per the in-world stack spec.
  const [selectedApn, setSelectedApn] = useState<string | null>(null);
  // SPIKE (temp): zoom-out test — see backtick hotkey effect below.
  const [spikeZoom, setSpikeZoom] = useState(false);
  const mapWrapRef = useRef<HTMLDivElement | null>(null);
  // Every parcel near the camera has its monument pre-mounted (buried)
  // in its own backyard via PlotMonumentLayer. The hook re-fetches as
  // the camera flies; the layer mounts/unmounts glbs to match.
  // Pin-style toolbar pills were stripped 2026-05-17; default to 'dots'
  // until the pin-style chooser gets a redesign that earns the chrome.
  const pinMode: PinMode = 'dots';
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
  // reticleHovering: state was consumed by the removed MapReticle; the
  // CustomReticle in MapView3D now manages its own hover state via
  // hit-testing against the map element. These setReticleHovering
  // call sites are kept (as no-ops) because they live inside the
  // gamepad parcel-hit-test loop and removing them risks side effects.
  const setReticleHovering = (_v: boolean) => { void _v; /* no-op; reticle hover lives in MapView3D now */ };
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

  // Market-request prompt — surfaced when a visitor arrives from the
  // landing search bar at a place Plot doesn't cover, or when the
  // geocoder couldn't resolve their query at all. Locked 2026-05-29.
  // Drives the demand-capture funnel that feeds county rollout
  // (memory/project_rollout_as_marketing_surface.md).
  const [marketRequest, setMarketRequest] = useState<
    { query: string; mode: 'miss' | 'uncovered' } | null
  >(null);

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
  // The lead a shot was fired AT, if any, stashed at trigger time so the
  // projectile's onImpact can burst the card against it the frame the
  // round lands. Null = the shot flew over empty ground / a non-firable
  // target; the projectile still flies but nothing springs out.
  const shotTargetLeadRef = useRef<Lead | null>(null);
  // Selectable firing mechanism. 'mounted' = bottom-left straight shot;
  // 'highline' = bottom-center arc that lobs over the reticle and falls
  // onto it (replenishment-line gun). Persisted so it survives reloads
  // while tuning. Greg flips between them; default 'mounted'.
  const [shotMechanism, setShotMechanism] = useState<ShotMechanism>('mounted');
  const shotMechanismRef = useRef<ShotMechanism>('mounted');
  shotMechanismRef.current = shotMechanism;
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('plot:shotMechanism');
      if (saved === 'mounted' || saved === 'highline') setShotMechanism(saved);
    } catch { /* noop */ }
  }, []);
  const cycleShotMechanism = useCallback(() => {
    setShotMechanism(curr => {
      const next: ShotMechanism = curr === 'mounted' ? 'highline' : 'mounted';
      try { window.localStorage.setItem('plot:shotMechanism', next); } catch { /* noop */ }
      return next;
    });
  }, []);
  // Press M to flip the firing mechanism mid-flight (tuning toggle).
  // Ignored while typing in an input/textarea so search isn't hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'm' && e.key !== 'M') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable) return;
      cycleShotMechanism();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cycleShotMechanism]);

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

  // ── Map mode: the single source of truth ──────────────────────────
  // WORK_2D / FLY_3D / WALK. view3D, walkMode, and flightMode are all
  // DERIVED from this — they can no longer desync (the old "stuck in 3D"
  // bug). Transitions fly the camera (tilt flatten/re-tilt) via onFlight;
  // a blocked 3D request (no map-id) shows a toast.
  const {
    mode: mapMode,
    view3D,
    walkMode,
    flightMode,
    dispatch: mapModeDispatch,
  } = useMapMode({
    has3DSupport,
    onFlight: (intent) => dispatchFlight({
      tilt: intent.tilt,
      ...(intent.zoom != null ? { zoom: intent.zoom } : {}),
      duration: 700,
      easing: 'easeInOutCubic',
    }),
    onBlocked: () => {
      alert('3D flight requires NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID with Photorealistic 3D Tiles enabled.');
    },
  });

  // Apply pending "enter 3D" intents raised before the machine existed
  // (mobile default, URL/destination arrivals).
  useEffect(() => {
    if (request3DCount > 0) mapModeDispatch({ type: 'ENTER_3D' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request3DCount]);

  // Import-prompt dismiss state — seeded from localStorage so a user
  // who already X-ed the empty-state card doesn't see it again every
  // time they reload. Public visitors don't see the card at all
  // (gated by `user` truthiness below).
  const [importPromptDismissed, setImportPromptDismissed] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setImportPromptDismissed(
      window.localStorage.getItem('plotmaps.importPrompt.dismissed') === '1'
    );
  }, []);

  // Gamepad — auto-detected. Status drives the bottom-right chip; the map's
  // GamepadFlightController owns the input loop and reports up via
  // onGamepadStatusChange. Once a controller has ever connected this session,
  // we keep the chip mounted so disconnect events can announce themselves.
  const [gamepad, setGamepad] = useState<{ connected: boolean; everConnected: boolean }>({ connected: false, everConnected: false });
  const handleGamepadStatus = useCallback((connected: boolean) => {
    setGamepad(prev => ({ connected, everConnected: prev.everConnected || connected }));
  }, []);

  // Page-level gamepad listener so we know about a controller BEFORE
  // the airplane-mode GamepadFlightController is even mounted. Drives
  // the auto-switch into airplane mode below — user shouldn't have
  // to dig into a menu to "select controller mode."
  const [pageGamepadConnected, setPageGamepadConnected] = useState(false);

  // Gamepad presence drives mode: connecting from the flat work map
  // auto-selects flight; disconnecting just drops the cockpit feel (no
  // forced return to 2D — that was the old mid-flight jolt).
  useEffect(() => {
    mapModeDispatch({ type: pageGamepadConnected ? 'GAMEPAD_CONNECTED' : 'GAMEPAD_DISCONNECTED' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageGamepadConnected]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ── Why this is more elaborate than a plain gamepadconnected listener ──
    // Per docs/controller-setup.md, Steam Input is configured to consume
    // A/B/X/Y, D-pad, and right-stick (under LB) at the OS layer — they
    // never reach the browser's Gamepad API. Chrome only "wakes" gamepad
    // detection after the page receives a raw button/axis event from a
    // gamepad. With Steam swallowing the buttons users typically press
    // first, the `gamepadconnected` event may never fire, leaving
    // pageGamepadConnected false, flightMode stuck in 'overhead', and
    // the useGamepad RAF loop in MapView3D disabled.
    //
    // The fix: poll navigator.getGamepads() for activity on inputs that
    // Steam leaves raw (left stick, triggers, bumpers). Any non-zero
    // axis or button.value flips pageGamepadConnected to true. We also
    // keep the seed scan + native events for the cases where they DO
    // work (no Steam, or browser already woken from a prior session).

    let cancelled = false;
    let isConnected = false;            // sticky — once true, only a
                                        // native gamepaddisconnected event
                                        // (or the seed scan finding nothing
                                        // at next mount) ever flips it back.
    const setConnected = (v: boolean) => {
      if (cancelled || v === isConnected) return;
      isConnected = v;
      setPageGamepadConnected(v);
    };

    const scanForActivity = (): boolean => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (!p || !p.connected) continue;
        // Any axis past the dead zone counts as "live"
        for (const a of p.axes) {
          if (Math.abs(a) > 0.15) return true;
        }
        // Any button pressed (including triggers, where .value > 0)
        for (const b of p.buttons) {
          if (b && (b.pressed || (typeof b.value === 'number' && b.value > 0.1))) return true;
        }
      }
      return false;
    };

    const scanForConnected = (): boolean => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (p && p.connected) return true;
      }
      return false;
    };

    // Seed: if the browser already knows about a connected pad (page
    // reload with controller already paired), accept it immediately.
    if (scanForConnected()) setConnected(true);

    // ── Sticky-true activity poll ──────────────────────────────────
    // We only ever flip pageGamepadConnected to true via this poll.
    // We never flip it back to false based on activity-going-quiet,
    // because:
    //   1. The browser may still see the pad as "connected" when
    //      sticks are at rest (no activity ≠ no controller)
    //   2. On Steam Input setups, navigator.getGamepads() may return
    //      [null,null,null,null] entirely (Steam consumes all events),
    //      so "no connected pads" is not authoritative either
    //   3. The previous version flipped false the instant the user
    //      released the sticks, which killed mid-flight steering — the
    //      bug Greg hit 2026-05-29.
    // Disconnect is ONLY ever fired by the native gamepaddisconnected
    // event (real unplug / controller death) or by the unmount path.
    const pollId = window.setInterval(() => {
      if (isConnected) return; // already detected; nothing to do
      if (scanForActivity() || scanForConnected()) setConnected(true);
    }, 250);

    // Native events: connect immediately wakes us; disconnect is the
    // ONE legitimate "lost gamepad" signal we trust.
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      // Only mark disconnected if no other pads remain. Multi-pad
      // setups shouldn't false-disconnect when pad #2 unplugs.
      if (!scanForConnected()) setConnected(false);
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  // (Gamepad → mode is now handled by the mapMode machine effect above.)

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
    const destinationParam = searchParams.get('destination');
    // Search-first landing routes here with the visitor's query in ?q,
    // and ?miss=1 when the geocoder couldn't resolve it. We surface the
    // MarketRequestPrompt either way — for misses (geocoder failed) we
    // show it immediately; for hits (lat/lng present) we still capture
    // the query for the demand-capture funnel in case the destination
    // isn't yet covered by Plot's property data.
    const queryParam = searchParams.get('q');
    const missParam = searchParams.get('miss');
    if (queryParam && missParam === '1') {
      setMarketRequest({ query: queryParam, mode: 'miss' });
    }

    // ?view=3d / ?view=2d — the office "Fly the market" vs "2D work map"
    // doors set this. The map otherwise always boots WORK_2D, so without
    // this both doors landed on the flat 2D map. (3D falls back to 2D on
    // unsupported devices via the has3DSupport guard in requestEnter3D.)
    const viewParam = searchParams.get('view');
    if (viewParam === '3d') {
      requestEnter3D();
    }
    // (2d is the default boot mode, so ?view=2d needs no action.)

    // Resolve ?destination=<slug> to lat/lng + full camera pose via the
    // destinations catalog (shared with the landing carousel). When
    // matched, the visitor's camera lands at the exact authored framing
    // the screenshot was taken from — the match-cut zoom-through arrival.
    // Unmatched slugs fall through silently — the map boots at the
    // profile default and the visitor can still navigate.
    let lat = latStr ? parseFloat(latStr) : NaN;
    let lng = lngStr ? parseFloat(lngStr) : NaN;
    let resolvedDestinationZoom: number | null = null;
    let resolvedDestinationHeading: number | null = null;
    let resolvedDestinationTilt: number | null = null;
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      if (destinationParam) {
        const match = DESTINATIONS.find(d => d.slug === destinationParam);
        if (match) {
          lat = match.pose.lat;
          lng = match.pose.lng;
          // Aerial framing for destination arrivals — high enough that
          // the visitor sees the city sprawl, low enough that detail
          // reads. The map's own controls let them descend further.
          resolvedDestinationZoom = 17;
          resolvedDestinationHeading = match.pose.heading;
          // Convert first-person pitch (0=horizon, -45=looking 45° down)
          // to Map3D tilt (0=top-down, 85=horizon-level).
          // pitch=0 (horizon-level) → tilt=85 (Google's max)
          // pitch=-45 (looking down 45°) → tilt=45
          // pitch=-90 (straight down) → tilt=0
          // Formula: tilt = 90 + pitch, clamped to [0, 85]
          const tilt = Math.max(0, Math.min(85, 90 + match.pose.pitch));
          resolvedDestinationTilt = tilt;
          // FORCE 3D MODE on destination arrival. The whole point of
          // clicking a destination card is the cinematic 3D approach;
          // landing in 2D is dead-on-arrival. Locked 2026-05-30 after
          // Greg flew Lemoore from the landing card and got dropped
          // into the flat 2D map. Mobile + 3D-unsupported devices
          // fall back to 2D via the has3DSupport check in MapDynamic.
          requestEnter3D();
        }
      }
    }
    // Also force 3D when arriving with an explicit lat/lng (search
    // bar Places autocomplete hits). Search-first landing assumes
    // the spatial experience; 2D is the operator dashboard default,
    // not the public-arrival default.
    if (
      (queryParam || destinationParam) &&
      !Number.isNaN(lat) && !Number.isNaN(lng)
    ) {
      requestEnter3D();
    }
    const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

    if (!hasCoords && !leadIdParam) return;

    urlInitDone.current = true;

    if (hasCoords) {
      setMapCenter({ lat, lng });
      setHasUserPanned(true);
      const zoomFromQuery = zoomStr ? parseInt(zoomStr, 10) : NaN;
      const zoom = !Number.isNaN(zoomFromQuery)
        ? zoomFromQuery
        : (resolvedDestinationZoom ?? 19);
      // Smooth fly-in instead of an instant snap. Slightly slower than
      // search picks (1100ms) since this is the user's "I just landed
      // here from somewhere else" moment and deserves a beat of context.
      dispatchFlight({
        center: { lat, lng },
        zoom,
        // When arriving from a destination card, also align the camera
        // heading + tilt to the authored pose so the visitor lands in
        // exactly the framing the destination screenshot promised.
        ...(resolvedDestinationHeading !== null
          ? { heading: resolvedDestinationHeading }
          : {}),
        ...(resolvedDestinationTilt !== null
          ? { tilt: resolvedDestinationTilt }
          : {}),
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

  // toggleListingFilter and the listingFilters chrome were removed
  // 2026-05-17 in the toolbar strip-down. The listingFilters state
  // remains for the filtered-leads query (default empty Set = show all).

  // Expand map — nudge mobile browser chrome away
  function expandMap() {
    window.scrollTo(0, 1);
    try { document.documentElement.requestFullscreen?.(); } catch { /* not supported on all browsers */ }
  }

  useEffect(() => {
    async function fetchLeads() {
      if (!user) {
        // Public visitor — no leads to fetch, but the map must still
        // render. Flip loading off so the skeleton stops blocking the
        // map. Mock listings flow through a separate public endpoint
        // and pin themselves via filteredLeads. Locked 2026-05-30
        // after Greg confirmed unauth visitors saw an infinite cream
        // skeleton on /map.
        setLoading(false);
        return;
      }

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

  // ── Mock listings (June 9 KCBOR demo) ──────────────────────────
  // Fetched once on map mount, merged into the pin pipeline alongside
  // the user's own leads. Each carries id prefix mock- so PropertyPopup
  // can surface the DEMO DATA badge for honesty during committee
  // browsing. Removed when the real RESO/IDX feed flows June 18+.
  const [mockListings, setMockListings] = useState<Lead[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/mock-listings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.listings && Array.isArray(data.listings)) {
          setMockListings(data.listings as Lead[]);
        }
      })
      .catch(() => { /* silent — pins still render from leads */ });
    return () => { cancelled = true; };
  }, []);

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
    // Mock listings always join the pin pipeline regardless of the
    // user's filter tab — the June 9 demo needs them visible whether
    // the user is viewing "All", "Hot", "Listings", etc. They pass
    // through search + tag + city filters unchanged.
    let result = [...leads, ...mockListings];

    const tab = FILTER_TABS.find((t) => t.key === activeTab);
    if (tab && tab.statuses.length > 0) {
      // Keep mock listings (they carry listing_status, not lead status)
      result = result.filter((l) => l.id.startsWith('mock-') || tab.statuses.includes(l.status));
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
  }, [leads, mockListings, activeTab, search, selectedTags, selectedCity, selectedPriority, selectedSource, listingFilters]);

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
  const { position: reticlePosition, setPosition: setReticlePosition } = useReticlePosition();
  // LB-held + right stick moves the fixed reticle (set-and-forget cursor).
  // The 3D loop hands us per-frame viewport-fraction deltas; we accumulate
  // into the stored position. [[controller-cursor-model]]
  const handleMoveReticle = useCallback((dxFrac: number, dyFrac: number) => {
    setReticlePosition({
      xFraction: reticlePosition.xFraction + dxFrac,
      yFraction: reticlePosition.yFraction + dyFrac,
    });
  }, [reticlePosition.xFraction, reticlePosition.yFraction, setReticlePosition]);

  // Camera-driven parcel prefetch — silently caches parcels in view (and
  // a margin ahead) into the in-memory parcelCache so clicks/shots resolve
  // instantly with no spinner. Disabled in walk mode. THE primary latency
  // win for the Google-native map. See useSpatialPrefetch / parcelCache.
  useSpatialPrefetch({ mapElRef: map3DElRef, enabled: !walkMode });
  // Monument viewport mass-mount REMOVED 2026-05-31. Greg's call: pre-
  // mounting 1000 buried glbs per viewport is the wrong axis. The
  // monument spawns ON the selected parcel only (1, not 1000). When
  // we re-introduce it, mount it on `selectedApn` directly at the
  // parcel's stored monument_lat/lng — no viewport fetch needed.
  // Flight feel tuning — single master multiplier + preset chips.
  // Lives in a toolbar-opened panel; live-previews changes while open.
  const { tuning: flightTuning, setMultiplier: setFlightMultiplier, setClimbRate: setFlightClimbRate, setTurnRate: setFlightTurnRate, setTiltRate: setFlightTiltRate, resetToDefault: resetFlightTuning } = useFlightTuning();
  const [flightTuningOpen, setFlightTuningOpen] = useState(false);
  // Destinations overlay — curated cities + search + Home. Sets
  // flyToTarget which MapView3D animates the camera toward.
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [flyToTarget, setFlyToTarget] = useState<{
    lat: number; lng: number; altitude: number; heading: number;
    pitch: number; range: number; durationMs?: number;
  } | null>(null);
  // Live altitude from the 3D path's per-frame loop. Drives the
  // AltitudeGauge HUD. Reported ~5×/sec from MapView3D.
  const [currentAltitudeM, setCurrentAltitudeM] = useState<number>(0);

  // Pause per-frame GPU writes when the user walks away with a
  // controller plugged in. 8s of no input on any surface (mouse,
  // keyboard, wheel, touch, gamepad sticks/triggers/buttons) flips
  // isIdle true. Any subsequent input flips it back instantly. The
  // 3D path reads this and gates its onFrame writes.
  const isIdle = useIdleDetection();

  // Google POI labels + business icons toggle. Default hidden for
  // immersive framing ("world is the canvas" — Google's products
  // aren't our product). The user can flip it on from the toolbar
  // when they need business context for prospecting.
  const { poisVisible, togglePois } = usePoiVisibility();

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


  // ── Shot impact → card burst ─────────────────────────────────────────
  // Fired by ShotProjectile the frame the round lands on the reticle.
  // If the shot was aimed at a firable lead (stashed at trigger time),
  // burst the property card out ABOVE the reticle — it springs up out of
  // the impact point and settles, which sells "you shot it out of the
  // property." Mirrors the click→sticker path: anchor above the reticle,
  // camera snapshot from the impact frame zero-points the delta math.
  const onShotImpact = useCallback((firedShot: Shot) => {
    const lead = shotTargetLeadRef.current;
    if (!lead) return; // shot flew over empty/non-firable ground
    const cam = cameraStateRef.current;
    // (camera auto-pan defense lives in the setSelectedLead wrapper now —
    // single chokepoint covers every selection path)
    setSelectedLead(lead);
    if (cam) {
      const rx = firedShot.xFraction * window.innerWidth;
      const ry = firedShot.yFraction * window.innerHeight;
      const ABOVE_RETICLE_GAP = 32;
      setStickerContext({
        screenX: rx,
        screenY: ry - ABOVE_RETICLE_GAP,
        camera: {
          lat: cam.lat,
          lng: cam.lng,
          altitude: cam.altitude,
          heading: cam.heading,
          pitch: cam.pitch,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // NO camera fly on selection. The camera belongs to the user; an
      // auto-zoom on cycle/select breaks flight (feedback-no-zoom-to-ui,
      // 2026-05-30). Selecting just surfaces the in-world card; the user
      // flies to it themselves if they want a closer look.
    }

    function showReticleToast(message: string) {
      setReticleToast(message);
      window.setTimeout(() => setReticleToast(null), 2400);
    }

    const CHANNEL_ROTATION: ShotChannel[] = ['text_invite', 'direct_mail', 'phone_call'];

    return {
      onShoot: () => {
        // A — ALWAYS fire a projectile + sound the instant the button is
        // pressed. The gun shoots whether or not anything's under the
        // reticle (Greg 2026-06-06: "press A and it immediately fire").
        // Whether the shot DOES anything — dispatch outreach + burst the
        // property card — is gated below on a valid lead.
        const channel = armedChannelRef.current;

        const fireProjectile = () => {
          shotCounterRef.current += 1;
          const newShot = {
            id: shotCounterRef.current,
            channel,
            xFraction: reticlePosition.xFraction,
            yFraction: reticlePosition.yFraction,
            mechanism: shotMechanismRef.current,
          };
          setShot(newShot);
          window.setTimeout(() => setShot(null), SHOT_TOTAL_MS + 40);
          try { playShotSound(channel); } catch { /* ignore */ }
          // Fire the laser BEAM at the reticle too (the flight fire action —
          // gamepad/phone trigger. SimpleLaser no longer keys off mouse
          // clicks; it listens for this event). Aim = the reticle pixel.
          try {
            window.dispatchEvent(new CustomEvent('plot:fire-laser', {
              detail: {
                x: reticlePosition.xFraction * window.innerWidth,
                y: reticlePosition.yFraction * window.innerHeight,
              },
            }));
          } catch { /* ignore */ }
        };

        const lead = reticleTargetRef.current;
        const parcel = reticleParcelRef.current;

        // ── Decide whether this shot lands on a firable target ──
        // A target that fails a check still gets the projectile (the gun
        // fired), but no burst/dispatch — and a toast tells the user why.
        let firableLead: Lead | null = null;
        if (lead) {
          if (channel === 'text_invite' && lead.text_declined) {
            showReticleToast('Text declined here. Press X to switch channel.');
          } else if (channel === 'phone_call' && !lead.phone && !lead.phone_2 && !lead.phone_3) {
            showReticleToast('No phone on file. Press X to switch channel.');
          } else {
            firableLead = lead;
          }
        } else if (parcel) {
          showReticleToast('Pin this parcel to your list first to fire.');
        }

        // Stash the target so the projectile's onImpact knows whether to
        // burst the card (and against which lead) the frame it lands.
        shotTargetLeadRef.current = firableLead;
        fireProjectile();

        if (!firableLead) return;

        // Dispatch the outreach in parallel — the user feels the trigger
        // pull instantly; the card burst happens on impact (onShotImpact).
        void (async () => {
          try {
            await fetch('/api/inquiry/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                leadId: firableLead.id,
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
        // NOTE 2026-06-10: X is now bound to onSummonCompanion. This
        // handler is kept but UNBOUND from the controller until the
        // outreach flow + channel-arming UI is finished. See
        // [[project-outreach-flow-unfinished]].
        setArmedChannel(curr => {
          const idx = CHANNEL_ROTATION.indexOf(curr);
          return CHANNEL_ROTATION[(idx + 1) % CHANNEL_ROTATION.length];
        });
      },
      onSummonCompanion: () => {
        // X / LB — call / dismiss OT. The companion layer lives in a
        // sibling subtree (no shared parent to prop-drill through), so we
        // bridge via a window event it listens for. Low coupling.
        window.dispatchEvent(new CustomEvent('plot:summon-ot'));
      },
      onBackOut: () => {
        // Back/Select — toggle the back-out (zoom-out to the void).
        setSpikeZoom(v => !v);
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
        if (walkMode) { mapModeDispatch({ type: 'EXIT_WALK' }); return; }
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

  // Live ref to onShoot so the keyboard fire key (below) can trigger the
  // exact same path as the gamepad A-press without re-creating handlers.
  const onShootRef = useRef<(() => void) | undefined>(undefined);
  onShootRef.current = gamepadActions.onShoot;
  // Keyboard FIRE — F or Space. The gamepad A-press is the canonical
  // trigger, but Steam Input can remap A at the OS layer so the browser
  // never sees it, and not everyone has a controller plugged in. F/Space
  // give a controller-free way to fire (esp. for tuning the projectile).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F' && e.key !== ' ') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      onShootRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Escape closes the property card (and exits walk mode) — mouse/keyboard
  // users shouldn't need a controller's B button to dismiss.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable) return;
      if (walkMode) { mapModeDispatch({ type: 'EXIT_WALK' }); return; }
      setSelectedLead(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkMode]);

  // SPIKE (temp): press backtick ` to toggle a CSS scale on the map
  // wrapper — testing whether Google's WebGL map survives being shrunk
  // (the "back out to a computer screen" trick). Remove after the test.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '`') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setSpikeZoom(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // GSAP-driven back-out. expoScale() makes the zoom read as a uniform,
  // continuous lens-pull (a plain ease looks like it speeds up/slows down
  // when scaling — wrong, breaks the freefall). 1↔0.55, with a small
  // upward translate so the map settles in the upper-center.
  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const toScale = spikeZoom ? 0.55 : 1;
    const fromScale = spikeZoom ? 1 : 0.55;
    const tween = gsap.to(el, {
      scale: toScale,
      yPercent: spikeZoom ? -6 : 0,
      duration: 0.85,
      ease: `expoScale(${fromScale}, ${toScale}, power2.inOut)`,
    });
    return () => { tween.kill(); };
  }, [spikeZoom]);

  // Audience derivation for the property card.
  //   public   — anyone unauthenticated, OR authed but unsubscribed.
  //              Sees Schedule Tour / Save / Share. MLS-compliant.
  //   agent    — paying subscriber. Sees Skip Trace / Postcard / Add to Campaign / Owner.
  //   position — Position-internal operator. Sees the agent toolkit plus
  //              Assign / Mark Hot. (Field not wired yet; future once the
  //              brokerage tenant column lands.)
  // cardAudience was wired to the HTML PropertyCardBillboard; that card
  // was removed (UI now lives in the world as the slab texture). When
  // the click-through detail page lands, recompute audience there.

  // A property card is open → the map shrinks to free the left matte for it.
  const cardOpen = !!selectedLead && !walkMode;

  // The bottom-dock chrome (search + mode toggle + tools + property card
  // trigger). Built here, rendered in the .map-shell__dock row below so it's
  // a real layout neighbor of the map frame — never an overlay over the map.
  const dashEl = walkMode ? null : (
    <MapSidebar
      searchSlot={
        <ProspectSearch
          compact
          placeholder="Search address, APN, owner, or lead"
          onSelect={(payload) => {
            setMapCenter({ lat: payload.lat, lng: payload.lng });
            setHasUserPanned(true);
            dispatchFlight({
              center: { lat: payload.lat, lng: payload.lng },
              zoom: 19, duration: 900, easing: 'easeInOutCubic',
            });
            setFlyToTarget({
              lat: payload.lat, lng: payload.lng,
              altitude: 280, heading: 0, pitch: -45, range: 600, durationMs: 1200,
            });
            if (payload.leadId && user) {
              supabase.from('leads').select('*')
                .eq('id', payload.leadId).eq('user_id', user.id).single()
                .then(({ data }) => { if (data) setPinnedRef(data as Lead); });
            }
          }}
        />
      }
      resultIndex={selectedLead ? filteredLeads.findIndex(l => l.id === selectedLead.id) : null}
      resultTotal={filteredLeads.length}
      onPrevResult={() => {
        if (!filteredLeads.length) return;
        const i = selectedLead ? filteredLeads.findIndex(l => l.id === selectedLead.id) : 0;
        const prev = filteredLeads[(i - 1 + filteredLeads.length) % filteredLeads.length];
        if (prev) setSelectedLead(prev);
      }}
      onNextResult={() => {
        if (!filteredLeads.length) return;
        const i = selectedLead ? filteredLeads.findIndex(l => l.id === selectedLead.id) : -1;
        const next = filteredLeads[(i + 1) % filteredLeads.length];
        if (next) setSelectedLead(next);
      }}
      mapMode={mapMode}
      onMode={(m) => {
        if (m === 'WORK_2D') mapModeDispatch({ type: 'ENTER_2D' });
        else if (m === 'FLY_3D') mapModeDispatch({ type: 'ENTER_3D' });
        else if (isSubscribed) mapModeDispatch({ type: 'ENTER_WALK' });
        else setShowGate(true);
      }}
      has3DSupport={has3DSupport}
      isSubscribed={isSubscribed}
      onFlySomewhere={() => setDestinationsOpen(v => !v)}
      destinationsOpen={destinationsOpen}
      onFlightFeel={() => setFlightTuningOpen(v => !v)}
      flightFeelOpen={flightTuningOpen}
      view3D={view3D}
      onSelectProspects={() => handleToggleProspectMode()}
      prospectMode={prospectMode}
      onToggleParcels={() => setShowParcels(v => !v)}
      showParcels={showParcels}
      onTogglePois={() => togglePois()}
      poisVisible={poisVisible}
      photoreal={profile.isAdmin ? {
        visible: true,
        on: !!profile.enable3DTilesAdmin,
        onToggle: () => updateProfile({ enable3DTilesAdmin: !profile.enable3DTilesAdmin }),
      } : undefined}
      selectedLead={selectedLead}
      onCloseCard={() => setSelectedLead(null)}
    />
  );

  return (
    <BuyerSettingsProvider>
    <div
      className="map-shell"
      onContextMenu={(e) => {
        // Prevent the browser/OS right-click menu. Steam Input on the
        // gamepad maps B to right-click; without this, pressing B opens
        // the OS context menu instead of dismissing the popup. The flight
        // app has no use for a context menu. See:
        // [[project-b-press-opens-os-menu-bug]]
        e.preventDefault();
      }}
    >
      {/* Dead-simple laser: click anywhere → beam from bottom-center to
          the cursor. Pure HTML/CSS, no gamepad, no canvas. Proves the
          visual works on its own, decoupled from the firing machinery. */}
      <SimpleLaser />

      {/* Perf measurement overlay — press P to show FPS / frame time /
          heap / OT-session state. Off by default, nearly free. */}
      <PerfHUD />

      {/* ═══ BUYER SETTINGS PANEL ═══
          Persistent knob strip at the top-center. Adjusts mortgage assumptions
          (down payment, rate, term) AND the headline mode (monthly vs price)
          for every visible property card on this page.
          Locked 2026-05-30 evening — Plot's "shop by monthly payment" wedge. */}
      {/* Payment Settings button hidden 2026-06-06 — button design/placement
          to be reworked later. Component kept; just unmounted. */}
      {/* {!walkMode && <BuyerSettingsPanel />} */}

      {/* ═══ THE FINISHED MAP UI — chrome consolidated into MapSidebar ═══
          The dash markup is built here as `dashEl` and rendered DOWN in the
          bottom-dock slot (a real layout row), so it sits beside the map
          frame instead of floating over it. The page still owns all state;
          MapSidebar is pure presentation + callbacks.
          memory/project_map_page_finished_sidebar */}
      {/* dash rendered in the bottom-dock slot below — see dashEl */}

      {/* Flight tuning + destinations panels — triggered from the sidebar. */}
      {!walkMode && (
        <>
          <FlightTuningPanel
            visible={flightTuningOpen}
            tuning={flightTuning}
            onMultiplierChange={setFlightMultiplier}
            onTurnRateChange={setFlightTurnRate}
            onTiltRateChange={setFlightTiltRate}
            onClimbRateChange={setFlightClimbRate}
            onReset={resetFlightTuning}
            onClose={() => setFlightTuningOpen(false)}
          />
          <DestinationsPanel
            visible={destinationsOpen}
            home={profile.defaultMapCenter ? {
              lat: profile.defaultMapCenter.lat,
              lng: profile.defaultMapCenter.lng,
              label: profile.company || profile.fullName || undefined,
            } : null}
            onFlyTo={(target) => { setFlyToTarget({ ...target }); }}
            onClose={() => setDestinationsOpen(false)}
          />
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

      {/* SPIKE backdrop: the void you back out INTO. The familiar bezel
          made your brain expect a desk/room — there is none. Just nowhere,
          with your gathered cards floating in it. Deliberately unreal: no
          desk, no surface, no logic. Cards suspended in the dark. The
          missing reality IS the point (the freefall). Behind the map. */}
      {spikeZoom && (
        <div
          className="fixed inset-0 z-0"
          style={{ background: 'radial-gradient(circle at 50% 35%, #161618 0%, #08080a 100%)' }}
        >
          {/* Gathered intel — the prospects you collected this session,
              floating in the void below the shrunk map. No container, no
              desk. They just sit there. */}
          {prospectList.slice(0, 8).map((p, i) => {
            // Scatter them across the lower void, lightly tilted — present,
            // not arranged. Pseudo-random but stable per index.
            const cols = 4;
            const col = i % cols;
            const row = Math.floor(i / cols);
            const left = 18 + col * 21 + ((i * 7) % 5);   // %
            const top = 62 + row * 17 + ((i * 5) % 4);     // %
            const tilt = ((i * 13) % 9) - 4;               // -4..4 deg
            return (
              <div
                key={`${p.lat},${p.lng}`}
                className="absolute"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `rotate(${tilt}deg)`,
                  width: 230,
                }}
              >
                <div
                  className="rounded-xl border border-white/10 bg-[#14161b]/90 px-4 py-3 shadow-2xl backdrop-blur-sm"
                  style={{ boxShadow: '0 18px 50px rgba(0,0,0,0.6)' }}
                >
                  <div className="text-[13px] font-bold text-[#E3E2E5] leading-tight">
                    {p.address || 'Unknown address'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8a8f99]">
                    {[p.city, p.state].filter(Boolean).join(', ')}{p.zip ? ` ${p.zip}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
          {prospectList.length === 0 && (
            <div className="absolute left-1/2 top-[70%] -translate-x-1/2 text-[13px] text-[#5a5f69]">
              nothing gathered yet
            </div>
          )}
        </div>
      )}

      {/* ═══ THE MAP BODY — a landscape-capped frame floating in matte ═══
          The map takes all WIDTH but caps its HEIGHT to --map-aspect, so it
          never goes portrait — extra space becomes matte (the home for chrome).
          When a card opens, the WHOLE map SHRINKS uniformly + slides right
          (.is-carded) and the card takes the freed LEFT matte — shrink, never
          cover. Tune from the CSS vars in globals.css (--map-aspect,
          --map-frame-gap, --map-card-w, --map-shrink, --map-frame-radius). */}
      <div className={`map-shell__body ${cardOpen ? 'is-carded' : ''}`}>
        {/* CARD COLUMN — lives in the freed LEFT matte when a card is open.
            Never crosses the map glass; the map shrank to make room. */}
        {cardOpen && (
          <div className="map-card-col">
            <SidebarPropertyCard lead={selectedLead!} onClose={() => setSelectedLead(null)} />
          </div>
        )}

        {/* MAP REGION (matte) → MAP FRAME (the floating, landscape-capped box) */}
        <div className="map-shell__region">
          <div className="map-frame">
      {/* Map or Walk Mode — the back-out. GSAP drives the SCALE with
          expoScale() so the zoom looks perceptually uniform (a normal ease
          appears to change speed when scaling — expoScale bends the curve
          to compensate). That clean, continuous lens-pull is the freefall;
          a stutter or speed-warp breaks it. Border/shadow stay CSS. */}
      <div
        ref={mapWrapRef}
        className="relative h-full w-full"
        style={{
          transformOrigin: 'center center',
          borderRadius: spikeZoom ? 18 : 0,
          // Always clip — the gmp canvas must never paint past the frame edge.
          overflow: 'hidden',
          boxShadow: spikeZoom ? '0 30px 90px rgba(0,0,0,0.7), 0 0 0 3px rgba(40,46,56,1)' : 'none',
          transition: 'border-radius 300ms ease, box-shadow 300ms ease',
        }}
      >
        {loading ? (
          <div className="h-full w-full bg-surface-container animate-pulse rounded-2xl" />
        ) : walkMode ? (
          <StreetViewProspecting
            leads={filteredLeads}
            startPosition={mapCenter || undefined}
            onPositionChanged={setMapCenter}
            pinMode={pinMode}
            onExitWalk={() => mapModeDispatch({ type: 'EXIT_WALK' })}
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
            onParcelClick={(apn, latLng, clickContext) => {
              // Instant path: if the spatial prefetch already cached this
              // parcel (flew over it), prime the geometry cache NOW so
              // PlotPropertyHighlight draws the lot polygon with zero
              // network — no spinner, no round trip. The popup data resolve
              // still runs but the world responds on the click frame.
              const cached = getCachedParcel(apn);
              if (cached?.geometry) primeGeomCache(apn, cached.geometry);
              // (camera auto-pan defense lives in setSelectedLead wrapper)
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
              // Anchor the windshield-sticker popup ABOVE THE RETICLE,
              // not at the click pixel. Greg locked 2026-06-06: "I dont
              // want the UI right there where Im trying to look at, I
              // want it to popup on top." Reticle XY is the reference;
              // the sticker's bottom edge sits ABOVE_RETICLE_GAP px
              // above the reticle, so the card body never crosses or
              // covers the reticle. Camera snapshot still comes from
              // the click frame so delta math zero-points correctly.
              if (clickContext) {
                const rx = reticlePosition.xFraction * window.innerWidth;
                const ry = reticlePosition.yFraction * window.innerHeight;
                const ABOVE_RETICLE_GAP = 32;
                setStickerContext({
                  ...clickContext,
                  screenX: rx,
                  screenY: ry - ABOVE_RETICLE_GAP,
                });
              }
            }}
            onGooglePoiClick={(placeId, latLng) => {
              // Google POI selection from the 3D photoreal surface
              // (Breakthrough 1 — 2026-05-26). Construct a `gpoi:<placeId>`
              // stub Lead; PropertyPopup detects the prefix and resolves
              // via /api/google-poi (server-side Place Details proxy).
              const stub: Lead = {
                id: `gpoi:${placeId}`,
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
            onAddressClick={(addressId, latLng) => {
              // Plot address-layer selection (2026-05-27). PostGIS hit
              // on /api/addresses/at-point → open PropertyPopup with
              // `addr:<id>` stub; resolver fetches /api/addresses/[id].
              const stub: Lead = {
                id: `addr:${addressId}`,
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
            mapElForwardRef={map3DElRef}
            cameraForwardRef={cameraStateRef}
            ritualTetherForwardRef={ritualTetherRef}
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
                mapModeDispatch({ type: 'ENTER_WALK' });
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
            onMoveReticle={handleMoveReticle}
            onGamepadReticleTargetChange={handleReticleTargetChange}
            onGamepadParcelHoverChange={handleParcelHoverChange}
            onGamepadStatusChange={handleGamepadStatus}
            flightSpeedMultiplier={flightTuning.multiplier}
            climbRateMultiplier={flightTuning.climbRate}
            turnRateMultiplier={flightTuning.turnRate}
            tiltRateMultiplier={flightTuning.tiltRate}
            flyToTarget={flyToTarget}
            onAltitudeChange={setCurrentAltitudeM}
            isIdle={isIdle}
            poisVisible={poisVisible}
          />
        )}

        {/* Legacy MapReticle removed 2026-05-27. The theodolite
            CustomReticle inside MapView3D is now the only reticle —
            it tracks the OS cursor (gamepad + mouse) and renders
            world-aware hover state. No competing white-dot needed. */}

        {/* Altitude gauge — live readout of the eye altitude over
            ground. Only meaningful on the 3D Tiles photoreal path
            since that's the surface that actually fires altitude
            updates; 2D path uses zoom levels instead. */}
        <AltitudeGauge
          visible={!walkMode && profile.enable3DTilesAdmin}
          altitudeMeters={currentAltitudeM}
        />

        {/* Pilot avatar — F-18 placeholder until SAM 3D Body pipeline
            ships user selfies as splats. Only renders in airplane (game-
            feel) mode where the cockpit framing makes sense. Translucent
            so the user sees through to the world they're flying over. */}
        {flightMode === 'airplane' && !walkMode && (
          <SplatHUDLayer
            splatUrl="/assets/splats/f18hornet.ply"
            opacity={0.75}
            widthFraction={0.45}
            bottomFraction={0}
          />
        )}

        {/* Shot projectile — fires a fast round from the bottom of the
            screen to the reticle on every A-press (mounted = straight
            from bottom-left, highline = arc over the reticle and fall
            onto it). On impact it bursts the property card above the
            reticle (onShotImpact), but only when the round was aimed at
            a firable lead. Cleared after the visual finishes. */}
        <ShotProjectile shot={shot} onImpact={onShotImpact} />

        {/* Empty state — bottom center.
            Only for AUTHED users with 0 leads (operator empty state).
            Public visitors don't see this. Dismissible + state persists
            in localStorage so it doesn't nag the same user repeatedly.
            Locked 2026-05-31 morning. */}
        {!loading && user && leads.length === 0 && !walkMode && !importPromptDismissed && (
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
              <button
                onClick={() => {
                  setImportPromptDismissed(true);
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('plotmaps.importPrompt.dismissed', '1');
                  }
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-secondary hover:text-on-surface hover:bg-surface-container/60 transition-all shrink-0"
                title="Dismiss"
                aria-label="Dismiss"
              >
                <MaterialIcon icon="close" className="text-[18px]" />
              </button>
            </div>
          </div>
        )}
      </div>
          </div>{/* /.map-frame */}
        </div>{/* /.map-shell__region */}
      </div>{/* /.map-shell__body */}

      {/* ═══ BOTTOM DOCK — a real layout row, not a floating bar.
          The map frame ends exactly at the top of this dock; it can never
          cover the map. Move this to a rail / top bar later by re-slotting
          MapSidebar and adjusting --map-rail-w / --map-top-h. ═══ */}
      {!walkMode && <div className="map-shell__dock">{dashEl}</div>}

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
                  mapModeDispatch({ type: 'ENTER_WALK' });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* ═══ ACTIVE SELECTION CARD — anchored over the property ═══
          Mounted as a Marker3DInteractiveElement inside gmp-map-3d at
          the property's lat/lng. Google's renderer handles projection,
          depth, occlusion, and camera tracking. The card stays glued
          to the building as the camera moves. Cathedral grade. */}
      {/* ═══ PLOT PIN MARKERS — one Plot pin per filtered lead at its
              lat/lng. World-space 3D model anchored via Google's
              gmp-model-3d-interactive, loaded from
              public/assets/markers/plot-pin.glb (mint emissive
              surveyor stake, modeled in Blender 2026-05-30 evening).
              Click opens the lead's PropertyPopup.
              Cathedral grade — Google handles projection, depth,
              occlusion, camera tracking. No screen-space math. */}
      {!walkMode && filteredLeads.map((lead) => (
        lead.latitude != null && lead.longitude != null ? (
          <PlotPinMarker
            key={lead.id}
            mapElRef={map3DElRef}
            lat={lead.latitude}
            lng={lead.longitude}
            altitudeM={0}
            onClick={() => setSelectedLead(lead)}
          />
        ) : null
      ))}

      {selectedLead && !walkMode && selectedLead.latitude != null && selectedLead.longitude != null && (
        <>
        {/* Re-enabled 2026-06-04 with the cancelAutoPan guard inside
            GroundGlow itself — it was the zoom-on-select culprit, now
            defused (its popover no longer pans the camera). */}
        <GroundGlow
          mapElRef={map3DElRef}
          lat={selectedLead.latitude}
          lng={selectedLead.longitude}
        />
        {/* Real parcel polygon highlight from PostGIS. Covers
            Kings/Tulare/Fresno/Sacramento today; outside coverage
            renders nothing (no fabricated footprint). */}
        <PlotPropertyHighlight
          mapElRef={map3DElRef}
          apn={selectedApn}
        />
        </>
      )}

      {/* ═══ PROPERTY CARD ═══
          The single property card now lives in the bottom-dash SHEET
          (SidebarPropertyCard inside MapSidebar) — light, tabbed, docked,
          out of the flight path. The old dark corner-pop InWorldPropertyCard
          mounted here was removed 2026-06-26: it rendered a SECOND card on
          top of the sheet card (the double-card bug Greg flagged). One card,
          one surface. See memory/project_map_page_finished_sidebar. */}

      {/* SUMMONED MONUMENT REMOVED 2026-06-04. The rising glb block is
          retired — moving to the HTML "easel" projection-card direction
          (no 3D-world block). The glb (gmp-model-3d-interactive) mounting
          in front of the camera on select was also the prime remaining
          suspect for the zoom-on-select hijacking flight. Killing it does
          both: no block + likely no zoom. PlotSummonedMonument.tsx kept on
          disk (parked) in case the rising mechanic returns; just unmounted. */}

      {/* ═══ LIVE CARD — world-aware HTML on the risen shell ═══
          Container belongs to the 3D world (the glb tower above);
          CONTENT belongs to HTML. The live PropertyCardBillboard
          (real price/PITI/beds, recalculates with BuyerSettings) is
          mounted via gmp-marker at the SAME parcel anchor + the risen
          altitude, so it rides at the top of the shell. Screen-facing
          and crisp — we never tilt the readable layer (world-aware
          interface model, locked 2026-05-31). Only present when a real
          parcel is selected (selectedApn gate). */}
      {/* Older AnchoredPropertyCard + InWorldPropertyCard mount REMOVED
          2026-06-06. The PropertyStickerCard above is now the single
          popup surface. AnchoredPropertyCard's manual lat/lng→screen
          projection was the "card appears top-center / too big" bug;
          superseded by the windshield-sticker model (anchor above the
          reticle, slide on camera delta). InWorldPropertyCard the
          component is now rendered INSIDE the sticker wrapper above. */}


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
                  mapModeDispatch({ type: 'ENTER_WALK' });
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

      {/* Market-request prompt — graceful state for unsupported markets
          and geocoder misses arriving from the search-first landing. */}
      {marketRequest && (
        <MarketRequestPrompt
          query={marketRequest.query}
          mode={marketRequest.mode}
          onDismiss={() => setMarketRequest(null)}
        />
      )}

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

      {/* Firing-mechanism chip REMOVED (2026-06-24) — it was a dev/tuning
          surface (the "Mounted/Highline · M" toggle) cluttering the bottom-
          left corner. The M-key toggle + cycleShotMechanism still work for
          tuning; just no visible button. */}

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

      {/* ═══ OTANIMUS — on-screen flight companion ═══
          Gemini Live-powered character that watches the map + hears you
          and rides along, turning to speak and walking the screen. The
          moat. Summon button bottom-right; only connects on tap (mic +
          screen-share permission). See [[project-otanimus-on-map-companion]]. */}
      {!walkMode && <MapCompanionLayer />}

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
    </BuyerSettingsProvider>
  );
}
