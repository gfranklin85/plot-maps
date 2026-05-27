"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer, Renderer, Cluster } from "@googlemaps/markerclusterer";
import { Lead, STATUS_COLORS, LISTING_STATUS_COLORS } from "@/types";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import { useTheme } from "next-themes";
import ZoningOverlay from "./ZoningOverlay";
import ParcelOverlay, { type ParcelColorMode, type ParcelHitTester } from "./ParcelOverlay";
import AdvancedLeadMarkers from "./AdvancedLeadMarkers";
import GamepadFlightController, { type GamepadActions, type FlightMode, type ReticleTarget } from "./GamepadFlightController";
import { useCameraChoreographer, type FlyToOptions } from "@/lib/useCameraChoreographer";
import { AtmosphereProvider } from "@/lib/atmosphere/AtmosphereContext";
import AtmosphereOverlay from "./AtmosphereOverlay";

// Theme-aware pin colors
const PIN_THEME = {
  dark: { bg: 'rgba(10,16,32,0.92)', bgStrong: 'rgba(10,16,32,0.95)', text: 'white', subText: '#94a3b8' },
  light: { bg: 'rgba(255,255,255,0.95)', bgStrong: 'rgba(255,255,255,0.97)', text: '#1e293b', subText: '#64748b' },
};

export type PinMode = "dots" | "labels" | "detail";

