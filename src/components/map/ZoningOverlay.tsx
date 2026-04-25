'use client';

import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

// Color palette by zoning code prefix. Lemoore's actual zone codes
// follow the standard CA municipal pattern: R-* residential, C-*
// commercial, M-* manufacturing, OS open space, PF public facility, etc.
// Anything we don't recognize gets a neutral grey.
function colorForZone(code: string | null | undefined): string {
  if (!code) return '#64748b';
  const c = code.toUpperCase();
  if (c.startsWith('R-')) return '#22c55e';   // residential — emerald
  if (c.startsWith('R/')) return '#22c55e';
  if (c.startsWith('C-')) return '#3b82f6';   // commercial — blue
  if (c.startsWith('M-')) return '#a855f7';   // manufacturing/industrial — violet
  if (c.startsWith('OS')) return '#10b981';   // open space — teal
  if (c.startsWith('PF')) return '#f59e0b';   // public facility — amber
  if (c.startsWith('PUD')) return '#ec4899';  // planned unit dev — pink
  if (c.startsWith('A-')) return '#84cc16';   // agricultural — lime
  return '#64748b';
}

interface Props {
  visible: boolean;
}

export default function ZoningOverlay({ visible }: Props) {
  const map = useMap();
  const dataLayerRef = useRef<google.maps.Data | null>(null);
  const loadedRef = useRef(false);

  // Load GeoJSON exactly once on first toggle-on.
  useEffect(() => {
    if (!map || !visible) return;

    if (!dataLayerRef.current) {
      dataLayerRef.current = new google.maps.Data({ map });
      dataLayerRef.current.setStyle((feature) => {
        const code = feature.getProperty('ZONECODE') as string | null;
        const fill = colorForZone(code);
        return {
          fillColor: fill,
          fillOpacity: 0.22,
          strokeColor: fill,
          strokeOpacity: 0.55,
          strokeWeight: 1,
          clickable: false, // let underlying pin clicks pass through
        };
      });
    }

    if (!loadedRef.current) {
      loadedRef.current = true;
      fetch('/api/parcel/zoning-layer')
        .then(r => r.ok ? r.json() : null)
        .then(geojson => {
          if (!geojson || !dataLayerRef.current) return;
          dataLayerRef.current.addGeoJson(geojson);
        })
        .catch(() => { /* silent */ });
    }

    dataLayerRef.current.setMap(map);
  }, [map, visible]);

  // Hide the layer (don't remove the data — re-show is instant)
  useEffect(() => {
    if (!dataLayerRef.current) return;
    dataLayerRef.current.setMap(visible ? map : null);
  }, [visible, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dataLayerRef.current) {
        dataLayerRef.current.setMap(null);
        dataLayerRef.current = null;
      }
    };
  }, []);

  return null;
}
