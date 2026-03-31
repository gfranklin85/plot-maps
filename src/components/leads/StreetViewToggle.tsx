'use client';

import { useState } from 'react';
import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  lead: Lead;
}

type ViewMode = 'street' | 'map';

export default function StreetViewToggle({ lead }: Props) {
  const [mode, setMode] = useState<ViewMode>('street');

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasCoords = lead.latitude !== null && lead.longitude !== null;
  const hasAddress = !!lead.property_address;

  const streetViewUrl =
    hasCoords && apiKey
      ? `https://www.google.com/maps/embed/v1/streetview?location=${lead.latitude},${lead.longitude}&key=${apiKey}&heading=0&pitch=0&fov=90`
      : null;

  const mapUrl =
    apiKey && hasAddress
      ? `https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(lead.property_address!)}&key=${apiKey}&zoom=16`
      : hasCoords && apiKey
      ? `https://www.google.com/maps/embed/v1/place?q=${lead.latitude},${lead.longitude}&key=${apiKey}&zoom=16`
      : null;

  const currentUrl = mode === 'street' ? streetViewUrl : mapUrl;

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-slate-100">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
            <MaterialIcon
              icon={mode === 'street' ? 'streetview' : 'map'}
              className="text-[20px] text-blue-600"
              filled
            />
          </div>
          <h3 className="font-headline text-sm font-bold text-on-surface">
            {mode === 'street' ? 'Street View' : 'Map View'}
          </h3>
        </div>

        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setMode('street')}
            className={cn(
              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              mode === 'street'
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-secondary hover:text-on-surface'
            )}
          >
            <MaterialIcon icon="streetview" className="text-[14px]" />
            Street
          </button>
          <button
            onClick={() => setMode('map')}
            className={cn(
              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              mode === 'map'
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-secondary hover:text-on-surface'
            )}
          >
            <MaterialIcon icon="map" className="text-[14px]" />
            Map
          </button>
        </div>
      </div>

      {/* Iframe or fallback */}
      {currentUrl ? (
        <iframe
          src={currentUrl}
          className="w-full aspect-video rounded-xl border-0"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="flex flex-col items-center justify-center aspect-video rounded-xl bg-slate-50 text-secondary">
          <MaterialIcon icon="location_off" className="text-[40px] text-slate-300 mb-2" />
          <p className="text-sm font-medium">
            {!apiKey
              ? 'Google Maps API key not configured'
              : mode === 'street' && !hasCoords
              ? 'No coordinates available for Street View'
              : 'No address or coordinates available'}
          </p>
          {mode === 'street' && !hasCoords && hasAddress && (
            <p className="text-xs mt-1">
              Try switching to Map view
            </p>
          )}
        </div>
      )}
    </div>
  );
}
