'use client';

import { useState, useEffect } from 'react';
import { Lead } from '@/types';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { MAP_CENTER } from '@/lib/constants';
import { useProfile } from '@/lib/profile-context';

interface Props {
  lead: Lead;
}

export default function DriveTimeCard({ lead }: Props) {
  const { profile } = useProfile();
  const isSubscribed = profile.subscriptionStatus === 'active';
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasLocation = lead.latitude !== null && lead.longitude !== null;

  useEffect(() => {
    if (!hasLocation || !isSubscribed) return;

    async function fetchDriveTime() {
      setLoading(true);
      try {
        const res = await fetch('/api/distance-matrix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: { lat: MAP_CENTER.lat, lng: MAP_CENTER.lng },
            to: { lat: lead.latitude, lng: lead.longitude },
          }),
        });

        if (!res.ok) return;

        const data = await res.json();
        if (data.status === 'OK') {
          setDistance(data.distance);
          setDuration(data.duration);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchDriveTime();
  }, [hasLocation, isSubscribed, lead.latitude, lead.longitude]);

  if (!isSubscribed) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-4 border border-card-border">
        <div className="p-6 text-center">
          <MaterialIcon icon="lock" className="text-[32px] text-primary mb-2" />
          <p className="text-sm font-bold text-on-surface-variant mb-1">Subscribe to Unlock</p>
          <p className="text-xs text-secondary mb-3">Calculate precise travel times using real-time traffic data.</p>
          <a href="/subscribe" className="text-primary text-xs font-bold hover:underline">Upgrade Plan</a>
        </div>
      </div>
    );
  }

  if (!hasLocation) return null;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${MAP_CENTER.lat},${MAP_CENTER.lng}&destination=${lead.latitude},${lead.longitude}`;

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-4 border border-card-border">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
          <MaterialIcon icon="directions_car" className="text-[20px] text-blue-600" filled />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
            Drive Time
          </p>
          {loading ? (
            <div className="animate-pulse mt-1">
              <div className="h-4 w-32 rounded bg-outline-variant" />
            </div>
          ) : distance && duration ? (
            <p className="text-sm font-semibold text-on-surface mt-0.5">
              {distance} &bull; {duration} from home
            </p>
          ) : (
            <p className="text-sm text-secondary mt-0.5">Unavailable</p>
          )}
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg bg-surface-container px-2.5 py-1.5 text-xs font-semibold text-secondary hover:bg-surface-container-high transition-colors"
        >
          <MaterialIcon icon="directions" className="text-[14px]" />
          Directions
        </a>
      </div>
    </div>
  );
}
