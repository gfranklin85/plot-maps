"use client";

import { useEffect, useRef, useState } from "react";
import { APIProvider, useApiIsLoaded } from "@vis.gl/react-google-maps";
import { Lead, STATUS_COLORS, LISTING_STATUS_COLORS } from "@/types";
import PropertyPopup from "./PropertyPopup";
import { createRoot } from "react-dom/client";

interface Props {
  leads: Lead[];
  startPosition?: { lat: number; lng: number };
  onDataChanged?: () => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

function StreetViewInner({ leads, startPosition, onDataChanged }: Props) {
  const apiLoaded = useApiIsLoaded();
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const popupRootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize panorama
  useEffect(() => {
    if (!apiLoaded || !containerRef.current) return;

    const defaultPos = startPosition || { lat: 36.3008, lng: -119.7828 }; // Lemoore center

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
    infoWindowRef.current = new google.maps.InfoWindow();
    setReady(true);

    return () => {
      // Cleanup
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      infoWindowRef.current?.close();
    };
  }, [apiLoaded, startPosition]);

  // Place markers for leads
  useEffect(() => {
    if (!ready || !panoramaRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const panorama = panoramaRef.current;
    const infoWindow = infoWindowRef.current!;

    leads.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      const isMLS = !!lead.listing_status;
      const color = isMLS
        ? (LISTING_STATUS_COLORS[lead.listing_status!] || "#6b7280")
        : (STATUS_COLORS[lead.status] || "#3b82f6");

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        map: panorama,
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
        // Create popup content
        const div = document.createElement("div");
        div.style.maxHeight = "500px";
        div.style.overflowY = "auto";

        // Clean up previous root
        if (popupRootRef.current) {
          popupRootRef.current.unmount();
        }

        const root = createRoot(div);
        popupRootRef.current = root;
        root.render(
          <PopupWrapper lead={lead} onUpdate={onDataChanged} walkMode />
        );

        infoWindow.setContent(div);
        infoWindow.setOptions({ pixelOffset: new google.maps.Size(0, 20) }); // push below marker
        infoWindow.open(panorama, marker);
      });

      markersRef.current.push(marker);
    });
  }, [ready, leads, onDataChanged]);

  return (
    <div ref={containerRef} className="h-full w-full" />
  );
}

// Wrapper to provide profile context inside the InfoWindow (rendered outside React tree)
import { ProfileProvider } from "@/lib/profile-context";

function PopupWrapper({ lead, onUpdate, walkMode }: { lead: Lead; onUpdate?: () => void; walkMode?: boolean }) {
  return (
    <ProfileProvider>
      <PropertyPopup lead={lead} onUpdate={onUpdate} walkMode={walkMode} />
    </ProfileProvider>
  );
}

export default function StreetViewProspecting({ leads, startPosition, onDataChanged }: Props) {
  return (
    <APIProvider apiKey={API_KEY}>
      <StreetViewInner leads={leads} startPosition={startPosition} onDataChanged={onDataChanged} />
    </APIProvider>
  );
}
