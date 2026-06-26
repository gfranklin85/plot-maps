'use client';

// MapSidebar — the single clean LEFT panel for the finished map UI. Holds
// search + 2D/3D/Walk toggle + tool toggles + the property card. Pure
// presentation: the map page owns all state and passes handlers in.
// Light theme to match the rest of the finished product.
// See memory/project_map_page_finished_sidebar.

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { Lead } from '@/types';
import type { MapMode } from '@/lib/useMapMode';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import SidebarPropertyCard from '@/components/map/SidebarPropertyCard';

export interface MapSidebarProps {
  /** the search control (ProspectSearch, wired by the page) */
  searchSlot: ReactNode;
  /** result pager */
  resultIndex: number | null; // 0-based
  resultTotal: number;
  onPrevResult: () => void;
  onNextResult: () => void;

  // view mode
  mapMode: MapMode;
  onMode: (m: MapMode) => void;
  has3DSupport: boolean;
  isSubscribed: boolean;

  // tool toggles
  onFlySomewhere: () => void;
  destinationsOpen: boolean;
  onFlightFeel: () => void;
  flightFeelOpen: boolean;
  view3D: boolean;
  onSelectProspects: () => void;
  prospectMode: boolean;
  onToggleParcels: () => void;
  showParcels: boolean;
  onTogglePois: () => void;
  poisVisible: boolean;
  photoreal?: { visible: boolean; on: boolean; onToggle: () => void };

  // selected property
  selectedLead: Lead | null;
  onCloseCard: () => void;
}

const MODES: { mode: MapMode; icon: string; label: string }[] = [
  { mode: 'WORK_2D', icon: 'grid_view', label: '2D' },
  { mode: 'FLY_3D', icon: 'flight', label: '3D' },
  { mode: 'WALK', icon: 'directions_walk', label: 'Walk' },
];

export default function MapSidebar(p: MapSidebarProps) {
  return (
    <aside className="map-sidebar">
      {/* brand / way home (replaces the old MapNavOverlay) */}
      <Link href="/" className="map-sidebar__brand" aria-label="Home">
        <PlotMapsLogo color="#0c1322" className="h-6 w-auto" />
        <span className="map-sidebar__by">by <b>position</b></span>
      </Link>

      {/* search */}
      <div className="map-sidebar__search">{p.searchSlot}</div>

      {/* result pager */}
      {p.resultTotal > 0 && (
        <div className="map-sidebar__pager">
          <span>{p.resultIndex != null ? p.resultIndex + 1 : '–'} of {p.resultTotal} results</span>
          <div className="map-sidebar__pagerbtns">
            <button onClick={p.onPrevResult} aria-label="Previous"><MaterialIcon icon="chevron_left" /></button>
            <button onClick={p.onNextResult} aria-label="Next"><MaterialIcon icon="chevron_right" /></button>
          </div>
        </div>
      )}

      {/* view toggle */}
      <div className="map-sidebar__modes">
        {MODES.map((m) => {
          const disabled = (m.mode === 'FLY_3D' && !p.has3DSupport) || (m.mode === 'WALK' && !p.isSubscribed);
          const active = p.mapMode === m.mode;
          return (
            <button
              key={m.mode}
              onClick={() => { if (!disabled) p.onMode(m.mode); }}
              disabled={disabled}
              className={`map-sidebar__mode ${active ? 'is-active' : ''}`}
              title={disabled ? (m.mode === 'FLY_3D' ? '3D needs photoreal tiles' : 'Walk is a subscriber feature') : m.label}
            >
              <MaterialIcon icon={m.icon} className="text-[18px]" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* tool toggles — two columns */}
      <div className="map-sidebar__tools">
        <Tool icon="flight_takeoff" label="Fly somewhere" active={p.destinationsOpen} onClick={p.onFlySomewhere} />
        <Tool icon="ads_click" label="Select prospects" active={p.prospectMode} onClick={p.onSelectProspects} />
        {p.view3D && <Tool icon="tune" label="Flight feel" active={p.flightFeelOpen} onClick={p.onFlightFeel} />}
        <Tool icon="layers" label="Parcel layer" active={p.showParcels} onClick={p.onToggleParcels} />
        {p.photoreal?.visible && (
          <Tool icon="terrain" label="Photorealistic 3D" active={p.photoreal.on} onClick={p.photoreal.onToggle} pill />
        )}
        <Tool icon={p.poisVisible ? 'visibility' : 'visibility_off'} label="POI labels" active={p.poisVisible} onClick={p.onTogglePois} pill />
      </div>

      {/* property card */}
      {p.selectedLead && (
        <div className="map-sidebar__card">
          <SidebarPropertyCard lead={p.selectedLead} onClose={p.onCloseCard} />
        </div>
      )}
    </aside>
  );
}

function Tool({ icon, label, active, onClick, pill }: { icon: string; label: string; active?: boolean; onClick: () => void; pill?: boolean }) {
  return (
    <button className={`map-sidebar__tool ${active ? 'is-active' : ''}`} onClick={onClick}>
      <MaterialIcon icon={icon} className="text-[18px]" />
      <span className="map-sidebar__tool-label">{label}</span>
      {pill && <span className={`map-sidebar__pill ${active ? 'on' : ''}`}>{active ? 'ON' : 'OFF'}</span>}
    </button>
  );
}
