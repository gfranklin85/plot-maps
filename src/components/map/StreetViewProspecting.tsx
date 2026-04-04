"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { APIProvider, useApiIsLoaded } from "@vis.gl/react-google-maps";
import { Lead, STATUS_COLORS, LISTING_STATUS_COLORS } from "@/types";
import PropertyPopup from "./PropertyPopup";

interface Props {
  leads: Lead[];
  startPosition?: { lat: number; lng: number };
  onDataChanged?: () => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const VISIBILITY_RADIUS_METERS = 80; // Only show pins within this distance

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function StreetViewInner({ leads, startPosition, onDataChanged }: Props) {
  const apiLoaded = useApiIsLoaded();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const markersRef = useRef<{ marker: google.maps.Marker; lead: Lead }[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Initialize panorama
  useEffect(() => {
    if (!apiLoaded || !containerRef.current) return;

    const defaultPos = startPosition || { lat: 36.3008, lng: -119.7828 };

    const panorama = new google.maps.StreetViewPanorama(containerRef.current, {
      position: defaultPos,
      pov: { heading: 0, pitch: 0 },
      zoom: 1,
      addressControl: true,
      linksControl: true,
      panControl: true,
      enableCloseButton: false,
      fullscreenControl: true,
      motionTracking: false,
    });

    panoramaRef.current = panorama;
    setReady(true);

    return () => {
      markersRef.current.forEach((m) => m.marker.setMap(null));
      markersRef.current = [];
    };
  }, [apiLoaded, startPosition]);

  // Update marker visibility based on camera position
  const updateMarkerVisibility = useCallback(() => {
    const panorama = panoramaRef.current;
    if (!panorama) return;

    const pos = panorama.getPosition();
    if (!pos) return;
    const camLat = pos.lat();
    const camLng = pos.lng();

    markersRef.current.forEach(({ marker, lead }) => {
      if (lead.latitude == null || lead.longitude == null) return;
      const dist = getDistance(camLat, camLng, lead.latitude, lead.longitude);
      const shouldShow = dist <= VISIBILITY_RADIUS_METERS;
      if (shouldShow && !marker.getMap()) {
        marker.setMap(panorama);
      } else if (!shouldShow && marker.getMap()) {
        marker.setMap(null);
      }
    });
  }, []);

  // Place markers for leads
  useEffect(() => {
    if (!ready || !panoramaRef.current) return;

    markersRef.current.forEach((m) => m.marker.setMap(null));
    markersRef.current = [];

    const panorama = panoramaRef.current;

    leads.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      const isMLS = !!lead.listing_status;
      const color = isMLS
        ? (LISTING_STATUS_COLORS[lead.listing_status!] || "#6b7280")
        : (STATUS_COLORS[lead.status] || "#3b82f6");

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        // Don't set map yet — updateMarkerVisibility will handle it
        title: lead.property_address || lead.name,
        icon: isMLS
          ? {
              path: "M 0,-14 L 10,0 L 0,14 L -10,0 Z",
              scale: 1,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }
          : {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            },
      });

      marker.addListener("click", () => {
        setSelectedLead(lead);
      });

      markersRef.current.push({ marker, lead });
    });

    // Initial visibility check
    updateMarkerVisibility();

    // Listen for position changes (walking)
    const listener = panorama.addListener("position_changed", updateMarkerVisibility);

    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [ready, leads, updateMarkerVisibility]);

  return (
    <div className="relative h-full w-full">
      {/* Street View */}
      <div ref={containerRef} className="h-full w-full" />

      {/* Fixed sidebar popup panel */}
      {selectedLead && (
        <div className="absolute top-4 right-4 z-50 w-[340px] max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl shadow-2xl border border-gray-200">
          {/* Close button */}
          <button
            onClick={() => setSelectedLead(null)}
            className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 text-gray-500 hover:text-red-500 hover:bg-white shadow-md transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
          <PropertyPopup lead={selectedLead} onUpdate={() => { onDataChanged?.(); }} walkMode />
        </div>
      )}
    </div>
  );
}

export default function StreetViewProspecting({ leads, startPosition, onDataChanged }: Props) {
  return (
    <APIProvider apiKey={API_KEY}>
      <StreetViewInner leads={leads} startPosition={startPosition} onDataChanged={onDataChanged} />
    </APIProvider>
  );
}
