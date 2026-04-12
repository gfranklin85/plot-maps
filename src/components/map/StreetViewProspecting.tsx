"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, useApiIsLoaded } from "@vis.gl/react-google-maps";
import { Lead, STATUS_COLORS, LISTING_STATUS_COLORS } from "@/types";
import { useTheme } from "next-themes";
import PropertyPopup from "./PropertyPopup";

const SV_PIN_THEME = {
  dark: { bg: 'rgba(15,23,42,0.9)', bgStrong: 'rgba(15,23,42,0.92)', text: 'white', subText: '#94a3b8' },
  light: { bg: 'rgba(255,255,255,0.93)', bgStrong: 'rgba(255,255,255,0.95)', text: '#1e293b', subText: '#64748b' },
};

type PinMode = "dots" | "labels" | "detail";

interface Props {
  leads: Lead[];
  startPosition?: { lat: number; lng: number };
  onDataChanged?: () => void;
  onPositionChanged?: (pos: { lat: number; lng: number }) => void;
  pinMode?: PinMode;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const MAX_DISTANCE = 120; // meters
const FOV_HALF = 90; // degrees — show pins within ±90° of camera heading

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x = Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
  let d = ((a - b + 180) % 360) - 180;
  if (d < -180) d += 360;
  return Math.abs(d);
}

