'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', icon: 'dashboard', label: 'Home' },
  { href: '/map', icon: 'map', label: 'Map' },
  { href: '/leads', icon: 'people', label: 'Leads' },
  { href: '/imports', icon: 'upload', label: 'Import' },
  { href: '/settings', icon: 'settings', label: 'Settings' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-t border-card-border/30 safe-area-bottom">
      <div className="flex justify-around items-center h-14">
        {TABS.map((tab) => {
          const isActive = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive ? 'text-primary' : 'text-on-surface-variant/50'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
