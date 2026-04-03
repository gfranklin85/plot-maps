'use client';

import { useEffect, useRef } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';

interface Props {
  lat: number | null;
  lng: number | null;
  mapType: 'roadmap' | 'satellite' | 'hybrid';
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

function MarkerAndType({ lat, lng, mapType }: { lat: number; lng: number; mapType: string }) {
  const map = useMap();
  const markerRef = useRef<google.maps.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(mapType);
    map.setTilt(45);
  }, [map, mapType]);

  useEffect(() => {
    if (!map) return;
    if (markerRef.current) {
      markerRef.current.setMap(null);
    }
    markerRef.current = new google.maps.Marker({
      position: { lat, lng },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    });
    return () => {
      markerRef.current?.setMap(null);
    };
  }, [map, lat, lng]);

  return null;
}

export default function LeadMap({ lat, lng, mapType }: Props) {
  if (lat == null || lng == null) return null;

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={{ lat, lng }}
        defaultZoom={18}
        className="h-full w-full rounded-xl"
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        tilt={45}
        heading={0}
      >
        <MarkerAndType lat={lat} lng={lng} mapType={mapType} />
      </Map>
    </APIProvider>
  );
}
