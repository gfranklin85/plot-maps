"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer, Renderer, Cluster } from "@googlemaps/markerclusterer";
import { Lead, STATUS_COLORS, LISTING_STATUS_COLORS } from "@/types";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import { useTheme } from "next-themes";

// Theme-aware pin colors
const PIN_THEME = {
  dark: { bg: 'rgba(10,16,32,0.92)', bgStrong: 'rgba(10,16,32,0.95)', text: 'white', subText: '#94a3b8' },
  light: { bg: 'rgba(255,255,255,0.95)', bgStrong: 'rgba(255,255,255,0.97)', text: '#1e293b', subText: '#64748b' },
};

export type PinMode = "dots" | "labels" | "detail";

interface Props {
  leads: Lead[];
  onLeadClick?: (id: string, lead: Lead) => void;
  onDataChanged?: () => void;
  onCenterChanged?: (center: { lat: number; lng: number }) => void;
  onWalkHere?: (lead: Lead) => void;
  onMapClick?: (latLng: { lat: number; lng: number }) => void;
  center?: { lat: number; lng: number } | null;
  zoom?: number | null;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
  pinMode?: PinMode;
  prospectMode?: boolean;
  prospectPins?: { lat: number; lng: number }[];
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e8" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef2f7" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8c9bab" }] },
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
  // Target leads: green if has phone (fulfilled), blue if address only
  const hasPhone = !!(lead.phone);
  const color = hasPhone ? '#22c55e' : '#3b82f6';
  return { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: color, fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 };
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
  const topW = 24 + priceLen * 9;
  const botW = subLen * 6 + 12;
  const width = Math.max(topW, botW, 55);
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

  const priceW = (price || '—').length * 11 + 20;
  const badgeW = statusLabel ? 52 : 0;
  const topW = priceW + badgeW + 12;
  const line2W = line2.length * 7 + 20;
  const line3W = line3.length * 6.5 + 20;
  const width = Math.max(topW, line2W, line3W, 100);
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

function ProspectPins({ pins }: { pins: { lat: number; lng: number }[] }) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    pins.forEach(pin => {
      const marker = new google.maps.Marker({
        position: pin,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#f97316',
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        zIndex: 999,
      });
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, pins]);

  return null;
}

export default function MapView({ leads, onLeadClick, onCenterChanged, onMapClick, center, zoom, mapType = "roadmap", pinMode = "dots", prospectMode = false, prospectPins = [] }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const isSatellite = mapType === "satellite" || mapType === "hybrid";

  const handleMarkerClick = useCallback(
    (lead: Lead) => { onLeadClick?.(lead.id, lead); },
    [onLeadClick]
  );

  const handleMapClick = useCallback(
    (e: { detail: { latLng: { lat: number; lng: number } | null } }) => {
      if (!prospectMode || !onMapClick || !e.detail.latLng) return;
      onMapClick({ lat: e.detail.latLng.lat, lng: e.detail.latLng.lng });
    },
    [prospectMode, onMapClick]
  );

  return (
    <APIProvider apiKey={API_KEY} libraries={['places']}>
      <Map
        defaultCenter={center || MAP_CENTER}
        defaultZoom={MAP_ZOOM}
        className={`h-full w-full ${prospectMode ? 'cursor-crosshair' : ''}`}
        disableDefaultUI
        zoomControl
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="greedy"
        tilt={0}
        heading={0}
        styles={isSatellite ? undefined : MAP_STYLES}
        onClick={handleMapClick}
      >
        <MapTypeSync mapType={mapType} />
        <ZoomController zoom={zoom} />
        <CenterTracker onCenterChanged={onCenterChanged} />
        <LeadMarkers leads={leads} onMarkerClick={handleMarkerClick} pinMode={pinMode} isDark={isDark} />
        {prospectPins.length > 0 && <ProspectPins pins={prospectPins} />}
      </Map>
    </APIProvider>
  );
}
