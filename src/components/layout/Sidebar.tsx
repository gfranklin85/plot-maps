'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-50 flex flex-col py-6 z-50">
      {/* Logo */}
      <div className="px-6 mb-8">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 font-headline">
          Architectural Ledger
        </h1>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-label mt-1">
          ELITE REAL ESTATE CRM
        </p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'text-blue-700 font-bold border-r-4 border-blue-600 bg-slate-100'
                  : 'text-slate-500 hover:bg-slate-200/50'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* New Lead Button */}
      <div className="px-4 mb-6">
        <button className="w-full action-gradient text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20">
          + New Lead
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 border-t border-slate-200/50 pt-4 flex flex-col gap-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:bg-slate-200/50 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          <span className="text-sm">Settings</span>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-3 px-4 py-2 text-slate-500 hover:bg-slate-200/50 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">help</span>
          <span className="text-sm">Support</span>
        </Link>
      </div>
    </aside>
  );
}