// Generate a floating name tag SVG — scale increases for closer properties
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function makeNameTagIcon(label: string, color: string, scale: number = 1, _isDark = true): google.maps.Icon {
  const textLen = label.length;
  const baseWidth = Math.max(120, textLen * 16 + 40);
  const baseHeight = 56;
  const width = Math.round(baseWidth * scale);
  const height = Math.round(baseHeight * scale);
  const arrow = Math.round(12 * scale);
  const fontSize = Math.round(20 * scale);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + arrow}">
      <defs>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="8" fill="${color}" filter="url(#s)" stroke="white" stroke-width="2"/>
      <polygon points="${width / 2 - arrow},${height - 2} ${width / 2},${height + arrow - 2} ${width / 2 + arrow},${height - 2}" fill="${color}" stroke="white" stroke-width="2"/>
      <rect x="${width / 2 - arrow}" y="${height - 6}" width="${arrow * 2}" height="6" fill="${color}"/>
      <text x="${width / 2}" y="${height / 2 + 1}" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, sans-serif" font-size="${fontSize}" font-weight="700" fill="white">${escapeXml(label)}</text>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(width, height + arrow),
    anchor: new google.maps.Point(width / 2, height + arrow),
  };
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatPriceK(price: number | null): string {
  if (!price) return '';
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price}`;
}

function daysSinceStr(dateStr: string | null): string {
  if (!dateStr) return '';
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days < 30) return `${days}d`;
  return `${Math.round(days / 30)}mo`;
}

function getStatusShort(lead: Lead): string {
  if (lead.listing_status === 'Sold') return 'SOLD';
  if (lead.listing_status === 'Active') return 'ACTIVE';
  if (lead.listing_status === 'Pending') return 'PEND';
  return '';
}

// Rich label for walk mode — price + status + DOM + recency (auto-width, theme-aware)
function makeRichLabelIcon(lead: Lead, color: string, scale: number, isDark = true): google.maps.Icon {
  const price = formatPriceK(lead.listing_price || lead.selling_price || null);
  const status = getStatusShort(lead);
  const dom = lead.dom != null ? `${lead.dom}d` : '';
  const recency = daysSinceStr(lead.selling_date || lead.listing_date);
  const subLine = [status, dom ? `${dom} DOM` : '', recency ? `${recency} ago` : ''].filter(Boolean).join(' · ');

  // Auto-width based on content
  const priceLen = (price || '—').length;
  const subLen = subLine.length;
  const topW = 30 + priceLen * 14; // circle + price
  const botW = subLen * 9 + 16;
  const t = isDark ? SV_PIN_THEME.dark : SV_PIN_THEME.light;
  const baseW = Math.max(topW, botW, 80);
  const baseH = subLine ? 70 : 50;
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  const arrow = Math.round(10 * scale);
  const fs1 = Math.round(22 * scale);
  const fs2 = Math.round(13 * scale);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + arrow}">
      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${Math.round(8 * scale)}" fill="${t.bg}" stroke="${color}" stroke-width="${Math.round(1.5 * scale)}"/>
      <circle cx="${Math.round(14 * scale)}" cy="${Math.round(22 * scale)}" r="${Math.round(5 * scale)}" fill="${color}"/>
      <text x="${Math.round(26 * scale)}" y="${Math.round(24 * scale)}" dominant-baseline="central" font-family="system-ui,sans-serif" font-size="${fs1}" font-weight="800" fill="${t.text}">${escapeXml(price || '—')}</text>
      ${subLine ? `<text x="${Math.round(10 * scale)}" y="${Math.round(54 * scale)}" font-family="system-ui,sans-serif" font-size="${fs2}" font-weight="600" fill="${color}">${escapeXml(subLine)}</text>` : ''}
      <polygon points="${w / 2 - arrow},${h - 1} ${w / 2},${h + arrow - 1} ${w / 2 + arrow},${h - 1}" fill="${t.bg}"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(w, h + arrow),
    anchor: new google.maps.Point(w / 2, h + arrow),
  };
}

// Detail card for walk mode — price, status badge, DOM, recency, sqft, year (auto-width, theme-aware)
function makeDetailCardIcon(lead: Lead, color: string, scale: number, isDark = true): google.maps.Icon {
  const price = formatPriceK(lead.listing_price || lead.selling_price || null);
  const status = getStatusShort(lead);
  const dom = lead.dom != null ? `${lead.dom}d DOM` : '';
  const recency = daysSinceStr(lead.selling_date || lead.listing_date);
  const line2 = [status, dom, recency ? `${recency} ago` : ''].filter(Boolean).join(' · ');
  const sqft = lead.sqft ? `${lead.sqft.toLocaleString()}sf` : '';
  const year = lead.year_built ? `${lead.year_built}` : '';
  const line3 = [sqft, year].filter(Boolean).join(' · ') || '';

  // Auto-width based on content
  const priceW = (price || '—').length * 18 + 20;
  const badgeW = status ? 84 : 0;
  const topW = priceW + badgeW + 12;
  const line2W = line2.length * 10 + 20;
  const line3W = line3.length * 10 + 20;
  const t = isDark ? SV_PIN_THEME.dark : SV_PIN_THEME.light;
  const baseW = Math.max(topW, line2W, line3W, 100);
  const baseH = 110;
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  const arrow = Math.round(12 * scale);
  const fs1 = Math.round(28 * scale);
  const fs2 = Math.round(16 * scale);
  const fs3 = Math.round(15 * scale);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + arrow}">
      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${Math.round(12 * scale)}" fill="${t.bgStrong}" stroke="${color}" stroke-width="${Math.round(3 * scale)}"/>
      ${status ? `<rect x="${w - Math.round(80 * scale)}" y="${Math.round(8 * scale)}" width="${Math.round(72 * scale)}" height="${Math.round(24 * scale)}" rx="${Math.round(8 * scale)}" fill="${color}"/>
      <text x="${w - Math.round(44 * scale)}" y="${Math.round(21 * scale)}" dominant-baseline="central" text-anchor="middle" font-family="system-ui,sans-serif" font-size="${Math.round(13 * scale)}" font-weight="800" fill="white">${status}</text>` : ''}
      <text x="${Math.round(16 * scale)}" y="${Math.round(36 * scale)}" font-family="system-ui,sans-serif" font-size="${fs1}" font-weight="800" fill="${t.text}">${escapeXml(price || '—')}</text>
      <text x="${Math.round(16 * scale)}" y="${Math.round(64 * scale)}" font-family="system-ui,sans-serif" font-size="${fs2}" font-weight="600" fill="${color}">${escapeXml(line2)}</text>
      ${line3 ? `<text x="${Math.round(16 * scale)}" y="${Math.round(90 * scale)}" font-family="system-ui,sans-serif" font-size="${fs3}" font-weight="500" fill="${t.subText}">${escapeXml(line3)}</text>` : ''}
      <polygon points="${w / 2 - arrow},${h - 1} ${w / 2},${h + arrow - 1} ${w / 2 + arrow},${h - 1}" fill="${t.bgStrong}"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(w, h + arrow),
    anchor: new google.maps.Point(w / 2, h + arrow),
  };
}

function getLabel(lead: Lead): string {
  const isMLS = !!lead.listing_status;
  if (isMLS) {
    if (lead.listing_status === 'Sold' && lead.selling_price) {
      return `SOLD $${Math.round(lead.selling_price / 1000)}K`;
    }
    if (lead.listing_status === 'Active' && lead.listing_price) {
      return `$${Math.round(lead.listing_price / 1000)}K`;
    }
    return lead.listing_status?.toUpperCase() || 'MLS';
  }
  // Prospect — show first name
  const name = lead.owner_name || lead.name || '';
  const firstName = name.split(' ')[0];
  return firstName.length > 12 ? firstName.slice(0, 10) + '..' : firstName || '•';
}

function StreetViewInner({ leads, startPosition, onDataChanged, onPositionChanged }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const apiLoaded = useApiIsLoaded();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const leadsRef = useRef<Lead[]>([]);
  const visibleLeadIdsRef = useRef<Set<string>>(new Set());
  const [walkPinMode] = useState<PinMode>('labels');
  const walkPinModeRef = useRef<PinMode>('labels');
  // Split: reference at bottom (context), lead at top (call workflow)
  const [walkReference, setWalkReference] = useState<Lead | null>(null);
  const [walkActiveLead, setWalkActiveLead] = useState<Lead | null>(null);
  // Reference card: draggable + expandable + pinnable (desktop)
  const [refCardPos, setRefCardPos] = useState<{ x: number; y: number } | null>(null);
  const [refCardExpanded, setRefCardExpanded] = useState(false);
  const [refCardPinned, setRefCardPinned] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  leadsRef.current = leads;

  useEffect(() => {
    if (!apiLoaded || !containerRef.current || panoramaRef.current) return;

    const pos = startPosition || { lat: 36.3008, lng: -119.7828 };

    const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
      position: pos,
      pov: { heading: 0, pitch: 0 },
      zoom: 1,
      addressControl: true,
      linksControl: true,
      panControl: true,
      enableCloseButton: false,
      fullscreenControl: true,
      motionTracking: false,
      motionTrackingControl: true,
    });

    panoramaRef.current = panorama;

    const refresh = () => {
      const p = panorama.getPosition();
      if (!p) return;
      const heading = panorama.getPov()?.heading || 0;
      onPositionChanged?.({ lat: p.lat(), lng: p.lng() });
      refreshMarkers(panorama, p.lat(), p.lng(), heading, walkPinModeRef.current);
    };

    // Refresh on walk, pan/turn, AND zoom (so cards scale with zoom)
    panorama.addListener("position_changed", refresh);
    panorama.addListener("pov_changed", refresh);
    panorama.addListener("zoom_changed", refresh);

    setTimeout(refresh, 1000);

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      panoramaRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLoaded]);

  useEffect(() => {
    const panorama = panoramaRef.current;
    if (!panorama) return;
    const p = panorama.getPosition();
    if (p) {
      const heading = panorama.getPov()?.heading || 0;
      refreshMarkers(panorama, p.lat(), p.lng(), heading, walkPinModeRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  // Re-render markers when walk pin mode changes
  useEffect(() => {
    walkPinModeRef.current = walkPinMode;
    const panorama = panoramaRef.current;
    if (!panorama) return;
    const p = panorama.getPosition();
    if (p) {
      const heading = panorama.getPov()?.heading || 0;
      refreshMarkers(panorama, p.lat(), p.lng(), heading, walkPinMode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walkPinMode]);

  function refreshMarkers(panorama: google.maps.StreetViewPanorama, camLat: number, camLng: number, camHeading: number, pinMode: PinMode = 'detail') {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const currentlyVisible = new Set<string>();

    leadsRef.current.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      // Distance filter
      const dist = haversine(camLat, camLng, lead.latitude, lead.longitude);
      if (dist > MAX_DISTANCE) return;

      // Heading filter — only show pins in front of the camera
      const pinBearing = bearing(camLat, camLng, lead.latitude, lead.longitude);
      if (angleDiff(camHeading, pinBearing) > FOV_HALF) return;

      currentlyVisible.add(lead.id);
      const isNewlyVisible = !visibleLeadIdsRef.current.has(lead.id);

      const isMLS = !!lead.listing_status;
      const color = isMLS
        ? (LISTING_STATUS_COLORS[lead.listing_status!] || "#6b7280")
        : (STATUS_COLORS[lead.status] || "#3b82f6");

      // Scale by distance: closer = bigger. Also factor in SV zoom level.
      const svZoom = panorama.getZoom() || 1;
      const zoomBoost = 1 + (svZoom - 1) * 0.4; // zoom 1=1x, zoom 2=1.4x, zoom 3=1.8x, zoom 5=2.6x
      const distScale = dist < 30 ? 1.6 : dist < 60 ? 1.3 : 1.0;
      const scale = distScale * zoomBoost;
      const isContext = lead.record_type === 'context' || !lead.user_id || !!lead.listing_status;

      let icon;
      if (isContext && pinMode === 'detail') {
        icon = makeDetailCardIcon(lead, color, scale, isDark);
      } else if (isContext && pinMode === 'labels') {
        icon = makeRichLabelIcon(lead, color, scale, isDark);
      } else if (pinMode === 'dots') {
        icon = { path: google.maps.SymbolPath.CIRCLE, scale: Math.round(6 * scale), fillColor: color, fillOpacity: 1, strokeColor: isDark ? '#ffffff' : '#1e293b', strokeWeight: 2 } as google.maps.Symbol;
      } else {
        const label = getLabel(lead);
        icon = makeNameTagIcon(label, color, scale, isDark);
      }

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        map: panorama,
        title: lead.property_address || lead.name || '',
        icon,
        animation: isNewlyVisible ? google.maps.Animation.DROP : undefined,
      });

      marker.addListener("click", () => {
        const isRef = !!lead.listing_status;
        if (isRef) {
          setWalkReference(lead);
          setRefCardPos(null); // reset position for new reference
          setRefCardExpanded(false);
        } else {
          setWalkActiveLead(lead);
        }
      });
      markersRef.current.push(marker);
    });

    visibleLeadIdsRef.current = currentlyVisible;
  }

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ touchAction: 'none' }}>
      <div ref={containerRef} className="h-full w-full" />

      {/* ── LEAD / PROSPECT — top of screen (call workflow) ── */}
      {walkActiveLead && (
        <div className="absolute top-4 right-4 z-50 w-[340px] max-h-[45vh] overflow-y-auto rounded-2xl shadow-2xl border border-card-border bg-card">
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={() => setWalkActiveLead(null)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-surface/80 backdrop-blur-sm text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
          <PropertyPopup lead={walkActiveLead} onUpdate={() => onDataChanged?.()} walkMode />
        </div>
      )}

      {/* ── REFERENCE PROPERTY — draggable on desktop, bottom sheet on mobile ── */}
      {walkReference && (
        <div
          className={`absolute z-50 ${
            refCardPos
              ? '' // positioned by inline style when dragged
              : 'bottom-4 left-4 right-4 md:left-auto md:right-4'
          } w-auto md:w-[380px] ${refCardExpanded ? 'max-h-[70vh]' : 'max-h-[40vh]'} overflow-y-auto rounded-2xl shadow-2xl bg-card/95 backdrop-blur-xl transition-[max-height] duration-200`}
          style={refCardPos ? { left: refCardPos.x, top: refCardPos.y, right: 'auto', bottom: 'auto' } : undefined}
        >
          {/* Drag handle + controls (desktop only) */}
          <div
            className="hidden md:flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing select-none border-b border-card-border/50"
            onMouseDown={(e) => {
              const card = e.currentTarget.parentElement;
              if (!card) return;
              const rect = card.getBoundingClientRect();
              dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };
              const onMove = (ev: MouseEvent) => {
                if (!dragRef.current) return;
                setRefCardPos({
                  x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
                  y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
                });
              };
              const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">drag_indicator</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Reference</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setRefCardExpanded(!refCardExpanded)}
                className="w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:text-primary transition-colors"
                title={refCardExpanded ? 'Collapse' : 'Expand'}
              >
                <span className="material-symbols-outlined text-[14px]">{refCardExpanded ? 'collapse_content' : 'expand_content'}</span>
              </button>
              <button
                onClick={() => setRefCardPinned(!refCardPinned)}
                className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${refCardPinned ? 'text-primary' : 'text-on-surface-variant hover:text-primary'}`}
                title={refCardPinned ? 'Unpin' : 'Pin'}
              >
                <span className="material-symbols-outlined text-[14px]" style={refCardPinned ? { fontVariationSettings: "'FILL' 1" } : undefined}>push_pin</span>
              </button>
              <button
                onClick={() => { if (!refCardPinned) { setWalkReference(null); setRefCardPos(null); setRefCardExpanded(false); } }}
                className="w-6 h-6 flex items-center justify-center rounded text-on-surface-variant hover:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </div>
          {/* Mobile close button */}
          <div className="md:hidden absolute top-2 right-2 z-10">
            <button
              onClick={() => { setWalkReference(null); setRefCardPos(null); }}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-surface/80 backdrop-blur-sm text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
          <PropertyPopup lead={walkReference} onUpdate={() => onDataChanged?.()} walkMode />
        </div>
      )}
    </div>
  );
}

export default function StreetViewProspecting({ leads, startPosition, onDataChanged, onPositionChanged }: Props) {
  return (
    <APIProvider apiKey={API_KEY}>
      <StreetViewInner leads={leads} startPosition={startPosition} onDataChanged={onDataChanged} onPositionChanged={onPositionChanged} />
    </APIProvider>
  );
}
