'use client';

import { useState, useCallback } from 'react';
import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useProfile } from '@/lib/profile-context';
import UpgradeGate from '@/components/ui/UpgradeGate';

interface Props {
  lead: Lead;
}

type ViewMode = 'street' | 'map' | 'aerial';

export default function StreetViewToggle({ lead }: Props) {
  const { profile } = useProfile();
  const [showGate, setShowGate] = useState(false);
  const isSubscribed = profile.subscriptionStatus === 'active';
  const [mode, setMode] = useState<ViewMode>('street');
  const [flyoverLoading, setFlyoverLoading] = useState(false);
  const [flyoverUrl, setFlyoverUrl] = useState<string | null>(null);
  const [flyoverError, setFlyoverError] = useState<string | null>(null);

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

  const aerialUrl =
    hasCoords && apiKey
      ? `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lead.latitude},${lead.longitude}&zoom=18&maptype=satellite`
      : null;

  const currentUrl = mode === 'street' ? streetViewUrl : mode === 'map' ? mapUrl : aerialUrl;

  const fetchFlyover = useCallback(async () => {
    if (!hasAddress) return;
    if (!isSubscribed) { setShowGate(true); return; }
    setFlyoverLoading(true);
    setFlyoverError(null);
    setFlyoverUrl(null);
    try {
      const res = await fetch('/api/aerial-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: lead.property_address }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.videoUrl) {
          setFlyoverUrl(data.videoUrl);
        } else {
          setFlyoverError('3D flyover not available for this location');
        }
      } else {
        setFlyoverError('3D flyover not available for this location');
      }
    } catch {
      setFlyoverError('3D flyover not available for this location');
    } finally {
      setFlyoverLoading(false);
    }
  }, [hasAddress, isSubscribed, lead.property_address]);

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
            <MaterialIcon
              icon={mode === 'street' ? 'streetview' : mode === 'map' ? 'map' : 'satellite_alt'}
              className="text-[20px] text-blue-600"
              filled
            />
          </div>
          <h3 className="font-headline text-sm font-bold text-on-surface">
            {mode === 'street' ? 'Street View' : mode === 'map' ? 'Map View' : 'Aerial View'}
          </h3>
        </div>

        <div className="flex rounded-xl bg-surface-container p-1">
          <button
            onClick={() => setMode('street')}
            className={cn(
              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              mode === 'street'
                ? 'bg-card text-on-surface shadow-sm'
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
                ? 'bg-card text-on-surface shadow-sm'
                : 'text-secondary hover:text-on-surface'
            )}
          >
            <MaterialIcon icon="map" className="text-[14px]" />
            Map
          </button>
          <button
            onClick={() => setMode('aerial')}
            className={cn(
              'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              mode === 'aerial'
                ? 'bg-card text-on-surface shadow-sm'
                : 'text-secondary hover:text-on-surface'
            )}
          >
            <MaterialIcon icon="satellite_alt" className="text-[14px]" />
            Aerial
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
        <div className="flex flex-col items-center justify-center aspect-video rounded-xl bg-surface-container-low text-secondary">
          <MaterialIcon icon="location_off" className="text-[40px] text-on-surface-variant mb-2" />
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

      {/* Aerial mode: flyover controls */}
      {mode === 'aerial' && (
        <div className="mt-3">
          {flyoverUrl ? (
            <video
              src={flyoverUrl}
              controls
              className="w-full rounded-xl"
              autoPlay
              muted
            />
          ) : flyoverError ? (
            <p className="text-sm text-secondary text-center py-2">{flyoverError}</p>
          ) : (
            <button
              onClick={fetchFlyover}
              disabled={flyoverLoading || !hasAddress}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                'action-gradient text-on-primary hover:shadow-lg disabled:opacity-60'
              )}
            >
              {flyoverLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Checking availability...
                </>
              ) : (
                <>
                  <MaterialIcon icon="flight" className="text-[18px]" />
                  Get Flyover Video
                </>
              )}
            </button>
          )}
        </div>
      )}

      <UpgradeGate feature="aerial" show={showGate} onClose={() => setShowGate(false)} />
    </div>
  );
}
