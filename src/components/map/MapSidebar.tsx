'use client';

// MapSidebar — VSCode-style: a THIN icon RAIL + a COLLAPSIBLE panel. The map
// page's prime objective is FLIGHT, so the default state is rail-only (full
// map); clicking a rail icon opens its panel, clicking again collapses it.
// Pure presentation — the page owns all state and passes handlers in.
// See memory/project_map_page_finished_sidebar (VSCode correction).

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Lead } from '@/types';
import type { MapMode } from '@/lib/useMapMode';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import SidebarPropertyCard from '@/components/map/SidebarPropertyCard';

export interface MapSidebarProps {
  searchSlot: ReactNode;
  resultIndex: number | null;
  resultTotal: number;
  onPrevResult: () => void;
  onNextResult: () => void;

  mapMode: MapMode;
  onMode: (m: MapMode) => void;
  has3DSupport: boolean;
  isSubscribed: boolean;

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

  selectedLead: Lead | null;
  onCloseCard: () => void;
}

type PanelKey = 'search' | 'tools' | 'property' | null;

const MODES: { mode: MapMode; icon: string; label: string }[] = [
  { mode: 'WORK_2D', icon: 'grid_view', label: '2D' },
  { mode: 'FLY_3D', icon: 'flight', label: '3D' },
  { mode: 'WALK', icon: 'directions_walk', label: 'Walk' },
];

export default function MapSidebar(p: MapSidebarProps) {
  // Default: rail only, no panel — full map (flight first).
  const [panel, setPanel] = useState<PanelKey>(null);

  // When a property gets selected, auto-open the property panel.
  useEffect(() => {
    if (p.selectedLead) setPanel('property');
  }, [p.selectedLead]);

  const toggle = (key: Exclude<PanelKey, null>) => setPanel((cur) => (cur === key ? null : key));

  return (
    <>
      {/* ── the thin activity rail (always present) ── */}
      <nav className="map-rail">
        <Link href="/" className="map-rail__brand" aria-label="Home" title="Home">
          <PlotMapsLogo color="#0c1322" className="h-5 w-auto" />
        </Link>

        <RailBtn icon="search" label="Search" active={panel === 'search'} onClick={() => toggle('search')} />
        <RailBtn icon="tune" label="Tools & layers" active={panel === 'tools'} onClick={() => toggle('tools')} />
        <RailBtn
          icon="home_work"
          label="Property"
          active={panel === 'property'}
          disabled={!p.selectedLead}
          onClick={() => toggle('property')}
        />

        {/* mode quick-pips at the bottom of the rail (always reachable) */}
        <div className="map-rail__spacer" />
        {MODES.map((m) => {
          const disabled = (m.mode === 'FLY_3D' && !p.has3DSupport) || (m.mode === 'WALK' && !p.isSubscribed);
          return (
            <RailBtn
              key={m.mode}
              icon={m.icon}
              label={m.label}
              active={p.mapMode === m.mode}
              disabled={disabled}
              onClick={() => p.onMode(m.mode)}
              small
            />
          );
        })}
      </nav>

      {/* ── the collapsible panel (only when a rail icon is active) ── */}
      {panel && (
        <div className="map-panel">
          <div className="map-panel__head">
            <span className="map-panel__title">
              {panel === 'search' && 'Search'}
              {panel === 'tools' && 'Tools & layers'}
              {panel === 'property' && 'Property'}
            </span>
            <button className="map-panel__close" onClick={() => setPanel(null)} aria-label="Collapse">
              <MaterialIcon icon="left_panel_close" className="text-[20px]" />
            </button>
          </div>

          <div className="map-panel__body">
            {panel === 'search' && (
              <>
                <div className="map-panel__search">{p.searchSlot}</div>
                {p.resultTotal > 0 && (
                  <div className="map-panel__pager">
                    <span>{p.resultIndex != null ? p.resultIndex + 1 : '–'} of {p.resultTotal} results</span>
                    <div className="map-panel__pagerbtns">
                      <button onClick={p.onPrevResult} aria-label="Previous"><MaterialIcon icon="chevron_left" /></button>
                      <button onClick={p.onNextResult} aria-label="Next"><MaterialIcon icon="chevron_right" /></button>
                    </div>
                  </div>
                )}
              </>
            )}

            {panel === 'tools' && (
              <div className="map-panel__tools">
                <Tool icon="flight_takeoff" label="Fly somewhere" active={p.destinationsOpen} onClick={p.onFlySomewhere} />
                <Tool icon="ads_click" label="Select prospects" active={p.prospectMode} onClick={p.onSelectProspects} />
                {p.view3D && <Tool icon="tune" label="Flight feel" active={p.flightFeelOpen} onClick={p.onFlightFeel} />}
                <Tool icon="layers" label="Parcel layer" active={p.showParcels} onClick={p.onToggleParcels} pill />
                {p.photoreal?.visible && (
                  <Tool icon="terrain" label="Photorealistic 3D" active={p.photoreal.on} onClick={p.photoreal.onToggle} pill />
                )}
                <Tool icon={p.poisVisible ? 'visibility' : 'visibility_off'} label="POI labels" active={p.poisVisible} onClick={p.onTogglePois} pill />
              </div>
            )}

            {panel === 'property' && p.selectedLead && (
              <SidebarPropertyCard lead={p.selectedLead} onClose={() => { p.onCloseCard(); setPanel(null); }} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RailBtn({ icon, label, active, disabled, onClick, small }: {
  icon: string; label: string; active?: boolean; disabled?: boolean; onClick: () => void; small?: boolean;
}) {
  return (
    <button
      className={`map-rail__btn ${active ? 'is-active' : ''} ${small ? 'is-small' : ''}`}
      onClick={() => { if (!disabled) onClick(); }}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <MaterialIcon icon={icon} className={small ? 'text-[18px]' : 'text-[22px]'} />
    </button>
  );
}

function Tool({ icon, label, active, onClick, pill }: { icon: string; label: string; active?: boolean; onClick: () => void; pill?: boolean }) {
  return (
    <button className={`map-panel__tool ${active ? 'is-active' : ''}`} onClick={onClick}>
      <MaterialIcon icon={icon} className="text-[18px]" />
      <span className="map-panel__tool-label">{label}</span>
      {pill && <span className={`map-panel__pill ${active ? 'on' : ''}`}>{active ? 'ON' : 'OFF'}</span>}
    </button>
  );
}
