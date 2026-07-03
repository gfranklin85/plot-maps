'use client';

import { useRouter } from 'next/navigation';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import { LANDING_DESTINATIONS } from '@/lib/destinations';

// ── HeroCitySearch ────────────────────────────────────────────────────
//
// The "fly any city" search on the landing hero — the exploration half of
// the map+brokerage pitch. Type any city/neighborhood and fly there in 3D;
// or tap a ready destination chip to arrive at its hand-tuned cinematic pose.
// Reuses ProspectSearch (Google Places autocomplete) + the LANDING_DESTINATIONS
// catalog. Search → /map?lat&lng&view=3d (cinematic arrival); chip →
// /map?destination=<slug>. memory/project_destination_match_cut_thesis

// Only destinations we actually have a picture for (Greg: no Dubai/etc).
const CHIP_SLUGS = ['acapulco', 'new-york', 'las-vegas', 'sydney', 'tokyo'];
const DEST_IMG = '/assets/landing/destinations';

export default function HeroCitySearch() {
  const router = useRouter();
  const chips = CHIP_SLUGS
    .map((slug) => LANDING_DESTINATIONS.find((d) => d.slug === slug))
    .filter((d): d is NonNullable<typeof d> => !!d);

  return (
    <div className="hcs">
      <div className="hcs__label">Fly anywhere — type a city or pick one</div>
      <div className="hcs__bar">
        <ProspectSearch
          compact
          placeholder="Search a city, neighborhood, or destination"
          onSelect={({ lat, lng, address }) => {
            const p = new URLSearchParams({
              lat: String(lat), lng: String(lng), view: '3d', address,
            });
            router.push(`/map?${p.toString()}`);
          }}
        />
      </div>
      <div className="hcs__chips">
        {chips.map((d) => (
          <button
            key={d.slug}
            type="button"
            className="hcs__chip"
            onClick={() => router.push(`/map?destination=${d.slug}&view=3d`)}
            title={`Fly to ${d.name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${DEST_IMG}/${d.slug}.png`} alt="" className="hcs__chip-img" draggable={false} />
            <span className="hcs__chip-name">{d.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
