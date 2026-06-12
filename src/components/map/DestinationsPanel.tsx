"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import ProspectSearch from "@/components/dashboard/ProspectSearch";
import {
  PANEL_DESTINATIONS,
  DEFAULT_ARRIVAL_POSE,
  type Destination,
} from "@/lib/destinations";

interface Props {
  visible: boolean;
  /** User's home center (their saved default location). Optional —
   *  when null, no Home card renders. */
  home?: { lat: number; lng: number; label?: string } | null;
  onFlyTo: (target: {
    lat: number;
    lng: number;
    altitude: number;
    heading: number;
    pitch: number;
    range: number;
  }) => void;
  onClose: () => void;
}

/**
 * Destinations overlay — quick-fly to iconic cities or search anywhere.
 *
 * Layout:
 *   - Home card pinned top (user's saved location, always available)
 *   - Curated city grid (9 hand-tuned cinematic arrivals)
 *   - "Search anywhere" field (any address/landmark via Places autocomplete)
 *
 * Mouse-only for v1. Controller-navigable variant is part of the
 * controller-config platform sprint.
 */
export default function DestinationsPanel({ visible, home, onFlyTo, onClose }: Props) {
  if (!visible) return null;

  function flyToDestination(d: Destination) {
    onFlyTo({
      lat: d.pose.lat,
      lng: d.pose.lng,
      altitude: d.pose.altitude,
      heading: d.pose.heading,
      pitch: d.pose.pitch,
      range: d.pose.range,
    });
    onClose();
  }

  return (
    <div
      className="absolute inset-4 md:top-4 md:right-16 md:left-auto md:bottom-auto z-20 md:w-[28rem] max-h-[calc(100vh-2rem)] rounded-2xl backdrop-blur-md flex flex-col overflow-visible text-white"
      style={{
        background: 'linear-gradient(160deg, rgba(40,49,70,0.96), rgba(16,22,38,0.97))',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h3 className="text-base font-bold text-white">Fly somewhere</h3>
          <p className="text-[10px] text-white/55 mt-0.5">Search any address or pick a city — then fly there.</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/55 hover:text-white"
          title="Close"
        >
          <MaterialIcon icon="close" className="text-[18px]" />
        </button>
      </div>

      {/* SEARCH — moved to the TOP so its autocomplete dropdown has the
          whole panel height to open into instead of being clipped by the
          scroll container. Greg 2026-06-12: the search had no room to show
          suggestions. */}
      <div className="px-5 pt-4 pb-2">
        <ProspectSearch
          compact
          placeholder="Type a city, landmark, or address…"
          onSelect={(payload) => {
            onFlyTo({
              lat: payload.lat,
              lng: payload.lng,
              altitude: DEFAULT_ARRIVAL_POSE.altitude,
              heading: DEFAULT_ARRIVAL_POSE.heading,
              pitch: DEFAULT_ARRIVAL_POSE.pitch,
              range: DEFAULT_ARRIVAL_POSE.range,
            });
            onClose();
          }}
        />
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto px-5 py-4 space-y-5">
        {/* Home — pinned top, personal hook before global cities */}
        {home && (
          <div>
            <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider mb-2">Home</p>
            <button
              onClick={() => onFlyTo({
                lat: home.lat,
                lng: home.lng,
                altitude: DEFAULT_ARRIVAL_POSE.altitude,
                heading: DEFAULT_ARRIVAL_POSE.heading,
                pitch: DEFAULT_ARRIVAL_POSE.pitch,
                range: DEFAULT_ARRIVAL_POSE.range,
              })}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-primary/90 to-primary/70 text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.01]"
            >
              <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
                <MaterialIcon icon="home" className="text-[20px]" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-sm font-bold truncate">Home</div>
                <div className="text-[10px] opacity-80 truncate">{home.label || 'Your saved center'}</div>
              </div>
              <MaterialIcon icon="flight_takeoff" className="text-[18px] opacity-80" />
            </button>
          </div>
        )}

        {/* Curated cities — 9 hand-tuned cinematic arrivals */}
        <div>
          <p className="text-[9px] font-bold text-white/60 uppercase tracking-wider mb-2">Iconic destinations</p>
          <div className="grid grid-cols-2 gap-2">
            {PANEL_DESTINATIONS.map((d) => (
              <button
                key={d.slug}
                onClick={() => flyToDestination(d)}
                className="flex flex-col items-start gap-0.5 p-3 rounded-xl bg-white/10 hover:bg-white/15 transition-all text-left hover:scale-[1.02]"
              >
                <div className="text-sm font-bold text-white">{d.name}</div>
                <div className="text-[10px] text-white/60">{d.region}</div>
              </button>
            ))}
          </div>
        </div>


        <p className="text-[9px] text-white/60 italic">
          Photorealistic 3D tile coverage varies by region.
        </p>
      </div>
    </div>
  );
}
