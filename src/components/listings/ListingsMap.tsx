'use client';

// ── ListingsMap — the inventory ON the map ────────────────────────────
//
// The listings "Map view" (Greg 2026-07-14 mockup): our map beside the
// cards, every home pinned with its ESTIMATED MONTHLY payment (the same
// paymentFor math as the cards, so pins and cards always agree), a
// "plug in a controller to fly" reminder, and — the Plot move — click any
// home and SEND THEM A POSTCARD (real PostGrid via /api/seed/send).
//
// 2D: vis.gl Map + AdvancedMarker $X/mo chips. Missing coords are geocoded
// client-side on render (the post form doesn't geocode yet — most listings
// lack lat/lng; the Geocoder rides the maps JS we already load).
// 3D: gmp-map-3d photoreal (mouse-flyable). Per-listing chips in 3D need
// the worldToScreen projection layer — deferred; the full flight machine
// lives on /map (the controller chip links there).

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { APIProvider, Map as GMap, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { paymentFor, type BuyerSettings } from '@/lib/listings/buyerSettings';
import MaterialIcon from '@/components/ui/MaterialIcon';
import PlatTile from '@/components/listings/PlatTile';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || undefined;
const LEMOORE = { lat: 36.3008, lng: -119.7829 };

export interface MapListing {
  id: string; address: string; city: string | null; state: string | null; zip?: string | null;
  price: number | null; beds: number | null; baths: number | null; sqft: number | null;
  year_built?: number | null; photos: string[]; status: string;
  lat?: number | null; lng?: number | null;
}

export default function ListingsMap({
  listings, settings, selected, onSelect,
}: {
  listings: MapListing[];
  settings: BuyerSettings;
  selected: MapListing | null;
  onSelect: (l: MapListing | null) => void;
}) {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');

  return (
    <div className="lmap">
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
        {mode === '2d' ? (
          <GMap
            defaultCenter={LEMOORE}
            defaultZoom={13}
            mapId={MAP_ID}
            mapTypeId="hybrid"
            disableDefaultUI
            zoomControl
            gestureHandling="greedy"
            className="lmap__gl"
          >
            <PriceChips listings={listings} settings={settings} selected={selected} onSelect={onSelect} />
          </GMap>
        ) : (
          <Map3DPane listings={listings} />
        )}
      </APIProvider>

      {/* controller reminder — flight lives on /map */}
      <a href="/map?view=3d" className="lmap__pad">
        <MaterialIcon icon="sports_esports" className="text-[17px]" />
        Plug in a controller to fly
      </a>

      {/* 2D / 3D toggle */}
      <div className="lmap__mode">
        <button className={mode === '3d' ? 'is-on' : ''} onClick={() => setMode('3d')}>3D</button>
        <button className={mode === '2d' ? 'is-on' : ''} onClick={() => setMode('2d')}>2D</button>
      </div>

      {/* selected home — the mini card with the Plot move */}
      {selected && <MiniCard listing={selected} onClose={() => onSelect(null)} />}

      <style>{`
        .lmap { position: relative; height: 100%; min-height: 480px; border-radius: 18px; overflow: hidden;
          border: 1px solid rgba(19,73,212,0.12); box-shadow: 0 18px 44px -28px rgba(20,50,120,0.45); }
        .lmap__gl { width: 100%; height: 100%; }
        .lmap__pad { position: absolute; top: 14px; left: 14px; z-index: 5;
          display: inline-flex; align-items: center; gap: 8px; padding: 9px 15px; border-radius: 12px;
          background: rgba(255,255,255,0.92); backdrop-filter: blur(6px); border: 1px solid rgba(19,73,212,0.14);
          color: var(--plot-brand, #1349d4); font-size: 13px; font-weight: 700; text-decoration: none;
          box-shadow: 0 10px 26px -16px rgba(20,50,120,0.5); }
        .lmap__pad:hover { color: var(--plot-brand-deep, #122d8d); }
        .lmap__mode { position: absolute; top: 14px; right: 14px; z-index: 5; display: flex;
          border-radius: 11px; overflow: hidden; border: 1px solid rgba(19,73,212,0.16);
          background: rgba(255,255,255,0.92); backdrop-filter: blur(6px); }
        .lmap__mode button { padding: 8px 16px; font-size: 13px; font-weight: 800; color: #6b7699;
          background: none; border: none; cursor: pointer; }
        .lmap__mode button.is-on { background: var(--plot-brand, #1349d4); color: #fff; }

        .lmchip { display: inline-flex; align-items: center; gap: 4px; padding: 5px 11px; border-radius: 999px;
          background: #fff; border: 1.5px solid rgba(19,73,212,0.35); color: var(--plot-brand-deep, #122d8d);
          font-size: 12.5px; font-weight: 800; font-variant-numeric: tabular-nums; white-space: nowrap;
          box-shadow: 0 6px 18px -8px rgba(20,50,120,0.5); cursor: pointer; }
        .lmchip .material-symbols-rounded, .lmchip .material-symbols-outlined { font-size: 13px; color: var(--plot-brand, #1349d4); }
        .lmchip.is-sel { background: var(--plot-brand, #1349d4); border-color: var(--plot-brand, #1349d4); color: #fff; }
        .lmchip.is-sel .material-symbols-rounded, .lmchip.is-sel .material-symbols-outlined { color: #fff; }
      `}</style>
    </div>
  );
}

// ── the $X/mo chips + geocode-missing + fit bounds ────────────────────
function PriceChips({ listings, settings, selected, onSelect }: {
  listings: MapListing[]; settings: BuyerSettings; selected: MapListing | null;
  onSelect: (l: MapListing) => void;
}) {
  const map = useMap();
  const geocoding = useMapsLibrary('geocoding');
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const started = useRef(false);

  // geocode listings that lack lat/lng (sequential, capped, cached in state)
  useEffect(() => {
    if (!geocoding || started.current) return;
    started.current = true;
    const geocoder = new google.maps.Geocoder();
    const missing = listings
      .filter((l) => (l.lat == null || l.lng == null) && l.address)
      .slice(0, 40); // cap per view — quota kindness
    let cancelled = false;
    (async () => {
      for (const l of missing) {
        if (cancelled) return;
        const full = [l.address, l.city, l.state ?? 'CA'].filter(Boolean).join(', ');
        try {
          const res = await geocoder.geocode({ address: full });
          const loc = res.results?.[0]?.geometry?.location;
          if (loc) setCoords((p) => ({ ...p, [l.id]: { lat: loc.lat(), lng: loc.lng() } }));
        } catch { /* skip un-geocodable */ }
        await new Promise((r) => setTimeout(r, 220)); // gentle pacing
      }
    })();
    return () => { cancelled = true; };
  }, [geocoding, listings]);

  const pinned = useMemo(
    () => listings
      .map((l) => {
        const at = l.lat != null && l.lng != null ? { lat: l.lat, lng: l.lng } : coords[l.id];
        return at ? { l, at } : null;
      })
      .filter((x): x is { l: MapListing; at: { lat: number; lng: number } } => !!x),
    [listings, coords],
  );

  // fit the map to the pins once a few exist
  const fitted = useRef(false);
  useEffect(() => {
    if (!map || fitted.current || pinned.length < 2) return;
    fitted.current = true;
    const b = new google.maps.LatLngBounds();
    pinned.forEach(({ at }) => b.extend(at));
    map.fitBounds(b, 60);
  }, [map, pinned]);

  return (
    <>
      {pinned.map(({ l, at }) => {
        const pay = l.price && l.price > 0 ? paymentFor(settings, l.price) : null;
        return (
          <AdvancedMarker key={l.id} position={at} onClick={() => onSelect(l)} zIndex={selected?.id === l.id ? 10 : 1}>
            <span className={`lmchip ${selected?.id === l.id ? 'is-sel' : ''}`}>
              <MaterialIcon icon="home" className="text-[13px]" />
              {pay ? `$${Math.round(pay.total).toLocaleString()}/mo` : 'Ask'}
            </span>
          </AdvancedMarker>
        );
      })}
    </>
  );
}

// ── 3D photoreal pane (mouse-flyable; chips deferred to the projection pass) ──
function Map3DPane({ listings }: { listings: MapListing[] }) {
  const holder = useRef<HTMLDivElement>(null);
  const maps3d = useMapsLibrary('maps3d');

  useEffect(() => {
    if (!maps3d || !holder.current) return;
    const el = document.createElement('gmp-map-3d') as HTMLElement & Record<string, unknown>;
    const first = listings.find((l) => l.lat != null && l.lng != null);
    const c = first ? { lat: first.lat as number, lng: first.lng as number } : LEMOORE;
    el.setAttribute('mode', 'hybrid');
    el.center = { ...c, altitude: 0 };
    el.range = 1600;
    el.tilt = 62;
    el.style.width = '100%';
    el.style.height = '100%';
    const node = holder.current;
    node.appendChild(el);
    return () => { node.removeChild(el); };
  }, [maps3d, listings]);

  return <div ref={holder} className="lmap__gl" />;
}

// ── the selected-home mini card — with the Plot move ──────────────────
function MiniCard({ listing, onClose }: { listing: MapListing; onClose: () => void }) {
  const [cardState, setCardState] = useState<'idle' | 'sending' | 'sent' | 'error' | 'auth'>('idle');
  const isComp = listing.id.startsWith('comp:');

  async function sendPostcard() {
    if (cardState === 'sending' || cardState === 'sent') return;
    setCardState('sending');
    try {
      const res = await fetch('/api/seed/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaLabel: listing.city ?? 'your area',
          addresses: [{ addressLine1: listing.address, city: listing.city ?? undefined, state: listing.state ?? 'CA', zip: listing.zip ?? undefined }],
        }),
      });
      if (res.status === 401) { setCardState('auth'); return; }
      const j = await res.json();
      setCardState(j?.sent >= 1 ? 'sent' : 'error');
    } catch { setCardState('error'); }
  }

  return (
    <div className="lmini">
      <button className="lmini__x" onClick={onClose} aria-label="Close"><MaterialIcon icon="close" className="text-[16px]" /></button>
      <div className="lmini__photo">
        {listing.photos?.[0]
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={listing.photos[0]} alt={listing.address} />
          : <PlatTile seed={listing.id} />}
      </div>
      <div className="lmini__body">
        <div className="lmini__addr">{listing.address}</div>
        <div className="lmini__sub">{[listing.city, listing.state].filter(Boolean).join(', ')}</div>
        <div className="lmini__specs">
          {listing.beds != null && <span>{listing.beds} bd</span>}
          {listing.baths != null && <span>{listing.baths} ba</span>}
          {listing.sqft != null && <span>{listing.sqft.toLocaleString()} sqft</span>}
          {listing.year_built != null && <span>Built {listing.year_built}</span>}
        </div>
        <div className="lmini__actions">
          <button
            className={`lmini__send ${cardState === 'sent' ? 'is-sent' : ''}`}
            onClick={sendPostcard}
            disabled={cardState === 'sending' || cardState === 'sent'}
          >
            <MaterialIcon icon={cardState === 'sent' ? 'check' : 'mail'} className="text-[15px]" />
            {cardState === 'idle' && 'Send postcard'}
            {cardState === 'sending' && 'Sending…'}
            {cardState === 'sent' && 'Postcard sent'}
            {cardState === 'error' && 'Retry postcard'}
            {cardState === 'auth' && 'Sign in to send'}
          </button>
          {!isComp && <Link href={`/listings/${listing.id}`} className="lmini__view"><MaterialIcon icon="visibility" className="text-[15px]" /> View property</Link>}
        </div>
      </div>

      <style>{`
        .lmini { position: absolute; left: 14px; bottom: 14px; z-index: 6; width: min(430px, calc(100% - 28px));
          display: grid; grid-template-columns: 108px 1fr; gap: 14px; padding: 12px; border-radius: 16px;
          background: rgba(255,255,255,0.96); backdrop-filter: blur(8px); border: 1px solid rgba(19,73,212,0.14);
          box-shadow: 0 22px 50px -26px rgba(20,50,120,0.55); }
        .lmini__x { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; display: grid; place-items: center;
          border: none; border-radius: 7px; background: rgba(19,73,212,0.06); color: #6b7699; cursor: pointer; }
        .lmini__photo { height: 96px; border-radius: 11px; overflow: hidden; background: #e9f0fc; }
        .lmini__photo img { width: 100%; height: 100%; object-fit: cover; }
        .lmini__addr { font-weight: 800; font-size: 15px; color: var(--plot-brand-deep, #122d8d); padding-right: 22px; }
        .lmini__sub { font-size: 12.5px; color: #6b7699; margin-top: 1px; }
        .lmini__specs { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; font-size: 12.5px; color: #4d5d82;
          font-variant-numeric: tabular-nums; }
        .lmini__actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .lmini__send { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border: none; border-radius: 10px;
          background: var(--plot-brand, #1349d4); color: #fff; font-weight: 700; font-size: 13px; cursor: pointer; }
        .lmini__send:hover:not(:disabled) { background: var(--plot-brand-deep, #122d8d); }
        .lmini__send:disabled { cursor: default; }
        .lmini__send.is-sent { background: #157a43; }
        .lmini__view { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px;
          border: 1.5px solid rgba(19,73,212,0.28); color: var(--plot-brand, #1349d4); font-weight: 700; font-size: 13px; }
        .lmini__view:hover { background: rgba(19,73,212,0.06); }
      `}</style>
    </div>
  );
}
