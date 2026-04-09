'use client';

import { useState, useEffect } from 'react';
import { Lead } from '@/types';
import { cn } from '@/lib/utils';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useProfile } from '@/lib/profile-context';

interface Place {
  name: string;
  address: string;
  rating: number | null;
  ratingCount: number | null;
  distance: number;
  lat: number;
  lng: number;
}

interface Category {
  type: string;
  label: string;
  icon: string;
  places: Place[];
}

interface Props {
  lead: Lead;
}

export default function NearbyPlaces({ lead }: Props) {
  const { profile } = useProfile();
  const isSubscribed = profile.subscriptionStatus === 'active';
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const hasLocation = lead.latitude !== null && lead.longitude !== null;

  useEffect(() => {
    if (!hasLocation || !isSubscribed) return;

    async function fetchNearby() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/places/nearby', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: lead.latitude, lng: lead.longitude }),
        });

        if (!res.ok) throw new Error('Failed to fetch nearby places');

        const data = await res.json();
        const cats = (data.categories || []) as Category[];
        setCategories(cats);
        if (cats.length > 0) {
          setActiveTab(cats[0].type);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }

    fetchNearby();
  }, [hasLocation, isSubscribed, lead.latitude, lead.longitude]);

  if (!isSubscribed) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
            <MaterialIcon icon="explore_nearby" className="text-[20px] text-indigo-600" filled />
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">Nearby</h3>
        </div>
        <div className="p-6 text-center">
          <MaterialIcon icon="lock" className="text-[32px] text-primary mb-2" />
          <p className="text-sm font-bold text-on-surface-variant mb-1">Subscribe to Unlock</p>
          <p className="text-xs text-secondary mb-3">Discover schools, grocery stores, and amenities near any property.</p>
          <a href="/subscribe" className="text-primary text-xs font-bold hover:underline">Upgrade Plan</a>
        </div>
      </div>
    );
  }

  if (!hasLocation) {
    return (
      <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
            <MaterialIcon icon="explore_nearby" className="text-[20px] text-indigo-600" filled />
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">Nearby</h3>
        </div>
        <div className="flex flex-col items-center py-6 text-secondary">
          <MaterialIcon icon="location_off" className="text-[32px] text-on-surface-variant" />
          <p className="mt-2 text-sm">No location data available</p>
        </div>
      </div>
    );
  }

  const activeCategory = categories.find((c) => c.type === activeTab);

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100">
          <MaterialIcon icon="explore_nearby" className="text-[20px] text-indigo-600" filled />
        </div>
        <h3 className="font-headline text-lg font-bold text-on-surface">Nearby</h3>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex gap-3">
              <div className="h-4 w-4 rounded bg-outline-variant" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-outline-variant" />
                <div className="h-2.5 w-1/2 rounded bg-surface-container" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <MaterialIcon icon="error" className="text-[16px]" />
          {error}
        </div>
      )}

      {/* Category tabs */}
      {!loading && !error && categories.length > 0 && (
        <>
          <div className="flex gap-1 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat.type}
                onClick={() => setActiveTab(cat.type)}
                className={cn(
                  'flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  activeTab === cat.type
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container text-secondary hover:bg-surface-container-high'
                )}
              >
                <MaterialIcon icon={cat.icon} className="text-[14px]" />
                {cat.label}
                {cat.places.length > 0 && (
                  <span className={cn(
                    'ml-0.5 text-[10px]',
                    activeTab === cat.type ? 'text-on-primary/70' : 'text-on-surface-variant'
                  )}>
                    {cat.places.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Places list */}
          {activeCategory && activeCategory.places.length > 0 ? (
            <div className="space-y-2">
              {activeCategory.places.map((place, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-xl px-3 py-2 hover:bg-surface-container-low transition-colors"
                >
                  <MaterialIcon
                    icon={activeCategory.icon}
                    className="text-[16px] text-secondary mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {place.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-secondary mt-0.5">
                      {place.rating !== null && (
                        <span className="flex items-center gap-0.5">
                          <MaterialIcon icon="star" className="text-[12px] text-amber-500" filled />
                          {place.rating}
                          {place.ratingCount !== null && (
                            <span className="text-on-surface-variant">({place.ratingCount})</span>
                          )}
                        </span>
                      )}
                      <span>{place.distance} mi</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : activeCategory ? (
            <p className="text-sm text-secondary text-center py-4">
              No {activeCategory.label.toLowerCase()} found nearby
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
