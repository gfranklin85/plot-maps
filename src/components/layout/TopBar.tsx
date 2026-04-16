'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/profile-context';
import { useAuth } from '@/lib/auth-context';
import { useSidebar } from '@/lib/sidebar-context';
import { supabase } from '@/lib/supabase';
import ThemeToggle from '@/components/ui/ThemeToggle';

interface SearchResult {
  id: string;
  name: string | null;
  owner_name: string | null;
  property_address: string | null;
  phone: string | null;
}

export default function TopBar() {
  const { profile, initials } = useProfile();
  const { user, signOut } = useAuth();
  const { collapsed, setMobileOpen } = useSidebar();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [usage, setUsage] = useState<{ skip_traces_used: number; skip_traces_limit: number; geocodes_used: number; geocodes_limit: number; ai_minutes_used: number; ai_minutes_limit: number; tier_label: string } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch usage
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const data = await res.json();
        setUsage({
          skip_traces_used: data.skip_traces_used || 0,
          skip_traces_limit: data.skip_traces_limit || 0,
          geocodes_used: data.geocodes_used || 0,
          geocodes_limit: data.geocodes_limit || 0,
          ai_minutes_used: Number(data.ai_minutes_used || 0),
          ai_minutes_limit: data.ai_minutes_limit || 0,
          tier_label: data.tier_label || 'Free',
        });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Search leads as user types
  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      const q = query.toLowerCase();
      const { data } = await supabase
        .from('leads')
        .select('id, name, owner_name, property_address, phone')
        .eq('user_id', user!.id)
        .or(`name.ilike.%${q}%,owner_name.ilike.%${q}%,property_address.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(8);
      setResults(data || []);
      setShowResults(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchDropdown = (showResults && results.length > 0) ? (
    <div className="absolute top-full mt-1 w-full bg-card rounded-xl shadow-xl border border-card-border overflow-hidden z-50">
      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => {
            router.push(`/leads/${r.id}`);
            setShowResults(false);
            setQuery('');
            setMobileSearchOpen(false);
          }}
          className="w-full px-4 py-2.5 text-left hover:bg-primary/10 transition-colors border-b border-card-border/50 last:border-0"
        >
          <p className="text-sm font-medium text-on-surface truncate">{r.owner_name || r.name || 'Unknown'}</p>
          <p className="text-xs text-secondary truncate">{r.property_address}</p>
        </button>
      ))}
    </div>
  ) : (showResults && query.length >= 2 && results.length === 0) ? (
    <div className="absolute top-full mt-1 w-full bg-card rounded-xl shadow-xl border border-card-border p-4 z-50">
      <p className="text-sm text-on-surface-variant text-center">No results found</p>
    </div>
  ) : null;

  return (
    <header className={`fixed top-0 right-0 h-14 md:h-16 bg-card/80 backdrop-blur-md flex justify-between items-center px-4 md:px-8 z-40 shadow-sm border-b border-card-border/30 transition-all duration-300 w-full ${collapsed ? 'md:w-[calc(100%-4rem)]' : 'md:w-[calc(100%-16rem)]'}`}>
      {/* Left: hamburger (mobile) + search */}
      <div className="flex items-center gap-3 flex-1">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-on-surface-variant hover:text-on-surface transition-colors md:hidden"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Desktop search */}
        <div className="relative w-1/3 hidden md:block" ref={searchRef}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search leads, addresses..."
            className="w-full pl-10 pr-4 py-2 rounded-full bg-input-bg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 border border-input-border"
          />
          {searchDropdown}
        </div>

        {/* Mobile search icon */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="p-2 text-on-surface-variant hover:text-on-surface transition-colors md:hidden"
        >
          <span className="material-symbols-outlined text-[22px]">search</span>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-4">
        <ThemeToggle />

        {/* Admin pill — replaces usage counters for admins */}
        {profile.isAdmin && (
          <div
            className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400 text-[10px] font-black uppercase tracking-widest"
            title="Admin — all billing bypassed"
          >
            <span className="material-symbols-outlined text-[14px]">shield_person</span>
            Admin • Free
          </div>
        )}

        {/* Usage counters — desktop only, hidden for admins */}
        {!profile.isAdmin && usage && (() => {
          const stRemaining = usage.skip_traces_limit - usage.skip_traces_used;
          const stPct = usage.skip_traces_limit > 0 ? stRemaining / usage.skip_traces_limit : 0;
          const stLow = stPct < 0.2 || stRemaining < 10;
          const stColor = stLow
            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';

          const gcRemaining = usage.geocodes_limit - usage.geocodes_used;
          const gcPct = usage.geocodes_limit > 0 ? gcRemaining / usage.geocodes_limit : 0;
          const gcLow = gcPct < 0.2 || gcRemaining < 20;
          const gcColor = gcLow
            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
            : 'bg-sky-500/10 border-sky-500/20 text-sky-400';

          const aiRemaining = Math.max(0, usage.ai_minutes_limit - usage.ai_minutes_used);
          const aiPct = usage.ai_minutes_limit > 0 ? aiRemaining / usage.ai_minutes_limit : 0;
          const aiLow = usage.ai_minutes_limit > 0 && (aiPct < 0.2 || aiRemaining < 5);
          const aiColor = aiLow
            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
            : 'bg-violet-500/10 border-violet-500/20 text-violet-400';

          return (
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/subscribe"
                className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold transition-colors hover:brightness-110 ${stColor}`}
                title={stLow ? 'Running low — click to upgrade' : 'Skip traces remaining'}
              >
                <span className="material-symbols-outlined text-[14px]">person_search</span>
                {stRemaining}/{usage.skip_traces_limit}
              </Link>
              {usage.ai_minutes_limit > 0 && (
                <Link
                  href="/subscribe"
                  className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold transition-colors hover:brightness-110 ${aiColor}`}
                  title={aiLow ? 'AI minutes running low — click to upgrade' : 'AI caller minutes remaining'}
                >
                  <span className="material-symbols-outlined text-[14px]">smart_toy</span>
                  {Math.round(aiRemaining)}/{usage.ai_minutes_limit} min
                </Link>
              )}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-bold ${gcColor}`} title="Geocodes remaining">
                <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                {gcRemaining}/{usage.geocodes_limit}
              </div>
            </div>
          );
        })()}


        <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors" title="Notifications coming soon">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
        </button>

        {/* Desktop only: divider + user info */}
        <div className="hidden md:block w-px h-8 bg-outline-variant/30" />

        <Link href="/settings" className="hidden md:flex items-center gap-3 group cursor-pointer">
          <div className="text-right">
            <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
              {profile.fullName || 'Set up profile'}
            </p>
            <p className="text-xs text-secondary">
              {profile.title || 'Go to settings'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary text-sm font-bold group-hover:opacity-90 transition-opacity">
            {initials}
          </div>
        </Link>

        {/* Mobile: just avatar */}
        <Link href="/settings" className="md:hidden">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold">
            {initials}
          </div>
        </Link>

        {/* Sign Out — desktop only */}
        <button
          onClick={signOut}
          className="hidden md:block p-2 text-on-surface-variant hover:text-red-500 transition-colors"
          title="Sign out"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>

      {/* Mobile search expanded */}
      {mobileSearchOpen && (
        <div className="absolute top-full left-0 right-0 bg-card border-b border-card-border p-3 md:hidden" ref={searchRef}>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="Search leads, addresses..."
              autoFocus
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-input-bg text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/20 border border-input-border"
            />
            {searchDropdown}
          </div>
        </div>
      )}
    </header>
  );
}