export interface MapViewProps {
  leads: Lead[];
  onLeadClick?: (id: string, lead: Lead) => void;
  onDataChanged?: () => void;
  onCenterChanged?: (center: { lat: number; lng: number }) => void;
  onWalkHere?: (lead: Lead) => void;
  onMapClick?: (latLng: { lat: number; lng: number }, opts?: { placeId?: string | null }) => void;
  center?: { lat: number; lng: number } | null;
  navigateTo?: { lat: number; lng: number } | null;
  zoom?: number | null;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
  pinMode?: PinMode;
  prospectMode?: boolean;
  prospectPins?: { lat: number; lng: number; address: string }[];
  onProspectPinClick?: (address: string) => void;
  showZoningOverlay?: boolean;
  /** Show parcel polygons over the map (Kings County etc.). Color rendering
   *  is driven by parcelColorMode. Hidden by default; user toggles via the
   *  layer picker on the page. */
  showParcelOverlay?: boolean;
  parcelColorMode?: ParcelColorMode;
  /** Fires when the user clicks a parcel polygon. Carries the APN and the
   *  lat/lng of the click. The page uses this to look up / open the
   *  PropertyPopup against the resolver. */
  onParcelClick?: (apn: string, latLng: { lat: number; lng: number }) => void;
  /** Fires when the user picks a Google POI (address-number label or
   *  business icon) on the 3D photoreal surface. The page wires this
   *  to open PropertyPopup against the `gpoi:<placeId>` stub id —
   *  same popup primitive parcels open through. POI wins over the
   *  bare-parcel ray-cast when both could resolve. */
  onGooglePoiClick?: (placeId: string, latLng: { lat: number; lng: number }) => void;
  /** Fires when a ground click resolves to a Plot-owned address record
   *  via /api/addresses/at-point. Page wires this to open PropertyPopup
   *  with the `addr:<id>` stub id. */
  onAddressClick?: (addressId: number, latLng: { lat: number; lng: number }) => void;
  /** Fires when the cursor enters or leaves a parcel polygon. The page
   *  feeds this into the airplane-mode reticle so flying over a parcel
   *  shows the grab-ready hand icon. Pin DOM hover still wins on overlap;
   *  the page does the precedence. */
  onParcelHoverChange?: (apn: string | null, latLng: { lat: number; lng: number } | null) => void;
  /** Shared ref ParcelOverlay writes its hit-tester into. The gamepad
   *  controller reads it each frame to do an exact containsLocation
   *  hit-test against the reticle pixel, bypassing Google's mouseover
   *  events (which are flaky during camera motion under a stationary
   *  cursor). */
  parcelHitTesterRef?: React.MutableRefObject<ParcelHitTester | null>;
  view3D?: boolean;
  // Choreographed camera move. Pass a new object to trigger a flight;
  // the choreographer animates from the current camera state to the
  // target. null = no flight queued.
  flight?: (FlyToOptions & { _id?: number }) | null;
  // Xbox / generic gamepad. When `gamepadEnabled` is true and a controller
  // is connected, sticks pilot the camera and buttons fire the supplied
  // action callbacks. Status changes bubble up via onGamepadStatusChange so
  // the page can render a status chip.
  gamepadEnabled?: boolean;
  gamepadActions?: GamepadActions;
  gamepadMode?: FlightMode;
  /** Debug-only: passed through to GamepadFlightController. When true the
   *  per-frame moveCamera/setCenter applies are skipped. Used to isolate
   *  whether camera mutation is what breaks Google's POI hover hit-test. */
  gamepadDebugSuspendMoveCamera?: boolean;
  /** Debug-only: force the controller to use the absolute-setter fallback
   *  path instead of moveCamera(). Tests whether that path preserves POI
   *  hover while still delivering smooth flight feel. */
  gamepadDebugForceFallbackPath?: boolean;
  /** Debug-only: after each moveCamera() call, additionally call a no-op
   *  setOptions to tickle Google's POI hit-test back to life. Tests
   *  whether a follow-up call rescues hover. */
  gamepadDebugTickleAfterMoveCamera?: boolean;
  /** Targetable leads in airplane mode for reticle hover detection. */
  gamepadAirplaneTargets?: ReticleTarget[];
  /** User-set reticle screen position (drag-to-place). 0..1 viewport
   *  fractions; the controller samples its hit-test pixel and dispatches
   *  synthetic pointermove events at this position. */
  gamepadReticleXFraction?: number;
  gamepadReticleYFraction?: number;
  /** Fires when the reticle's hovered target changes (incl. null). */
  onGamepadReticleTargetChange?: (target: ReticleTarget | null) => void;
  /** Fires when the controller's per-frame parcel hit-test changes
   *  which APN is under the reticle. Page wires this to the same
   *  parcel-hover state that mouse-over events drive. */
  onGamepadParcelHoverChange?: (apn: string | null, latLng: { lat: number; lng: number } | null) => void;
  /** Fires with the focal-point screen-Y as a 0..1 viewport fraction.
   *  Retained for potential consumers; not wired through page.tsx since
   *  drag-to-place owns the reticle position now. */
  onGamepadFocalScreenYChange?: (fraction: number) => void;
  onGamepadStatusChange?: (connected: boolean, label: string | null) => void;
  /** Master flight-speed multiplier from useFlightTuning. 1.0 = default
   *  Pilot feel; 0.6 = Newcomer; 1.6 = Pro. Scales pan/yaw/tilt
   *  acceleration uniformly in both 2D and 3D paths. */
  flightSpeedMultiplier?: number;
  /** Climb rate multiplier — scales LT/RT dolly speed independently
   *  of flight speed. 3D path only (2D path uses triggers as zoom).
   *  Default 1.0. */
  climbRateMultiplier?: number;
  /** Turn rate multiplier — scales yaw (right-X) only. Independent
   *  of flight speed so users can dial slow cinematic horizon pans
   *  with snappy throttle (or vice versa). Applies in both 2D and
   *  3D paths. Default 1.0. */
  turnRateMultiplier?: number;
  /** Tilt rate multiplier — scales tilt (right-Y look up/down) only.
   *  Independent of flight speed so slowing pan doesn't slow how
   *  fast the user can look up. Default 1.0. */
  tiltRateMultiplier?: number;
  /** Live altitude reporting from the 3D path's per-frame loop.
   *  Throttled to ~5×/sec. Page uses it to drive the AltitudeGauge
   *  HUD readout. 2D path doesn't fire this (altitude isn't a
   *  meaningful concept on the tilted 2D surface). */
  onAltitudeChange?: (meters: number) => void;
  /** Idle flag from useIdleDetection. When true, 3D path pauses its
   *  per-frame writes (saves GPU when the user walks away). 2D path
   *  ignores — its render is event-driven, not loop-driven. */
  isIdle?: boolean;
  /** Google POI labels + business icons visible? Default false for
   *  immersive framing. 2D path: applied via MapTypeStyle. 3D path:
   *  applied via default-labels-disabled attribute. */
  poisVisible?: boolean;
  /** Cinematic flight target. Set to a new object reference to trigger
   *  an animated transition from current camera pose to the target. The
   *  3D path implements this; the 2D path ignores. */
  flyToTarget?: {
    lat: number;
    lng: number;
    altitude: number;
    heading: number;
    pitch: number;
    range: number;
    durationMs?: number;
  } | null;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;

// Base color-grading styles for the roadmap path. POI hiding is composed
// in below at render time based on the `poisVisible` prop so the user can
// flip Google's business labels on/off without losing our color tweaks.
const MAP_STYLES_BASE: google.maps.MapTypeStyle[] = [
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e8" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef2f7" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8c9bab" }] },
];

const POI_HIDE_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
];

