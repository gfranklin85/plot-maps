'use client';

import Link from 'next/link';
import { useProfile } from '@/lib/profile-context';

export default function TopBar() {
  const { profile, initials } = useProfile();

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-16rem)] h-16 bg-white/80 backdrop-blur-md flex justify-between items-center px-8 z-40 shadow-sm">
      {/* Search */}
      <div className="relative w-1/3">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
          search
        </span>
        <input
          type="text"
          placeholder="Search leads, addresses..."
          className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-50 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* History */}
        <button className="p-2 text-slate-500 hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined text-[22px]">history</span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-200" />

        {/* User */}
        <Link href="/settings" className="flex items-center gap-3 group cursor-pointer">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
              {profile.fullName || 'Set up profile'}
            </p>
            <p className="text-xs text-slate-500">
              {profile.title || 'Go to settings'}
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold group-hover:bg-blue-700 transition-colors">
            {initials}
          </div>
        </Link>
      </div>
    </header>
  );
}
