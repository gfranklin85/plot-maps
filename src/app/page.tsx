'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import OutreachTools from '@/components/dashboard/OutreachTools';
import { useProfile } from '@/lib/profile-context';
import { useAuth } from '@/lib/auth-context';

interface UsageData {
  ai_minutes_used: number;
  ai_minutes_limit: number;
}

export default function Dashboard() {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const [totalLeads, setTotalLeads] = useState(0);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [totalRes, usageRes] = await Promise.all([
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id),
      fetch('/api/usage').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);

    setTotalLeads(totalRes.count ?? 0);
    if (usageRes) {
      setUsage({
        ai_minutes_used: Number(usageRes.ai_minutes_used || 0),
        ai_minutes_limit: Number(usageRes.ai_minutes_limit || 0),
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // New user onboarding — no leads yet
  if (!loading && totalLeads === 0) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <MaterialIcon icon="rocket_launch" className="text-[48px] sm:text-[64px] text-primary mb-3" />
          <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-on-surface mb-2">
            Welcome{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}!
          </h2>
          <p className="text-secondary text-base">
            Circle prospect any listing. Paste an address to start.
          </p>
        </div>

        <ProspectSearch />

        {!profile.defaultMapCenter && (
          <MarketAreaPicker onComplete={(lat: number, lng: number) => {
            updateProfile({ defaultMapCenter: { lat, lng } });
          }} />
        )}

        <UploadBanner />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-10">
      {/* ═══ HERO ═══ */}
      <div className="max-w-2xl mx-auto text-center space-y-4 pt-2">
        <div>
          <h2 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">
            Circle Prospect Any Listing
          </h2>
          <p className="text-sm md:text-base text-secondary mt-1">
            Enter a property. We&apos;ll map the neighbors and get you calling.
          </p>
        </div>
        <ProspectSearch />
      </div>

      {/* ═══ 5-CARD ACTION ROW ═══ */}
      <OutreachTools usage={usage} />
    </div>
  );
}

function UploadBanner() {
  return (
    <a
      href="/imports"
      className="flex items-center gap-3 rounded-xl border border-card-border bg-card hover:border-emerald-500/40 hover:bg-emerald-500/5 px-4 py-3 transition-all group"
    >
      <MaterialIcon icon="upload_file" className="text-[20px] text-emerald-400" />
      <p className="flex-1 text-sm text-on-surface">
        Don&apos;t see your listings? <span className="font-bold">Upload your inventory</span>
      </p>
      <MaterialIcon icon="arrow_forward" className="text-[18px] text-on-surface-variant group-hover:text-emerald-400 transition-colors" />
    </a>
  );
}

/* ── Market Area Picker (onboarding) ── */
function MarketAreaPicker({ onComplete }: { onComplete: (lat: number, lng: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [retries, setRetries] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!inputRef.current || autocompleteRef.current) return;
    if (typeof google === 'undefined' || !google?.maps?.places) {
      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.onload = () => setRetries(r => r + 1);
        document.head.appendChild(script);
      } else if (retries < 20) {
        const timer = setTimeout(() => setRetries(r => r + 1), 500);
        return () => clearTimeout(timer);
      }
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['(cities)'],
      componentRestrictions: { country: 'us' },
      fields: ['geometry', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        setSaving(true);
        onComplete(place.geometry.location.lat(), place.geometry.location.lng());
      }
    });

    autocompleteRef.current = autocomplete;
  }, [retries, onComplete]);

  return (
    <div className="max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <MaterialIcon icon="location_on" className="text-[20px] text-primary" />
        <label className="text-sm font-semibold text-on-surface">Your Market Area</label>
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search city or zip code..."
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl bg-input-bg border border-input-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
      />
      {saving && (
        <p className="text-sm text-primary mt-3 font-medium">Setting your market area...</p>
      )}
      <p className="text-xs text-on-surface-variant mt-2">Start typing to search — select a city to center your map.</p>
    </div>
  );
}