// ── Pin Icon Generators ──

function formatPriceShort(price: number | null): string {
  if (!price) return '';
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price}`;
}

function getStatusColor(lead: Lead): string {
  if (lead.listing_status) return LISTING_STATUS_COLORS[lead.listing_status] || '#6b7280';
  return STATUS_COLORS[lead.status] || '#6b7280';
}

function getStatusLabel(lead: Lead): string {
  if (lead.listing_status === 'Sold') return 'SOLD';
  if (lead.listing_status === 'Active') return 'ACTIVE';
  if (lead.listing_status === 'Pending') return 'PEND';
  return '';
}

// Dot mode: simple colored circles/diamonds
// MLS = diamond, Leads with phone = green circle, Leads without phone = blue circle
function createDotIcon(lead: Lead): google.maps.Icon | google.maps.Symbol {
  const isMLS = !!lead.listing_status;
  if (isMLS) {
    const color = getStatusColor(lead);
    return { path: "M 0,-12 L 8,0 L 0,12 L -8,0 Z", scale: 1, fillColor: color, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 };
  }
  // Target leads: orange if called/contacted, green if has phone, blue if address only
  const hasPhone = !!(lead.phone);
  const calledStatuses = ['Called', 'Interested', 'Follow-Up', 'Not Interested', 'Do Not Call', 'Hot Lead'];
  const wasCalled = calledStatuses.includes(lead.status);
  const color = wasCalled ? '#f97316' : hasPhone ? '#22c55e' : '#3b82f6';
  const strokeColor = wasCalled ? '#fdba74' : '#ffffff';
  return { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeColor, strokeWeight: 3 };
}

// Helper: days since a date
function daysSince(dateStr: string | null): string {
  if (!dateStr) return '';
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}yr`;
}

// Label mode: compact rich pin — price + status + recency
function createLabelIcon(lead: Lead, isDark = true): google.maps.Icon {
  const color = getStatusColor(lead);
  const t = isDark ? PIN_THEME.dark : PIN_THEME.light;
  const price = formatPriceShort(lead.listing_price || lead.selling_price || null);
  const statusLabel = getStatusLabel(lead);
  const dom = lead.dom != null ? `${lead.dom}d` : '';
  const recency = daysSince(lead.selling_date || lead.listing_date);
  const subLine = [statusLabel, dom ? `${dom} DOM` : '', recency].filter(Boolean).join(' · ');

  const priceLen = (price || '—').length;
  const subLen = subLine.length;
  const topW = 22 + priceLen * 8;
  const botW = subLen * 4.8 + 10;
  const width = Math.max(topW, botW, 50);
  const height = subLine ? 36 : 28;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 7}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="${t.bg}" stroke="${color}" stroke-width="1.5"/>
      <circle cx="10" cy="12" r="3.5" fill="${color}"/>
      <text x="18" y="13" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="13" font-weight="800" fill="${t.text}">${price || '—'}</text>
      ${subLine ? `<text x="6" y="29" font-family="system-ui,sans-serif" font-size="8" font-weight="700" fill="${color}">${subLine}</text>` : ''}
      <polygon points="${width / 2 - 3},${height} ${width / 2},${height + 6} ${width / 2 + 3},${height}" fill="${t.bg}"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(width, height + 7),
    anchor: new google.maps.Point(width / 2, height + 7),
  };
}

