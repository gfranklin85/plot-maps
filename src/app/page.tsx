'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Lead, Activity, DailyTarget } from '@/types';
import ActionList from '@/components/dashboard/ActionList';
import Scorecard from '@/components/dashboard/Scorecard';
import MaterialIcon from '@/components/ui/MaterialIcon';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import OutreachTools from '@/components/dashboard/OutreachTools';
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

interface UsageData {
  ai_minutes_used: number;
  ai_minutes_limit: number;
}

export default function Dashboard() {
  const { profile, updateProfile } = useProfile();
  const { user } = useAuth();
  const [targets, setTargets] = useState<DailyTarget>(DEFAULT_TARGETS);
  const [attentionLeads, setAttentionLeads] = useState<Lead[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showGate] = useState(false);
  const [totalLeads, setTotalLeads] = useState(0);
  const [callsToday, setCallsToday] = useState(0);
  const [contactsToday, setContactsToday] = useState(0);
  const [followupsToday, setFollowupsToday] = useState(0);
  const [leadsByStatus, setLeadsByStatus] = useState<Record<string, number>>({});
  const [listings, setListings] = useState<Lead[]>([]);
  const [lastImportAt, setLastImportAt] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayStr = now.toISOString().slice(0, 10);

    const [
      targetsRes,
      attentionRes,
      activitiesRes,
      totalRes,
      callsTodayRes,
      contactsTodayRes,
      followupsTodayRes,
      listingsRes,
      lastImportRes,
      usageRes,
    ] = await Promise.all([
      fetch('/api/daily-targets').then((r) => r.json()).catch(() => null),

      supabase
        .from('leads')
        .select('*')
        .eq('user_id', user!.id)
        .or(`follow_up_date.eq.${todayStr},priority.eq.high,status.eq.New`)
        .in('status', ['Follow-Up', 'Hot Lead', 'New', 'Called', 'Interested'])
        .order('priority', { ascending: false })
        .limit(20),

      supabase
        .from('activities')
        .select('*')
        .eq('user_id', user!.id)
        .gte('created_at', todayStart)
        .order('created_at', { ascending: false }),

      supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id),

      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('type', 'call')
        .gte('created_at', todayStart),

      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('type', 'call')
        .eq('outcome', 'Spoke with Owner')
        .gte('created_at', todayStart),

      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('type', 'call')
        .eq('outcome', 'Follow-Up')
        .gte('created_at', todayStart),

      supabase
        .from('leads')
        .select('*')
        .eq('user_id', user!.id)
        .not('listing_status', 'is', null)
        .not('latitude', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6),

      supabase
        .from('activities')
        .select('created_at')
        .eq('user_id', user!.id)
        .eq('type', 'import')
        .order('created_at', { ascending: false })
        .limit(1),

      fetch('/api/usage').then((r) => r.ok ? r.json() : null).catch(() => null),
    ]);

    if (targetsRes && targetsRes.id) setTargets(targetsRes);

    setAttentionLeads((attentionRes.data as Lead[]) ?? []);
    setActivities((activitiesRes.data as Activity[]) ?? []);
    setTotalLeads(totalRes.count ?? 0);
    setCallsToday(callsTodayRes.count ?? 0);
    setContactsToday(contactsTodayRes.count ?? 0);
    setFollowupsToday(followupsTodayRes.count ?? 0);
    setListings((listingsRes.data as Lead[]) ?? []);
    setLastImportAt(lastImportRes.data?.[0]?.created_at ?? null);
    if (usageRes) {
      setUsage({
        ai_minutes_used: Number(usageRes.ai_minutes_used || 0),
        ai_minutes_limit: Number(usageRes.ai_minutes_limit || 0),
      });
    }

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

  useEffect(() => { fetchData(); }, [fetchData]);

  // New user onboarding — no leads yet
  if (!loading && totalLeads === 0) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
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

  const showUploadBanner = shouldShowUploadBanner({ totalLeads, lastImportAt });

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* ═══ HERO ═══ */}
      <div className="max-w-3xl mx-auto text-center space-y-4">
        <div>
          <h2 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface">
            Circle Prospect Any Listing
          </h2>
          <p className="text-sm md:text-base text-secondary mt-1">
            Enter a property. We&apos;ll map the neighbors and get you calling.
          </p>
        </div>
        <ProspectSearch />
        <p className="text-xs text-on-surface-variant/70">
          Use one of your listings or paste any address. Select nearby homes and start outreach in seconds.
        </p>
      </div>

      {/* ═══ LISTING CHIPS ═══ */}
      {listings.length > 0 && <ListingChips listings={listings} />}

      {/* ═══ UPLOAD BANNER ═══ */}
      {showUploadBanner && <UploadBanner />}

      {/* ═══ OUTREACH TOOLS ═══ */}
      <OutreachTools usage={usage} />

      {/* ═══ STATS + ACTION FEED ═══ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ActionList
            actions={[]}
            loading={false}
            fallbackLeads={attentionLeads}
          />
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatBox label="Calls" value={loading ? null : callsToday} />
            <StatBox label="Contacts" value={loading ? null : contactsToday} />
            <StatBox label="Follow-ups" value={loading ? null : followupsToday} />
          </div>

          <Scorecard
            activities={activities}
            targets={targets}
            leadsByStatus={leadsByStatus}
          />
        </div>
      </div>

      <UpgradeGate feature="ai" show={showGate} onClose={() => { /* noop */ }} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 text-center">
      <p className="text-xl sm:text-2xl font-extrabold text-on-surface">{value ?? '--'}</p>
      <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}

function ListingChips({ listings }: { listings: Lead[] }) {
  return (
    <div className="max-w-5xl mx-auto w-full">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-2 px-1">
        Start from your listings
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {listings.map((lead) => {
          const address = lead.property_address?.split(',')[0] || 'Listing';
          const params = new URLSearchParams({
            lat: String(lead.latitude),
            lng: String(lead.longitude),
            zoom: '19',
            prospect: '1',
            address: lead.property_address || '',
            leadId: lead.id,
          });
          return (
            <a
              key={lead.id}
              href={`/map?${params.toString()}`}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-card-border hover:border-primary/40 hover:bg-primary/5 text-sm text-on-surface transition-all"
            >
              <MaterialIcon icon="home" className="text-[16px] text-primary" />
              <span className="font-medium whitespace-nowrap">{address}</span>
              {lead.listing_status && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                  {lead.listing_status}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function shouldShowUploadBanner({ totalLeads, lastImportAt }: { totalLeads: number; lastImportAt: string | null }): boolean {
  if (totalLeads === 0) return true;
  if (!lastImportAt) return true;
  const daysSince = (Date.now() - new Date(lastImportAt).getTime()) / 86400000;
  if (daysSince > 30) return true;
  if (typeof window !== 'undefined') {
    const count = parseInt(window.localStorage.getItem('plotmaps.heroSearchCount') || '0', 10);
    if (!isNaN(count) && count >= 3) return true;
  }
  return false;
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
