"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  useMap,
  InfoWindow,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer, Renderer, Cluster } from "@googlemaps/markerclusterer";
import { Lead, STATUS_COLORS, LISTING_STATUS_COLORS } from "@/types";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import PropertyPopup from "./PropertyPopup";

interface Props {
  leads: Lead[];
  onLeadClick?: (id: string) => void;
  onDataChanged?: () => void;
  onCenterChanged?: (center: { lat: number; lng: number }) => void;
  mapType?: "roadmap" | "satellite" | "hybrid" | "terrain";
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Light/muted map style for roadmap
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d7e8" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef2f7" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8c9bab" }] },
];

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

/** Syncs the mapType prop to the actual google map instance */
function MapTypeSync({ mapType }: { mapType: string }) {
  const map = useMap();
  useEffect(() => {
    if (map) {
      map.setMapTypeId(mapType);
    }
  }, [map, mapType]);
  return null;
}

/** Reports map center changes to parent */
function CenterTracker({ onCenterChanged }: { onCenterChanged?: (c: { lat: number; lng: number }) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !onCenterChanged) return;
    const listener = map.addListener("idle", () => {
      const center = map.getCenter();
      if (center) {
        onCenterChanged({ lat: center.lat(), lng: center.lng() });
      }
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, onCenterChanged]);
  return null;
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

    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.setMap(null);
      clustererRef.current = null;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    leads.forEach((lead) => {
      if (lead.latitude == null || lead.longitude == null) return;

      const isMLS = !!lead.listing_status;
      const color = isMLS
        ? (LISTING_STATUS_COLORS[lead.listing_status!] || "#6b7280")
        : (STATUS_COLORS[lead.status] || "#6b7280");

      // MLS entries get a diamond shape, prospects get a circle
      const marker = new google.maps.Marker({
        position: { lat: lead.latitude, lng: lead.longitude },
        title: lead.property_address || lead.name,
        icon: isMLS
          ? {
              path: "M 0,-12 L 8,0 L 0,12 L -8,0 Z", // diamond
              scale: 1,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }
          : {
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

export default function MapView({ leads, onLeadClick, onDataChanged, onCenterChanged, mapType = "roadmap" }: Props) {
  const isSatellite = mapType === "satellite" || mapType === "hybrid";
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
        className="h-full w-full"
        disableDefaultUI
        zoomControl
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="greedy"
        tilt={0}
        heading={0}
        styles={isSatellite ? undefined : MAP_STYLES}
      >
        <MapTypeSync mapType={mapType} />
        <CenterTracker onCenterChanged={onCenterChanged} />
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
              <PropertyPopup lead={selectedLead} onUpdate={onDataChanged} />
            </InfoWindow>
          )}
      </Map>
    </APIProvider>
  );
}
