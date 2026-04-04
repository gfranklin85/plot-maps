'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onPlaceSelected: (location: { lat: number; lng: number; address: string }) => void;
  className?: string;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function PlacesSearch({ onPlaceSelected, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load Google Places library
  useEffect(() => {
    if (typeof google !== 'undefined' && google.maps?.places) {
      setLoaded(true);
      return;
    }

    // Check if script already exists
    const existing = document.querySelector(`script[src*="maps.googleapis.com/maps/api/js"]`);
    if (existing) {
      existing.addEventListener('load', () => setLoaded(true));
      if ((window as unknown as Record<string, unknown>).google) setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize autocomplete
  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['address', 'geocode'],
      componentRestrictions: { country: 'us' },
      fields: ['geometry', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        onPlaceSelected({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          address: place.formatted_address || '',
        });
        if (inputRef.current) inputRef.current.value = place.formatted_address || '';
      }
    });

    autocompleteRef.current = autocomplete;
  }, [loaded, onPlaceSelected]);

  return (
    <div className={`relative ${className || ''}`}>
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search address or area..."
        className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-lg border border-slate-200"
      />
    </div>
  );
}
