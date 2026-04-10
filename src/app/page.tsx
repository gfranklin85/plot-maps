'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Lead, Activity, DailyTarget } from '@/types';
import ActionList from '@/components/dashboard/ActionList';
import Scorecard from '@/components/dashboard/Scorecard';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useProfile } from '@/lib/profile-context';
import { useAuth } from '@/lib/auth-context';
import UpgradeGate from '@/components/ui/UpgradeGate';

const DEFAULT_TARGETS: DailyTarget = {
  id: '',
  target_date: '',
  conversations_target: 10,
  conversations_actual: 0,
  followups_target: 5,
  followups_actual: 0,
  letters_target: 3,
  letters_actual: 0,
  new_contacts_target: 5,
  new_contacts_actual: 0,
  notes: null,
  created_at: '',
  updated_at: '',
};

export default function Dashboard() {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const [targets, setTargets] = useState<DailyTarget>(DEFAULT_TARGETS);
  const [attentionLeads, setAttentionLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showGate, setShowGate] = useState(false);
  const isSubscribed = profile.subscriptionStatus === 'active';
  const [totalLeads, setTotalLeads] = useState(0);
  const [newThisWeek, setNewThisWeek] = useState(0);
  const [callsToday, setCallsToday] = useState(0);
  const [leadsByStatus, setLeadsByStatus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayStr = now.toISOString().slice(0, 10);

    // Week start (Monday)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    const [
      targetsRes,
      attentionRes,
      activitiesRes,
      totalRes,
      newWeekRes,
      callsTodayRes,
    ] = await Promise.all([
      // Daily targets from API
      fetch('/api/daily-targets').then((r) => r.json()).catch(() => null),

      // Leads needing attention
      supabase
        .from('leads')
        .select('*')
        .eq('user_id', user!.id)
        .eq('follow_up_date', todayStr)
        .in('status', ['Follow-Up', 'Hot Lead', 'New'])
        .eq('priority', 'high')
        .order('follow_up_date', { ascending: true })
        .limit(20),

      // Today's activities
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false }),

      // Total lead count
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id),

      // New leads this week
      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('created_at', weekStart.toISOString()),

      // Calls today
      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('type', 'call')
        .gte('created_at', todayStart),
    ]);

    if (targetsRes && targetsRes.id) {
      setTargets(targetsRes);
    }

    setAttentionLeads((attentionRes.data as Lead[]) ?? []);
    setActivities((activitiesRes.data as Activity[]) ?? []);
    setTotalLeads(totalRes.count ?? 0);
    setNewThisWeek(newWeekRes.count ?? 0);
    setCallsToday(callsTodayRes.count ?? 0);

    // Pipeline summary
    const allLeads = await supabase
      .from('leads')
      .select('status')
      .eq('user_id', user!.id);
    if (allLeads.data) {
      const counts: Record<string, number> = {};
      for (const row of allLeads.data) {
        counts[row.status] = (counts[row.status] || 0) + 1;
      }
      setLeadsByStatus(counts);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-generate action list for subscribers on first load
  useEffect(() => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, totalLeads, isSubscribed]);

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const avgCallsDay = callsToday > 0 ? callsToday : 0;

  // New user onboarding — no leads yet
  if (!loading && totalLeads === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="max-w-lg text-center">
          <MaterialIcon icon="rocket_launch" className="text-[72px] text-blue-500 mb-4" />
          <h2 className="font-headline text-3xl font-extrabold text-on-surface mb-3">
            Welcome{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}!
          </h2>

          {!profile.defaultMapCenter ? (
            <>
              <p className="text-secondary text-lg mb-6">
                First, set your market area so the map centers on your territory.
              </p>
              <MarketAreaPicker onComplete={(lat: number, lng: number) => {
                updateProfile({ defaultMapCenter: { lat, lng } });
              }} />
            </>
          ) : (
            <>
              <p className="text-secondary text-lg mb-8">
                Get started by importing your property list. Upload a CSV from PropWire, BatchLeads, MLS, or any source with addresses.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/imports" className="flex items-center justify-center gap-2 rounded-xl action-gradient px-8 py-4 text-lg font-bold text-on-primary hover:shadow-lg transition-shadow">
                  <MaterialIcon icon="upload_file" className="text-[22px]" />
                  Import Your First List
                </a>
                <a href="/map" className="flex items-center justify-center gap-2 rounded-xl border border-card-border bg-card px-8 py-4 text-lg font-bold text-on-surface hover:bg-surface-container-low transition-colors">
                  <MaterialIcon icon="map" className="text-[22px]" />
                  Explore the Map
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8">
        <h2 className="font-headline text-3xl font-extrabold text-on-surface">
          Daily Action Feed
        </h2>
        <p className="mt-1 text-secondary text-sm">
          {todayFormatted}
        </p>
      </div>

      {/* Main Content: Action Feed + Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Leads Needing Attention */}
        <div className="lg:col-span-8">
          <ActionList
            actions={[]}
            loading={false}
            fallbackLeads={attentionLeads}
          />
        </div>

        {/* Right: Quick Stats + Scorecard */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick stats inline */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-container-lowest rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-on-surface">{loading ? '--' : totalLeads}</p>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Leads</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-on-surface">{loading ? '--' : newThisWeek}</p>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">New</p>
            </div>
            <div className="bg-surface-container-lowest rounded-xl p-4 text-center">
              <p className="text-2xl font-extrabold text-on-surface">{loading ? '--' : avgCallsDay}</p>
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">Calls</p>
            </div>
          </div>

          <Scorecard
            activities={activities}
            targets={targets}
            leadsByStatus={leadsByStatus}
          />
        </div>
      </div>

      <UpgradeGate feature="ai" show={showGate} onClose={() => setShowGate(false)} />
    </div>
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
