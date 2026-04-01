"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer, Renderer, Cluster } from "@googlemaps/markerclusterer";
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

/** Custom cluster renderer: blue circle with white count text */
class BlueCircleRenderer implements Renderer {
  render(cluster: Cluster, stats: { clusters: { markers: { max: number } } }): google.maps.Marker {
    const count = cluster.count;
    const position = cluster.position;

    // Scale size based on cluster count relative to max
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

    const marker = new google.maps.Marker({
      position,
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      },
      zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
    });

    return marker;
  }
}

function LeadMarkers({
  leads,
  onMarkerClick,
}: {
  leads: Lead[];
  onMarkerClick: (lead: Lead) => void;
}) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    if (!map) return;

    // Clear existing clusterer and markers
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.setMap(null);
      clustererRef.current = null;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    leads.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      const color = STATUS_COLORS[lead.status] || "#6b7280";

      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
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

    // Create clusterer with all markers
    const clusterer = new MarkerClusterer({
      map,
      markers: markersRef.current,
      renderer: new BlueCircleRenderer(),
    });
    clustererRef.current = clusterer;

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current.setMap(null);
        clustererRef.current = null;
      }
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
