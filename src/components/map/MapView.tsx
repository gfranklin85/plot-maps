"use client";

import { useState, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  Pin,
} from "@vis.gl/react-google-maps";
import { Lead, STATUS_COLORS } from "@/types";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import PropertyPopup from "./PropertyPopup";

interface Props {
  leads: Lead[];
  onLeadClick?: (id: string) => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Map style: muted/light theme similar to CartoDB Positron
const MAP_ID = "DEMO_MAP_ID";

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
        mapId={MAP_ID}
        className="h-full w-full rounded-2xl"
        disableDefaultUI={false}
        zoomControl={true}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="greedy"
        styles={[
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
        ]}
      >
        {leads.map((lead) => {
          if (lead.latitude == null || lead.longitude == null) return null;

          const color = STATUS_COLORS[lead.status] || "#6b7280";

          return (
            <AdvancedMarker
              key={lead.id}
              position={{ lat: lead.latitude, lng: lead.longitude }}
              onClick={() => handleMarkerClick(lead)}
              title={lead.property_address || lead.name}
            >
              <Pin
                background={color}
                glyphColor="#ffffff"
                borderColor="#ffffff"
                scale={1.1}
              />
            </AdvancedMarker>
          );
        })}

        {selectedLead &&
          selectedLead.latitude != null &&
          selectedLead.longitude != null && (
            <InfoWindow
              position={{
                lat: selectedLead.latitude,
                lng: selectedLead.longitude,
              }}
              onCloseClick={handleCloseInfo}
              pixelOffset={[0, -40]}
            >
              <PropertyPopup lead={selectedLead} />
            </InfoWindow>
          )}
      </Map>
    </APIProvider>
  );
}
