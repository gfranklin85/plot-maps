'use client';

import { useState, useEffect, useRef } from 'react';
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
  const { collapsed } = useSidebar();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className={`fixed top-0 right-0 h-16 bg-card/80 backdrop-blur-md flex justify-between items-center px-8 z-40 shadow-sm border-b border-card-border/30 transition-all duration-300 ${collapsed ? 'w-[calc(100%-4rem)]' : 'w-[calc(100%-16rem)]'}`}>
      {/* Search */}
      <div className="relative w-1/3" ref={searchRef}>
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
        {showResults && results.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-card rounded-xl shadow-xl border border-card-border overflow-hidden z-50">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  router.push(`/leads/${r.id}`);
                  setShowResults(false);
                  setQuery('');
                }}
                className="w-full px-4 py-2.5 text-left hover:bg-primary/10 transition-colors border-b border-card-border/50 last:border-0"
              >
                <p className="text-sm font-medium text-on-surface truncate">{r.owner_name || r.name || 'Unknown'}</p>
                <p className="text-xs text-secondary truncate">{r.property_address}</p>
              </button>
            ))}
          </div>
        )}
        {showResults && query.length >= 2 && results.length === 0 && (
          <div className="absolute top-full mt-1 w-full bg-card rounded-xl shadow-xl border border-card-border p-4 z-50">
            <p className="text-sm text-on-surface-variant text-center">No results found</p>
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <button className="relative p-2 text-on-surface-variant hover:text-primary transition-colors" title="Notifications coming soon">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-outline-variant/30" />

        {/* User */}
        <Link href="/settings" className="flex items-center gap-3 group cursor-pointer">
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

        {/* Sign Out */}
        <button
          onClick={signOut}
          className="p-2 text-on-surface-variant hover:text-red-500 transition-colors"
          title="Sign out"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
}
