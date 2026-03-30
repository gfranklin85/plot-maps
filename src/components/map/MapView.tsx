"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Lead, STATUS_COLORS } from "@/types";
import { MAP_CENTER, MAP_ZOOM } from "@/lib/constants";
import PropertyPopup from "./PropertyPopup";

// Fix Leaflet default icon issue with webpack
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface Props {
  leads: Lead[];
  onLeadClick?: (id: string) => void;
}

export default function MapView({ leads, onLeadClick }: Props) {
  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={MAP_ZOOM}
      className="h-full w-full rounded-2xl"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {leads.map((lead) => {
        if (lead.latitude == null || lead.longitude == null) return null;

        const icon = L.divIcon({
          className: "custom-marker",
          html: `<div style="background:${STATUS_COLORS[lead.status]};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        return (
          <Marker
            key={lead.id}
            position={[lead.latitude, lead.longitude]}
            icon={icon}
            eventHandlers={{
              click: () => onLeadClick?.(lead.id),
            }}
          >
            <Popup closeButton={true} maxWidth={340} minWidth={280}>
              <PropertyPopup lead={lead} />
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
