'use client';

import { useEffect, useRef } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MarkerClusterer, Cluster, Renderer } from '@googlemaps/markerclusterer';
import type { Lead } from '@/types';
import type { PinMode } from './MapView';

// ── Status classification ──
// One source of truth for what a lead's pin should look like. Order matters:
// most "interesting" status wins (hot lead beats called beats listing status).
type PinStatus = 'active' | 'sold' | 'pending' | 'hot' | 'called' | 'cold' | 'lead';

function classifyLead(lead: Lead): PinStatus {
  if (lead.priority === 'high' || lead.status === 'Hot Lead') return 'hot';
  if (lead.listing_status === 'Active') return 'active';
  if (lead.listing_status === 'Sold') return 'sold';
  if (lead.listing_status === 'Pending') return 'pending';
  if (lead.status === 'Called' || lead.status === 'Follow-Up') return 'called';
  if (lead.status === 'Not Contacted' || lead.status === 'New' || lead.status === 'Not Interested' || lead.status === 'Do Not Call') return 'cold';
  return 'lead';
}

// Material Symbol per status — picked to read at a glance
function iconForStatus(status: PinStatus): string {
  switch (status) {
    case 'active':  return 'home';
    case 'sold':    return 'payments';
    case 'pending': return 'schedule';
    case 'hot':     return 'local_fire_department';
    case 'called':  return 'call';
    case 'cold':    return 'person_off';
    default:        return 'place';
  }
}

// Short label for the hover/always-visible pill
function statusLabel(status: PinStatus): string | null {
  switch (status) {
    case 'active':  return 'Active';
    case 'sold':    return 'Sold';
    case 'pending': return 'Pending';
    case 'hot':     return 'Hot';
    case 'called':  return 'Called';
    case 'cold':    return null;
    default:        return null;
  }
}

function shortAddress(lead: Lead): string {
  return lead.property_address?.split(',')[0]?.trim() || lead.name || 'Unknown';
}

function formatPriceShort(price: number | null | undefined): string | null {
  if (!price) return null;
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price}`;
}

// Build the pin DOM for a single lead. AdvancedMarkerElement accepts any
// HTMLElement; CSS in globals.css drives all styling and animation.
function buildPinElement(lead: Lead, pinMode: PinMode): HTMLElement {
  const status = classifyLead(lead);
  const icon = iconForStatus(status);
  const label = statusLabel(status);

  const wrapper = document.createElement('div');
  wrapper.className = `lp lp--${status}`;
  if (pinMode === 'labels') wrapper.classList.add('lp--label-always');

  const tail = document.createElement('div');
  tail.className = 'lp__tail';

  const bubble = document.createElement('div');
  bubble.className = 'lp__bubble';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'lp__icon';
  iconSpan.textContent = icon;
  bubble.appendChild(iconSpan);

  wrapper.appendChild(bubble);
  wrapper.appendChild(tail);

  // Hover pill (Dots mode) and always-visible pill (Labels mode) share markup
  if (pinMode === 'dots' || pinMode === 'labels') {
    const pill = document.createElement('div');
    pill.className = 'lp__label';
    const addr = document.createElement('span');
    addr.textContent = shortAddress(lead);
    pill.appendChild(addr);
    if (label) {
      const statusEl = document.createElement('span');
      statusEl.className = 'lp__label-status';
      statusEl.textContent = label;
      pill.appendChild(statusEl);
    }
    wrapper.appendChild(pill);
  }

  // Detail mode — bigger card with price + status under the pin
  if (pinMode === 'detail') {
    const card = document.createElement('div');
    card.className = 'lp__card';

    const addrLine = document.createElement('span');
    addrLine.className = 'lp__card-line';
    addrLine.textContent = shortAddress(lead);
    card.appendChild(addrLine);

    const priceStr = formatPriceShort(lead.selling_price ?? lead.listing_price);
    if (priceStr) {
      const priceLine = document.createElement('span');
      priceLine.className = 'lp__card-line';
      priceLine.style.opacity = '0.8';
      priceLine.textContent = priceStr;
      card.appendChild(priceLine);
    }
    if (label) {
      const statusEl = document.createElement('span');
      statusEl.className = 'lp__card-status';
      statusEl.textContent = label;
      card.appendChild(statusEl);
    }
    wrapper.appendChild(card);
  }

  return wrapper;
}

// Custom cluster renderer matching the rest of the pin family
class PlotClusterRenderer implements Renderer {
  render(cluster: Cluster, _stats: unknown, map: google.maps.Map) {
    const count = cluster.count;
    const wrapper = document.createElement('div');
    wrapper.className = 'lp-cluster';
    const halo = document.createElement('div');
    halo.className = 'lp-cluster__halo';
    const core = document.createElement('div');
    core.className = 'lp-cluster__core';
    core.textContent = String(count);
    wrapper.appendChild(halo);
    wrapper.appendChild(core);

    const AdvancedMarker = (google.maps as unknown as {
      marker: { AdvancedMarkerElement: new (opts: object) => google.maps.marker.AdvancedMarkerElement };
    }).marker.AdvancedMarkerElement;
    return new AdvancedMarker({
      position: cluster.position,
      content: wrapper,
      map,
      zIndex: 9000 + count,
    });
  }
}

interface Props {
  leads: Lead[];
  onMarkerClick: (lead: Lead) => void;
  pinMode: PinMode;
}

export default function AdvancedLeadMarkers({ leads, onMarkerClick, pinMode }: Props) {
  const map = useMap();
  // Loading the marker library is what gives us google.maps.marker.AdvancedMarkerElement
  const markerLib = useMapsLibrary('marker');
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const handlerRef = useRef(onMarkerClick);
  handlerRef.current = onMarkerClick;

  useEffect(() => {
    if (!map || !markerLib) return;

    // Tear down previous render
    clustererRef.current?.clearMarkers();
    clustererRef.current = null;
    markersRef.current.forEach(m => { m.map = null; });
    markersRef.current = [];

    const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];

    for (const lead of leads) {
      if (lead.latitude == null || lead.longitude == null) continue;

      const content = buildPinElement(lead, pinMode);
      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat: lead.latitude, lng: lead.longitude },
        content,
        title: lead.property_address || lead.name || '',
      });

      marker.addListener('click', () => handlerRef.current?.(lead));
      newMarkers.push(marker);
    }

    markersRef.current = newMarkers;

    if (pinMode === 'dots') {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: newMarkers,
        renderer: new PlotClusterRenderer(),
      });
    } else {
      // Labels / Detail mode: skip clustering, mount each marker directly
      newMarkers.forEach(m => { m.map = map; });
    }

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      markersRef.current.forEach(m => { m.map = null; });
      markersRef.current = [];
    };
  }, [map, markerLib, leads, pinMode]);

  return null;
}
