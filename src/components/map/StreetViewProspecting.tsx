"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, useApiIsLoaded } from "@vis.gl/react-google-maps";
import { Lead, STATUS_COLORS, LISTING_STATUS_COLORS } from "@/types";
import PropertyPopup from "./PropertyPopup";

interface Props {
  leads: Lead[];
  startPosition?: { lat: number; lng: number };
  onDataChanged?: () => void;
  onPositionChanged?: (pos: { lat: number; lng: number }) => void;
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

// Generate a floating name tag SVG as a data URI
function makeNameTagIcon(label: string, color: string): google.maps.Icon {
  const textLen = label.length;
  const width = Math.max(60, textLen * 8 + 20);
  const height = 32;
  const arrow = 8;

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
        font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="white">${escapeXml(label)}</text>
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
  const apiLoaded = useApiIsLoaded();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const leadsRef = useRef<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 16, y: 80 });
  const [posLocked, setPosLocked] = useState(false);
  const posLockedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

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
    });

    panoramaRef.current = panorama;

    const refresh = () => {
      const p = panorama.getPosition();
      if (!p) return;
      const heading = panorama.getPov()?.heading || 0;
      onPositionChanged?.({ lat: p.lat(), lng: p.lng() });
      refreshMarkers(panorama, p.lat(), p.lng(), heading);
    };

    // Refresh on walk AND on pan/turn
    panorama.addListener("position_changed", refresh);
    panorama.addListener("pov_changed", refresh);

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
      refreshMarkers(panorama, p.lat(), p.lng(), heading);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  function refreshMarkers(panorama: google.maps.StreetViewPanorama, camLat: number, camLng: number, camHeading: number) {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    leadsRef.current.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      // Distance filter
      const dist = haversine(camLat, camLng, lead.latitude, lead.longitude);
      if (dist > MAX_DISTANCE) return;

      // Heading filter — only show pins in front of the camera
      const pinBearing = bearing(camLat, camLng, lead.latitude, lead.longitude);
      if (angleDiff(camHeading, pinBearing) > FOV_HALF) return;

      const isMLS = !!lead.listing_status;
      const color = isMLS
        ? (LISTING_STATUS_COLORS[lead.listing_status!] || "#6b7280")
        : (STATUS_COLORS[lead.status] || "#3b82f6");

      const label = getLabel(lead);
      const icon = makeNameTagIcon(label, color);

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        map: panorama,
        title: lead.property_address || lead.name || '',
        icon,
      });

      marker.addListener("click", () => {
        setSelectedLead(lead);
        if (!posLockedRef.current) setPopupPos({ x: 16, y: 80 });
      });
      markersRef.current.push(marker);
    });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {selectedLead && (
        <div
          className="fixed z-50 w-[340px] max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl border border-gray-200 select-none"
          style={{ right: `${popupPos.x}px`, top: `${popupPos.y}px` }}
          onMouseDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (e.clientY - rect.top > 36) return;
            setDragging(true);
            dragOffset.current = { x: e.clientX + popupPos.x, y: e.clientY - popupPos.y };
            e.preventDefault();
          }}
          onMouseMove={(e) => {
            if (!dragging) return;
            setPopupPos({ x: dragOffset.current.x - e.clientX, y: e.clientY - dragOffset.current.y });
          }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
        >
          <div className={`flex items-center justify-between px-3 py-1.5 bg-gray-100 rounded-t-2xl cursor-move ${dragging ? 'bg-blue-100' : ''}`}>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
              drag to move
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { const next = !posLocked; setPosLocked(next); posLockedRef.current = next; }}
                className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${posLocked ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-200'}`}
                title={posLocked ? 'Position locked' : 'Lock position'}
              >
                <span className="material-symbols-outlined text-[14px]">{posLocked ? 'lock' : 'lock_open'}</span>
              </button>
              <button
                onClick={() => setSelectedLead(null)}
                className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </div>
          <PropertyPopup lead={selectedLead} onUpdate={() => onDataChanged?.()} walkMode />
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
