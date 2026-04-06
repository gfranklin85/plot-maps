"use client";

import { useEffect, useRef } from "react";
import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface Pin {
  lat: number;
  lng: number;
  color: string;
}

function PinDropper({ pins }: { pins: Pin[] }) {
  const map = useMap();
  const markersRef = useRef<google.maps.Marker[]>([]);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!map || pins.length === 0) return;

    // Only add NEW pins (ones added since last render)
    const newPins = pins.slice(prevCountRef.current);
    prevCountRef.current = pins.length;

    newPins.forEach((pin) => {
      const marker = new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map,
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: pin.color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
      markersRef.current.push(marker);
    });

    // Auto-fit bounds to show all pins
    if (pins.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      pins.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }

    return undefined;
  }, [map, pins]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      prevCountRef.current = 0;
    };
  }, []);

  return null;
}

export default function ImportMiniMap({ pins }: { pins: Pin[] }) {
  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={{ lat: 36.3008, lng: -119.7828 }}
        defaultZoom={13}
        className="h-full w-full"
        disableDefaultUI
        zoomControl
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        gestureHandling="cooperative"
      >
        <PinDropper pins={pins} />
      </Map>
    </APIProvider>
  );
}
