'use client';

// ── /mission — the daily PlotMaps set ─────────────────────────────────
//
// The gathering mission, dead simple + honest: pick an ANCHOR (a listing/house
// you want to prospect around) → the system builds a small set of the ~3
// nearest properties → fly the camera run-through → go ask those owners what
// they want. Small on purpose: an unintimidating first rep. We're the
// ask-and-listen guys, not the data guys — no criteria, no difficulty scoring.
// memory/the_thesis (the gathering engine + set mechanics).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Stop {
  apn: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
  meters: number;
}

export default function MissionPage() {
  const router = useRouter();
  const [anchor, setAnchor] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);

  const buildSet = async (lat: number, lng: number, label: string) => {
    setAnchor({ lat, lng, label });
    setLoading(true);
    setStops([]);
    try {
      const res = await fetch(`/api/set/build?lat=${lat}&lng=${lng}&n=3`);
      const data = await res.json();
      setStops(Array.isArray(data.stops) ? data.stops : []);
    } catch {
      setStops([]);
    } finally {
      setLoading(false);
    }
  };

  // Fly the run-through: open the map at the anchor in 3D. (The scripted
  // multi-stop camera choreography reuses the flight engine — wired next.)
  const startRun = () => {
    if (!anchor) return;
    router.push(`/map?lat=${anchor.lat}&lng=${anchor.lng}&view=3d&set=1`);
  };

  return (
    <div className="dsh min-h-screen">
      <div className="mssn__wrap">
        <div className="dsh-intro__eyebrow">Today&apos;s mission</div>
        <h1 className="mssn__h">Go ask three people what they want.</h1>
        <p className="mssn__sub">
          Pick a home or listing to prospect around. We&apos;ll build a short
          run-through of the closest few — then you just go ask if they&apos;re
          staying for good, and what would have to be true for them to move.
        </p>

        {/* pick an anchor */}
        <div className="mssn__pick">
          <div className="mssn__pick-label">Prospect around…</div>
          <ProspectSearch
            compact
            placeholder="A listing, address, or neighborhood to start from"
            onSelect={({ lat, lng, address }) => buildSet(lat, lng, address || 'your anchor')}
          />
        </div>

        {/* the set */}
        {anchor && (
          <div className="mssn__set">
            <div className="mssn__set-head">
              <div>
                <div className="mssn__set-eyebrow">Your set</div>
                <div className="mssn__set-anchor">
                  <MaterialIcon icon="my_location" className="text-[15px]" />
                  Around {anchor.label.split(',')[0]}
                </div>
              </div>
              {stops.length > 0 && (
                <button className="mssn__start" onClick={startRun}>
                  <MaterialIcon icon="play_arrow" className="text-[18px]" />
                  Start the run-through
                </button>
              )}
            </div>

            {loading && <div className="mssn__loading">Building your set…</div>}

            {!loading && stops.length === 0 && (
              <div className="mssn__loading">No nearby properties found here yet. Try a spot with coverage (Kings County).</div>
            )}

            <ol className="mssn__stops">
              {stops.map((s, i) => (
                <li key={s.apn} className="mssn-stop">
                  <span className="mssn-stop__n">{i + 1}</span>
                  <span className="mssn-stop__body">
                    <span className="mssn-stop__addr">{s.address?.split('/')[0]?.trim() || `Parcel ${s.apn}`}</span>
                    <span className="mssn-stop__meta">{s.city || 'Kings County'} · {s.meters}m away</span>
                  </span>
                  <span className="mssn-stop__ask">Ask: staying for good? what would have to be true to move?</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