// Detail mode: full property card — noticeably bigger than labels, readable at a glance
function createDetailIcon(lead: Lead, isDark = true): google.maps.Icon {
  const color = getStatusColor(lead);
  const t = isDark ? PIN_THEME.dark : PIN_THEME.light;
  const price = formatPriceShort(lead.listing_price || lead.selling_price || null);
  const statusLabel = getStatusLabel(lead);
  const dom = lead.dom != null ? `${lead.dom}d DOM` : '';
  const recency = daysSince(lead.selling_date || lead.listing_date);
  const sqft = lead.sqft ? `${lead.sqft.toLocaleString()}sf` : '';
  const year = lead.year_built ? `${lead.year_built}` : '';
  const line2 = [dom, recency].filter(Boolean).join(' · ');
  const line3 = [sqft, year].filter(Boolean).join(' · ') || lead.property_address?.split(',')[0]?.substring(0, 20) || '';

  const priceW = (price || '—').length * 10 + 16;
  const badgeW = statusLabel ? 48 : 0;
  const topW = priceW + badgeW + 8;
  const line2W = line2.length * 6 + 16;
  const line3W = line3.length * 5.5 + 16;
  const width = Math.max(topW, line2W, line3W, 80);
  const height = 62;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + 9}">
      <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="12" fill="${t.bgStrong}" stroke="${color}" stroke-width="2"/>
      ${statusLabel ? `<rect x="${width - 48}" y="6" width="44" height="16" rx="8" fill="${color}"/>
      <text x="${width - 26}" y="15" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="800" fill="white">${statusLabel}</text>` : ''}
      <text x="10" y="22" font-family="system-ui,sans-serif" font-size="16" font-weight="800" fill="${t.text}">${price || '—'}</text>
      <text x="10" y="38" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="${color}">${line2}</text>
      <text x="10" y="52" font-family="system-ui,sans-serif" font-size="9.5" font-weight="500" fill="${t.subText}">${line3}</text>
      <polygon points="${width / 2 - 4},${height - 2} ${width / 2},${height + 7} ${width / 2 + 4},${height - 2}" fill="${t.bgStrong}"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(width, height + 9),
    anchor: new google.maps.Point(width / 2, height + 9),
  };
}

