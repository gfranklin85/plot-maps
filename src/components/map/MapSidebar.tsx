'use client';

// MapSidebar → the BOTTOM COCKPIT DASH. The map is a contained "windshield"
// above; all chrome lives in one soft-light bottom bar (no side rail, no
// overlay over the map). Flight first; the dash reads like a cockpit.
// Soft light palette, consistent with the rest of the app.
// See memory/project_map_page_finished_sidebar (correction 2 + palette).

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Lead } from '@/types';
import type { MapMode } from '@/lib/useMapMode';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';

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

const MODES: { mode: MapMode; icon: string; label: string }[] = [
  { mode: 'WORK_2D', icon: 'grid_view', label: '2D' },
  { mode: 'FLY_3D', icon: 'flight', label: '3D' },
  { mode: 'WALK', icon: 'directions_walk', label: 'Walk' },
];

export default function MapSidebar(p: MapSidebarProps) {
  // Pop-up sheets that rise above the dash: search results + tools.
  // The PROPERTY card no longer lives here — it now opens in the LEFT MATTE
  // beside the shrunk map (the map scales down to make room, never covered).
  // See .map-card-col in globals.css + the page's .is-carded handling.
  const [sheet, setSheet] = useState<'search' | 'tools' | null>(null);
  const toggle = (k: 'search' | 'tools') => setSheet((c) => (c === k ? null : k));

  return (
    <>
      {/* a pop-up SHEET that rises from the dash — for search results + tools. */}
      {sheet && (
        <div className="map-sheet">
          <div className="map-sheet__head">
            <span className="map-sheet__title">
              {sheet === 'search' ? 'Search' : 'Tools & layers'}
            </span>
            <button className="map-sheet__close" onClick={() => setSheet(null)} aria-label="Close">
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>
          <div className="map-sheet__body">
            {sheet === 'search' && p.resultTotal > 0 && (
              <div className="map-dash__pager">
                <span>{p.resultIndex != null ? p.resultIndex + 1 : '–'} of {p.resultTotal} results</span>
                <div className="map-dash__pagerbtns">
                  <button onClick={p.onPrevResult} aria-label="Previous"><MaterialIcon icon="chevron_left" /></button>
                  <button onClick={p.onNextResult} aria-label="Next"><MaterialIcon icon="chevron_right" /></button>
                </div>
              </div>
            )}
            {sheet === 'tools' && (
              <div className="map-sheet__tools">
                <Tool icon="flight_takeoff" label="Fly somewhere" active={p.destinationsOpen} onClick={p.onFlySomewhere} />
                <Tool icon="ads_click" label="Select prospects" active={p.prospectMode} onClick={p.onSelectProspects} />
                {p.view3D && <Tool icon="tune" label="Flight feel" active={p.flightFeelOpen} onClick={p.onFlightFeel} />}
                <Tool icon="layers" label="Parcel layer" active={p.showParcels} onClick={p.onToggleParcels} pill />
                {p.photoreal?.visible && <Tool icon="terrain" label="Photorealistic 3D" active={p.photoreal.on} onClick={p.photoreal.onToggle} pill />}
                <Tool icon={p.poisVisible ? 'visibility' : 'visibility_off'} label="POI labels" active={p.poisVisible} onClick={p.onTogglePois} pill />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── the bottom cockpit dash ── */}
      <div className="map-dash">
        <Link href="/" className="map-dash__brand" aria-label="Home" title="Home">
          <PlotMapsLogo color="#0c1322" className="h-5 w-auto" />
        </Link>

        <div className="map-dash__search">{p.searchSlot}</div>

        {/* mode segmented */}
        <div className="map-dash__modes">
          {MODES.map((m) => {
            const disabled = (m.mode === 'FLY_3D' && !p.has3DSupport) || (m.mode === 'WALK' && !p.isSubscribed);
            return (
              <button
                key={m.mode}
                onClick={() => { if (!disabled) p.onMode(m.mode); }}
                disabled={disabled}
                className={`map-dash__mode ${p.mapMode === m.mode ? 'is-active' : ''}`}
                title={m.label}
              >
                <MaterialIcon icon={m.icon} className="text-[17px]" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* dash buttons → sheets */}
        <button className={`map-dash__btn ${sheet === 'tools' ? 'is-active' : ''}`} onClick={() => toggle('tools')} title="Tools & layers">
          <MaterialIcon icon="tune" className="text-[20px]" />
        </button>
        <button
          className={`map-dash__btn ${p.selectedLead ? 'is-active' : ''}`}
          onClick={() => { if (p.selectedLead) p.onCloseCard(); }}
          disabled={!p.selectedLead}
          title={p.selectedLead ? 'Close property card' : 'Property'}
        >
          <MaterialIcon icon="home_work" className="text-[20px]" />
        </button>
      </div>
    </>
  );
}

function Tool({ icon, label, active, onClick, pill }: { icon: string; label: string; active?: boolean; onClick: () => void; pill?: boolean }) {
  return (
    <button className={`map-sheet__tool ${active ? 'is-active' : ''}`} onClick={onClick}>
      <MaterialIcon icon={icon} className="text-[18px]" />
      <span className="map-sheet__tool-label">{label}</span>
      {pill && <span className={`map-sheet__pill ${active ? 'on' : ''}`}>{active ? 'ON' : 'OFF'}</span>}
    </button>
  );
}
