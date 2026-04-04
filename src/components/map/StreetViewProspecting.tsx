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
const MAX_DISTANCE_METERS = 150;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function StreetViewInner({ leads, startPosition, onDataChanged, onPositionChanged }: Props) {
  const apiLoaded = useApiIsLoaded();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const leadsRef = useRef<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Keep leads ref in sync
  leadsRef.current = leads;

  // Initialize panorama once
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

    // On every position change, update which markers are visible
    panorama.addListener("position_changed", () => {
      const p = panorama.getPosition();
      if (!p) return;
      const camLat = p.lat();
      const camLng = p.lng();

      onPositionChanged?.({ lat: camLat, lng: camLng });
      refreshMarkers(panorama, camLat, camLng);
    });

    // Initial marker placement after panorama loads
    setTimeout(() => {
      const p = panorama.getPosition();
      if (p) refreshMarkers(panorama, p.lat(), p.lng());
    }, 1000);

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      panoramaRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiLoaded]);

  // When leads change, refresh markers at current position
  useEffect(() => {
    const panorama = panoramaRef.current;
    if (!panorama) return;
    const p = panorama.getPosition();
    if (p) refreshMarkers(panorama, p.lat(), p.lng());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  function refreshMarkers(panorama: google.maps.StreetViewPanorama, camLat: number, camLng: number) {
    // Remove old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Add nearby leads as markers
    leadsRef.current.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      const dist = haversine(camLat, camLng, lead.latitude, lead.longitude);
      if (dist > MAX_DISTANCE_METERS) return;

      const isMLS = !!lead.listing_status;
      const color = isMLS
        ? (LISTING_STATUS_COLORS[lead.listing_status!] || "#6b7280")
        : (STATUS_COLORS[lead.status] || "#3b82f6");

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        map: panorama,
        title: lead.property_address || lead.name || '',
        icon: {
          path: isMLS
            ? "M -18,-10 L 18,-10 L 18,10 L -18,10 Z"
            : google.maps.SymbolPath.CIRCLE,
          scale: isMLS ? 1 : 14,
          fillColor: color,
          fillOpacity: 0.95,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        label: isMLS ? {
          text: lead.listing_status === 'Sold' ? '$ SOLD' : lead.listing_status === 'Active' ? 'FOR SALE' : 'PENDING',
          color: '#ffffff',
          fontSize: '9px',
          fontWeight: 'bold',
        } : undefined,
      });

      marker.addListener("click", () => setSelectedLead(lead));
      markersRef.current.push(marker);
    });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {selectedLead && (
        <div className="absolute top-4 right-4 z-50 w-[340px] max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl shadow-2xl border border-gray-200">
          <button
            onClick={() => setSelectedLead(null)}
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 text-gray-500 hover:text-red-500 hover:bg-white shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
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