/** Custom cluster renderer */
class BlueCircleRenderer implements Renderer {
  render(cluster: Cluster, stats: { clusters: { markers: { max: number } } }): google.maps.Marker {
    const count = cluster.count;
    const position = cluster.position;
    const max = stats.clusters.markers.max;
    const size = Math.max(36, Math.min(60, 36 + (count / max) * 24));

    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#3b82f6" opacity="0.85"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}" fill="#3b82f6"/>
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
              fill="white" font-size="${size > 44 ? 14 : 12}" font-weight="600" font-family="system-ui, sans-serif">
          ${count}
        </text>
      </svg>`;

    return new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      },
      zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
    });
  }
}

function MapTypeSync({ mapType }: { mapType: string }) {
  const map = useMap();
  useEffect(() => { if (map) map.setMapTypeId(mapType); }, [map, mapType]);
  return null;
}

function ZoomController({ zoom }: { zoom?: number | null }) {
  const map = useMap();
  useEffect(() => { if (map && zoom != null) map.setZoom(zoom); }, [map, zoom]);
  return null;
}

function CenterController({ center }: { center?: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => { if (map && center) map.panTo(center); }, [map, center]);
  return null;
}

function CenterTracker({ onCenterChanged }: { onCenterChanged?: (c: { lat: number; lng: number }) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !onCenterChanged) return;
    const listener = map.addListener("idle", () => {
      const center = map.getCenter();
      if (center) onCenterChanged({ lat: center.lat(), lng: center.lng() });
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onCenterChanged]);
  return null;
}

function LeadMarkers({
  leads,
  onMarkerClick,
  pinMode = "dots",
  isDark = true,
}: {
  leads: Lead[];
  onMarkerClick: (lead: Lead) => void;
  pinMode: PinMode;
  isDark: boolean;
}) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    if (!map) return;

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    leads.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      // Rich pins only for context/reference data — user targets always get dots
      const isContext = lead.record_type === 'context' || !lead.user_id || !!lead.listing_status;
      let icon: google.maps.Icon | google.maps.Symbol;
      if (isContext && pinMode === 'detail') {
        icon = createDetailIcon(lead, isDark);
      } else if (isContext && pinMode === 'labels') {
        icon = createLabelIcon(lead, isDark);
      } else {
        icon = createDotIcon(lead);
      }

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        title: lead.property_address || lead.name,
        icon,
      });

      marker.addListener("click", () => onMarkerClick(lead));
      markersRef.current.push(marker);
    });

    // Only cluster in dots mode — labels/detail need individual visibility
    if (pinMode === 'dots') {
      const clusterer = new MarkerClusterer({
        map,
        markers: markersRef.current,
        renderer: new BlueCircleRenderer(),
      });
      clustererRef.current = clusterer;
    } else {
      // No clustering — show all markers directly
      markersRef.current.forEach(m => m.setMap(map));
    }

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, leads, onMarkerClick, pinMode, isDark]);

  return null;
}

function ProspectPins({ pins, onPinClick }: { pins: { lat: number; lng: number; address: string }[]; onPinClick?: (address: string) => void }) {
  const map = useMap();
  const overlaysRef = useRef<Map<string, google.maps.OverlayView>>(new window.Map());
  const handlerRef = useRef(onPinClick);
  handlerRef.current = onPinClick;

  useEffect(() => {
    if (!map) return;
    const overlays = overlaysRef.current;
    const currentKeys = new Set(pins.map(p => p.address));

    // Remove overlays for addresses that were deselected
    Array.from(overlays.entries()).forEach(([address, overlay]) => {
      if (!currentKeys.has(address)) {
        overlay.setMap(null);
        overlays.delete(address);
      }
    });

    // Add overlays for newly selected addresses
    pins.forEach(pin => {
      if (overlays.has(pin.address)) return;

      const overlay = new google.maps.OverlayView();
      const div = document.createElement('div');
      div.className = 'prospect-pin';
      div.setAttribute('role', 'button');
      div.setAttribute('aria-label', `Remove ${pin.address.split(',')[0]} from prospect list`);
      div.style.position = 'absolute';
      div.style.zIndex = '999';
      div.innerHTML = `
        <svg viewBox="0 0 24 24" class="prospect-pin__check" aria-hidden="true">
          <polyline points="5 12 10 17 19 8" />
        </svg>
      `;
      div.addEventListener('click', (e) => {
        e.stopPropagation();
        handlerRef.current?.(pin.address);
      });

      overlay.onAdd = function () {
        const panes = this.getPanes();
        panes?.overlayMouseTarget.appendChild(div);
      };
      overlay.draw = function () {
        const projection = this.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(pin.lat, pin.lng));
        if (!point) return;
        div.style.left = `${point.x}px`;
        div.style.top = `${point.y}px`;
      };
      overlay.onRemove = function () {
        if (div.parentNode) div.parentNode.removeChild(div);
      };
      overlay.setMap(map);
      overlays.set(pin.address, overlay);
    });

    return () => {
      Array.from(overlays.values()).forEach(o => o.setMap(null));
      overlays.clear();
    };
  }, [map, pins]);

  return null;
}

// Imperatively set tilt when 3D mode toggles on/off. Photorealistic
// 3D Tiles only render when the map has a Map ID configured + tilt > 0.
// Animates the tilt change via the camera choreographer for a smooth
// transition instead of a hard snap.
function Tilt3DController({ enabled }: { enabled: boolean }) {
  const { flyTo } = useCameraChoreographer();
  useEffect(() => {
    flyTo({
      tilt: enabled ? 67 : 0,
      duration: 500,
      easing: 'easeInOutCubic',
    });
  }, [enabled, flyTo]);
  return null;
}

// Watches a `flight` prop. When the prop reference changes (parent
// dispatched a new flight), animate the camera to its target.
function FlightController({ flight }: { flight: (FlyToOptions & { _id?: number }) | null }) {
  const { flyTo } = useCameraChoreographer();
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!flight) return;
    // Track by _id (or object identity fallback) so identical-shape
    // flights don't get skipped.
    const id = flight._id ?? -1;
    if (id === lastIdRef.current) return;
    lastIdRef.current = id;
    flyTo(flight);
  }, [flight, flyTo]);
  return null;
}

// Listen directly on the underlying google.maps.Map for clicks on Google's
// POI overlay (address-number labels, business markers, etc). The React
// onClick prop doesn't always surface placeId for the address-number layer,
// so this is a belt-and-suspenders catch.
function PoiClickCatcher({
  prospectMode,
  onMapClick,
}: {
  prospectMode: boolean;
  onMapClick?: (latLng: { lat: number; lng: number }, opts?: { placeId?: string | null }) => void;
}) {
  const map = useMap();
  const handlerRef = useRef({ prospectMode, onMapClick });
  handlerRef.current = { prospectMode, onMapClick };

  useEffect(() => {
    if (!map) return;
    // IconMouseEvent has a placeId; MapMouseEvent doesn't. Both extend each
    // other so a single 'click' listener catches both.
    const listener = map.addListener('click', (e: google.maps.IconMouseEvent | google.maps.MapMouseEvent) => {
      const { prospectMode: pm, onMapClick: omc } = handlerRef.current;
      if (!pm || !omc) return;
      const latLng = e.latLng;
      if (!latLng) return;
      const placeId = (e as google.maps.IconMouseEvent).placeId;
      if (placeId && e.stop) e.stop();
      omc({ lat: latLng.lat(), lng: latLng.lng() }, { placeId: placeId || null });
    });
    return () => google.maps.event.removeListener(listener);
  }, [map]);

  return null;
}

function PendingSkiptracePins({ pins }: { pins: { id: string; lat: number; lng: number }[] }) {
  const map = useMap();
  const overlaysRef = useRef<Map<string, google.maps.OverlayView>>(new window.Map());

  useEffect(() => {
    if (!map) return;
    const overlays = overlaysRef.current;
    const currentKeys = new Set(pins.map(p => p.id));

    Array.from(overlays.entries()).forEach(([id, overlay]) => {
      if (!currentKeys.has(id)) {
        overlay.setMap(null);
        overlays.delete(id);
      }
    });

    pins.forEach(pin => {
      if (overlays.has(pin.id)) return;
      const overlay = new google.maps.OverlayView();
      const div = document.createElement('div');
      div.className = 'skiptrace-pending-pin';
      div.style.position = 'absolute';
      div.style.zIndex = '500';
      overlay.onAdd = function () {
        const panes = this.getPanes();
        panes?.overlayLayer.appendChild(div);
      };
      overlay.draw = function () {
        const projection = this.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(new google.maps.LatLng(pin.lat, pin.lng));
        if (!point) return;
        div.style.left = `${point.x}px`;
        div.style.top = `${point.y}px`;
      };
      overlay.onRemove = function () {
        if (div.parentNode) div.parentNode.removeChild(div);
      };
      overlay.setMap(map);
      overlays.set(pin.id, overlay);
    });

    return () => {
      Array.from(overlays.values()).forEach(o => o.setMap(null));
      overlays.clear();
    };
  }, [map, pins]);

  return null;
}

export default function MapView({ leads, onLeadClick, onCenterChanged, onMapClick, center, navigateTo, zoom, mapType = "roadmap", pinMode = "dots", prospectMode = false, prospectPins = [], onProspectPinClick, showZoningOverlay = false, showParcelOverlay = false, parcelColorMode = 'land_use', onParcelClick, onParcelHoverChange, parcelHitTesterRef, view3D = false, flight = null, gamepadEnabled = false, gamepadActions, gamepadMode = 'overhead', gamepadDebugSuspendMoveCamera = false, gamepadDebugForceFallbackPath = false, gamepadDebugTickleAfterMoveCamera = false, gamepadAirplaneTargets, gamepadReticleXFraction, gamepadReticleYFraction, onGamepadReticleTargetChange, onGamepadParcelHoverChange, onGamepadFocalScreenYChange, onGamepadStatusChange, flightSpeedMultiplier = 1.0, turnRateMultiplier = 1.0, tiltRateMultiplier = 1.0, poisVisible = false }: MapViewProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const isSatellite = mapType === "satellite" || mapType === "hybrid";

  // Compose final style array: base color grading + (optional) POI hiding.
  // When poisVisible=true we drop the hide rules so Google's business pins
  // and POI labels render.
  const mapStyles = useMemo<google.maps.MapTypeStyle[]>(
    () => poisVisible ? MAP_STYLES_BASE : [...MAP_STYLES_BASE, ...POI_HIDE_STYLES],
    [poisVisible]
  );

  const handleMarkerClick = useCallback(
    (lead: Lead) => { onLeadClick?.(lead.id, lead); },
    [onLeadClick]
  );

  const pendingSkiptracePins = useMemo(
    () => leads
      .filter(l => l.skiptrace_status === 'pending' && l.latitude != null && l.longitude != null)
      .map(l => ({ id: l.id, lat: l.latitude as number, lng: l.longitude as number })),
    [leads]
  );

  // Atmosphere center: prefer the explicit `center` prop (the user's
  // hometown), fall back to MAP_CENTER. Anchored to the framing center,
  // not the live camera position — the visual difference is sub-degree
  // over any reasonable session travel and a fixed anchor avoids
  // re-rendering the provider value every camera tick.
  const atmosCenter = center ?? MAP_CENTER;

  return (
    <AtmosphereProvider lat={atmosCenter.lat} lng={atmosCenter.lng}>
    <div className="relative h-full w-full">
    <APIProvider apiKey={API_KEY} libraries={['places', 'marker']}>
      <Map
        defaultCenter={center || MAP_CENTER}
        defaultZoom={MAP_ZOOM}
        mapId={MAP_ID}
        className={`h-full w-full ${prospectMode ? 'cursor-crosshair' : ''}`}
        disableDefaultUI
        zoomControl
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="greedy"
        defaultTilt={0}
        defaultHeading={0}
        tiltInteractionEnabled
        headingInteractionEnabled
        rotateControl
        clickableIcons
        styles={isSatellite || MAP_ID ? undefined : mapStyles}
      >
        <MapTypeSync mapType={mapType} />
        <ZoomController zoom={zoom} />
        <CenterController center={navigateTo} />
        <CenterTracker onCenterChanged={onCenterChanged} />
        <Tilt3DController enabled={view3D} />
        <FlightController flight={flight} />
        {gamepadEnabled && (
          <GamepadFlightController
            enabled={gamepadEnabled}
            view3D={view3D}
            mode={gamepadMode}
            airplaneTargets={gamepadAirplaneTargets}
            reticleXFraction={gamepadReticleXFraction}
            reticleYFraction={gamepadReticleYFraction}
            parcelHitTesterRef={parcelHitTesterRef}
            onReticleTargetChange={onGamepadReticleTargetChange}
            onParcelHoverChange={onGamepadParcelHoverChange}
            onFocalScreenYChange={onGamepadFocalScreenYChange}
            actions={gamepadActions || {}}
            onStatusChange={onGamepadStatusChange}
            debugSuspendMoveCamera={gamepadDebugSuspendMoveCamera}
            debugForceFallbackPath={gamepadDebugForceFallbackPath}
            debugTickleAfterMoveCamera={gamepadDebugTickleAfterMoveCamera}
            flightSpeedMultiplier={flightSpeedMultiplier}
            turnRateMultiplier={turnRateMultiplier}
            tiltRateMultiplier={tiltRateMultiplier}
          />
        )}
        <PoiClickCatcher prospectMode={prospectMode} onMapClick={onMapClick} />
        <ZoningOverlay visible={showZoningOverlay} />
        <ParcelOverlay
          visible={showParcelOverlay}
          colorMode={parcelColorMode}
          onParcelClick={onParcelClick}
          onParcelHoverChange={onParcelHoverChange}
          hitTesterRef={parcelHitTesterRef}
        />
        {/* AdvancedMarkerElement requires a Map ID. With one configured we
            render the rich pin family (per-status animations, hover labels,
            detail cards). Without one we fall back to the legacy SVG-icon
            markers so dev environments without a Map ID still work. */}
        {MAP_ID
          ? <AdvancedLeadMarkers leads={leads} onMarkerClick={handleMarkerClick} pinMode={pinMode} />
          : <LeadMarkers leads={leads} onMarkerClick={handleMarkerClick} pinMode={pinMode} isDark={isDark} />}
        {pendingSkiptracePins.length > 0 && <PendingSkiptracePins pins={pendingSkiptracePins} />}
        {prospectPins.length > 0 && <ProspectPins pins={prospectPins} onPinClick={onProspectPinClick} />}
      </Map>
    </APIProvider>
    <AtmosphereOverlay />
    </div>
    </AtmosphereProvider>
  );
}
