'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface ListingResult {
  kind: 'listing';
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  status: string | null;
}

interface PlaceResult {
  kind: 'place';
  placeId: string;
  description: string;
}

type Result = ListingResult | PlaceResult;

const STATUS_TINT: Record<string, string> = {
  Active: 'text-emerald-400',
  Sold: 'text-amber-400',
  Pending: 'text-violet-400',
};

function bumpSearchCount() {
  if (typeof window === 'undefined') return;
  const current = parseInt(window.localStorage.getItem('plotmaps.heroSearchCount') || '0', 10);
  window.localStorage.setItem('plotmaps.heroSearchCount', String((isNaN(current) ? 0 : current) + 1));
}

interface Props {
  compact?: boolean;
}

export default function ProspectSearch({ compact = false }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<ListingResult[]>([]);
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [scriptRetries, setScriptRetries] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.google?.maps?.places) {
      setGoogleReady(true);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.onload = () => setGoogleReady(true);
      document.head.appendChild(script);
    } else if (scriptRetries < 20) {
      const timer = setTimeout(() => {
        if (window.google?.maps?.places) setGoogleReady(true);
        else setScriptRetries(r => r + 1);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scriptRetries]);

  useEffect(() => {
    if (!googleReady) return;
    autocompleteRef.current = new google.maps.places.AutocompleteService();
    const node = document.createElement('div');
    placesServiceRef.current = new google.maps.places.PlacesService(node);
    sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
  }, [googleReady]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!user) { setListings([]); return; }
    const q = query.trim();
    if (q.length < 2) { setListings([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, property_address, latitude, longitude, listing_status')
        .eq('user_id', user.id)
        .not('listing_status', 'is', null)
        .not('latitude', 'is', null)
        .ilike('property_address', `%${q}%`)
        .limit(5);
      setListings(
        (data || []).map((row: { id: string; property_address: string | null; latitude: number | null; longitude: number | null; listing_status: string | null }) => ({
          kind: 'listing' as const,
          id: row.id,
          address: row.property_address || '',
          lat: row.latitude,
          lng: row.longitude,
          status: row.listing_status,
        }))
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [query, user]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || !autocompleteRef.current) { setPlaces([]); return; }
    const timer = setTimeout(() => {
      autocompleteRef.current!.getPlacePredictions(
        {
          input: q,
          types: ['geocode'],
          componentRestrictions: { country: 'us' },
          sessionToken: sessionTokenRef.current || undefined,
        },
        (preds) => {
          if (!preds) { setPlaces([]); return; }
          setPlaces(preds.slice(0, 5).map(p => ({
            kind: 'place' as const,
            placeId: p.place_id,
            description: p.description,
          })));
        }
      );
    }, 200);
    return () => clearTimeout(timer);
  }, [query, googleReady]);

  const results: Result[] = [...listings, ...places];

  function navigateToCoords(args: { lat: number; lng: number; address: string; leadId?: string }) {
    bumpSearchCount();
    const params = new URLSearchParams({
      lat: String(args.lat),
      lng: String(args.lng),
      zoom: '19',
      prospect: '1',
      address: args.address,
    });
    if (args.leadId) params.set('leadId', args.leadId);
    router.push(`/map?${params.toString()}`);
  }

  function pickResult(r: Result) {
    setOpen(false);
    if (r.kind === 'listing') {
      if (r.lat == null || r.lng == null) return;
      navigateToCoords({ lat: r.lat, lng: r.lng, address: r.address, leadId: r.id });
      return;
    }
    if (!placesServiceRef.current) return;
    placesServiceRef.current.getDetails(
      { placeId: r.placeId, fields: ['geometry', 'formatted_address'], sessionToken: sessionTokenRef.current || undefined },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK) return;
        if (!place?.geometry?.location) return;
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        navigateToCoords({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || r.description,
        });
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickResult(results[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative">
        <MaterialIcon
          icon="search"
          className={`absolute top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none ${compact ? 'left-4 text-[18px]' : 'left-5 text-[22px]'}`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
          onFocus={() => { if (results.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={compact ? 'Have a listing in mind? Type the address to circle prospect around it.' : 'What listing do you want to prospect around?'}
          className={
            compact
              ? 'w-full pl-11 pr-4 py-2.5 rounded-full bg-card border border-card-border text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary shadow-sm'
              : 'w-full pl-14 pr-5 py-4 md:py-5 rounded-2xl bg-card border border-card-border text-base md:text-lg text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary shadow-lg'
          }
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-2xl shadow-2xl border border-card-border overflow-hidden z-50">
          {results.map((r, idx) => {
            const isHot = idx === highlight;
            if (r.kind === 'listing') {
              const tint = STATUS_TINT[r.status || ''] || 'text-on-surface-variant';
              return (
                <button
                  key={`listing-${r.id}`}
                  onClick={() => pickResult(r)}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-card-border/40 last:border-0 transition-colors ${isHot ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                >
                  <MaterialIcon icon="home" className="text-[20px] text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {r.address.split(',')[0]}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      Your Listing <span className={`font-bold ${tint}`}>• {r.status}</span>
                    </p>
                  </div>
                </button>
              );
            }
            return (
              <button
                key={`place-${r.placeId}`}
                onClick={() => pickResult(r)}
                onMouseEnter={() => setHighlight(idx)}
                className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-card-border/40 last:border-0 transition-colors ${isHot ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
              >
                <MaterialIcon icon="location_on" className="text-[20px] text-on-surface-variant shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {r.description.split(',')[0]}
                  </p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    Any Address <span className="opacity-70">• {r.description.split(',').slice(1).join(',').trim()}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
