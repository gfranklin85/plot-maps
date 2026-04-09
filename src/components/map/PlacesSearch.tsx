'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onPlaceSelected: (location: { lat: number; lng: number; address: string }) => void;
  className?: string;
}

export default function PlacesSearch({ onPlaceSelected, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (!inputRef.current || autocompleteRef.current) return;

    // Google Maps API may not be loaded yet (loaded by MapView)
    // Retry until it's available
    if (!window.google?.maps?.places) {
      if (retries < 20) {
        const timer = setTimeout(() => setRetries(r => r + 1), 500);
        return () => clearTimeout(timer);
      }
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode'],
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
  }, [retries, onPlaceSelected]);

  return (
    <div className={`relative ${className || ''}`}>
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search address or area..."
        className="w-full pl-10 pr-4 py-2.5 rounded-full bg-card text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-lg border border-card-border"
      />
    </div>
  );
}
