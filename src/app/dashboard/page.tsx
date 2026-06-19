'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import WorkstationScreen from '@/components/dashboard/WorkstationScreen';
import FrameEditor from '@/components/dashboard/FrameEditor';
import OtPainting from '@/components/dashboard/OtPainting';
import { ROOM } from '@/lib/dashboard/roomConfig';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Visual frame editor — /dashboard?frame=1. Drag the screen rects onto
  // the room image, copy the coords. Dev/admin tool for room-building.
  const [frameMode, setFrameMode] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setFrameMode(new URLSearchParams(window.location.search).get('frame') === '1');
    }
  }, []);
  if (frameMode) {
    return (
      <FrameEditor roomSrc={ROOM.src} initial={{ hero: ROOM.hero, ot: ROOM.ot }} />
    );
  }

  // New user onboarding — no leads yet. Same room, focused on getting started.
  if (!loading && totalLeads === 0) {
    return (
      <div className="relative min-h-screen overflow-hidden" style={{ background: 'var(--plot-room)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ROOM.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 100% at 50% 30%, rgba(7,11,20,0.55), rgba(7,11,20,0.88))' }} />
        <div className="relative z-10 p-4 md:p-8 max-w-2xl mx-auto space-y-8 pt-24 md:pt-32">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-[linear-gradient(160deg,rgba(61,123,255,0.25),rgba(28,73,201,0.15))] border border-[rgba(125,168,255,0.3)] shadow-[0_8px_24px_-6px_rgba(61,123,255,0.5),inset_0_1px_0_rgba(180,210,255,0.25)]">
              <MaterialIcon icon="rocket_launch" className="text-[36px] text-[#9fd0ff]" />
            </div>
            <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-white mb-2">
              Welcome{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-[rgba(200,215,255,0.7)] text-base">
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
      </div>
    );
  }

  // % rect → absolute style helper, so overlays register to the room image.
  const rect = (r: { left: number; top: number; width: number; height: number }) => ({
    position: 'absolute' as const,
    left: `${r.left}%`,
    top: `${r.top}%`,
    width: `${r.width}%`,
    height: `${r.height}%`,
  });

  return (
    <div className="relative w-full min-h-screen overflow-hidden" style={{ background: 'var(--plot-room)' }}>
      {/* ═══ THE ROOM ═══
          A brokerage-lounge image is the backdrop — it provides the depth.
          Live UI is overlaid onto the screen rectangles in the image. The
          room is a fixed cover image; the screen-overlay layer sits on top
          at the same aspect so the rects line up. */}
      <div className="relative w-full" style={{ aspectRatio: String(ROOM.aspect), minHeight: '100vh' }}>
        {/* room image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ROOM.src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* ── HERO screen: the one interactive surface. Holds the menu
              (nav lives ON the screen, no app chrome on the room) + the
              "where do you want to fly?" search. The side wall-screens stay
              dark/ambient — part of the SCENE, not data panels nobody asked
              for. ── */}
        <div style={rect(ROOM.hero)} className="z-10">
          <WorkstationScreen variant="wall" />
        </div>

        {/* OT lives in the right-wall painting — hover = finger, tap = he
            jumps out into the room. ([[project-ot-lives-in-the-painting]]) */}
        <OtPainting />
      </div>
    </div>
  );
}

function UploadBanner() {
  return (
    <a
      href="/imports"
      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all group"
      style={{
        background: 'linear-gradient(160deg, rgba(34,44,68,0.85), rgba(13,20,36,0.92))',
        border: '1px solid rgba(125,168,255,0.16)',
        boxShadow: 'inset 0 1px 0 rgba(180,210,255,0.12)',
      }}
    >
      <MaterialIcon icon="upload_file" className="text-[20px] text-[#5ed6a8]" />
      <p className="flex-1 text-sm text-[rgba(220,230,255,0.85)]">
        Don&apos;t see your listings? <span className="font-bold text-white">Upload your inventory</span>
      </p>
      <MaterialIcon icon="arrow_forward" className="text-[18px] text-[rgba(180,200,255,0.5)] group-hover:text-[#5ed6a8] transition-colors" />
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
        <MaterialIcon icon="location_on" className="text-[20px] text-[#9fd0ff]" />
        <label className="text-sm font-semibold text-white">Your Market Area</label>
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search city or zip code..."
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-[rgba(180,200,255,0.4)] focus:outline-none focus:ring-2 focus:ring-[rgba(61,123,255,0.3)] disabled:opacity-50"
        style={{
          background: 'rgba(11,16,32,0.85)',
          border: '1px solid rgba(125,168,255,0.25)',
        }}
      />
      {saving && (
        <p className="text-sm text-[#9fd0ff] mt-3 font-medium">Setting your market area...</p>
      )}
      <p className="text-xs text-[rgba(180,200,255,0.5)] mt-2">Start typing to search — select a city to center your map.</p>
    </div>
  );
}
