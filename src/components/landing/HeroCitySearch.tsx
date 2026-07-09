'use client';

import { useRouter } from 'next/navigation';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import { LANDING_DESTINATIONS } from '@/lib/destinations';
import { useAuth } from '@/lib/auth-context';
import { signInWithGoogle } from '@/lib/signIn';

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
  const { user } = useAuth();
  const chips = CHIP_SLUGS
    .map((slug) => LANDING_DESTINATIONS.find((d) => d.slug === slug))
    .filter((d): d is NonNullable<typeof d> => !!d);

  // Auth-aware fly: signed-in → straight to the map; signed-OUT → Google
  // OAuth carrying the destination as ?next=, so after login they land on the
  // map already flying there (the callback honors next incl. its query).
  // Before this, chips/search pushed straight to /map and hung at the gate.
  const fly = (mapPath: string) => {
    if (user) router.push(mapPath);
    else signInWithGoogle(mapPath);
  };

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
            fly(`/map?${p.toString()}`);
          }}
        />
      </div>
      <div className="hcs__chips">
        {chips.map((d) => (
          <button
            key={d.slug}
            type="button"
            className="hcs__chip"
            onClick={() => fly(`/map?destination=${d.slug}&view=3d`)}
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
