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
  // Self-score state takes precedence over generic listing/lead status because
  // an owner-set score is the most authoritative signal we have.
  const scoreClass = lead.self_score_state ? `lp--score-${lead.self_score_state.state}` : null;
  wrapper.className = `lp lp--${status}${scoreClass ? ` ${scoreClass}` : ''}`;
  if (lead.self_score_state?.visibility === 'private_to_initiator') {
    wrapper.classList.add('lp--private');
  }
  // Verification tier — small inline modulator on the score. NOT a separate
  // alert. The score is the headline; verification is the footnote that
  // gauges how much the score can be trusted.
  if (lead.verification_state?.tier && lead.verification_state.tier !== 'unverified') {
    wrapper.classList.add(`lp--verif-${lead.verification_state.tier}`);
  }
  // Tag with the lead id so the airplane-mode reticle can hit-test pins
  // via document.elementFromPoint(centerX, centerY) — same machinery the
  // mouse uses, no projection math needed.
  wrapper.dataset.leadId = lead.id;
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

  // Inquiry overlay — small icon in the top-right of the bubble showing that
  // the user has fired an outreach on this property via this channel.
  if (lead.inquiry_state) {
    const overlay = document.createElement('span');
    overlay.className = 'lp__overlay-inquiry';
    overlay.textContent =
      lead.inquiry_state.channel === 'text_invite' ? 'mail' :
      lead.inquiry_state.channel === 'direct_mail' ? 'inventory_2' :
      'call';
    bubble.appendChild(overlay);
  }

  // Verification badge — small icon in the bottom-right of the bubble.
  // Agent-attested gets a star; owner-name-matched gets a check; manager-
  // claimed gets a person icon. "Needs verification" is intentionally
  // NOT rendered on the map — it's not a state worth competing for the
  // viewer's attention. The score is the headline; verification tier is
  // the footnote, surfaced inline on the marker only when actually present.
  if (lead.verification_state && lead.verification_state.tier !== 'unverified') {
    const tier = lead.verification_state.tier;
    const badge = document.createElement('span');
    badge.className = `lp__overlay-verif lp__overlay-verif--${tier}`;
    badge.textContent =
      tier === 'agent_attested' ? 'verified' :
      tier === 'owner' ? 'check' :
      'person';
    bubble.appendChild(badge);
  }

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
