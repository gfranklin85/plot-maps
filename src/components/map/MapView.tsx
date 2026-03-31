"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { Lead, STATUS_COLORS } from "@/types";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import PropertyPopup from "./PropertyPopup";

interface Props {
  leads: Lead[];
  onLeadClick?: (id: string) => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Light/muted map style
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9d7e8" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#eef2f7" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8c9bab" }],
  },
];

function LeadMarkers({
  leads,
  onMarkerClick,
}: {
  leads: Lead[];
  onMarkerClick: (lead: Lead) => void;
}) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    leads.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      const color = STATUS_COLORS[lead.status] || "#6b7280";

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        map,
        title: lead.property_address || lead.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });

      marker.addListener("click", () => onMarkerClick(lead));
      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, leads, onMarkerClick]);

  return null;
}

export default function MapView({ leads, onLeadClick }: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const handleMarkerClick = useCallback(
    (lead: Lead) => {
      setSelectedLead(lead);
      onLeadClick?.(lead.id);
    },
    [onLeadClick]
  );

  const handleCloseInfo = useCallback(() => {
    setSelectedLead(null);
  }, []);

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={MAP_CENTER}
        defaultZoom={MAP_ZOOM}
        className="h-full w-full rounded-2xl"
        disableDefaultUI={false}
        zoomControl={true}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="greedy"
        styles={MAP_STYLES}
      >
        <LeadMarkers leads={leads} onMarkerClick={handleMarkerClick} />

        {selectedLead &&
          selectedLead.latitude != null &&
          selectedLead.longitude != null && (
            <InfoWindow
              position={{
                lat: selectedLead.latitude,
                lng: selectedLead.longitude,
              }}
              onCloseClick={handleCloseInfo}
              pixelOffset={[0, -35]}
            >
              <PropertyPopup lead={selectedLead} />
            </InfoWindow>
          )}
      </Map>
    </APIProvider>
  );
}
