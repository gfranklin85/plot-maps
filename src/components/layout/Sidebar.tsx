'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { useSidebar } from '@/lib/sidebar-context';
import { useProfile } from '@/lib/profile-context';

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { profile } = useProfile();
  const isFree = profile.subscriptionStatus !== 'active';

  return (
    <>
      <aside className={`fixed left-0 top-0 h-screen bg-surface-container-low flex flex-col py-6 z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        {/* Logo + collapse toggle */}
        <div className={`flex items-center justify-between ${collapsed ? 'px-3' : 'px-6'} mb-8`}>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold tracking-tight text-on-surface font-headline">
                Plot Maps
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-primary font-label mt-1">
                VISUAL PROSPECTING CRM
              </p>
            </div>
          )}
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {collapsed ? 'menu' : 'menu_open'}
            </span>
          </button>
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
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'text-primary font-bold border-r-4 border-primary bg-surface-container'
                    : 'text-secondary hover:bg-surface-container/50'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {item.icon}
                </span>
                {!collapsed && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Upgrade prompt for free users */}
        {isFree && !collapsed && (
          <div className="px-4 mb-3">
            <Link href="/subscribe" className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 p-3 text-center shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all">
              <span className="material-symbols-outlined text-white text-[18px] block mb-1">rocket_launch</span>
              <p className="text-white text-xs font-bold">Upgrade Plan</p>
              <p className="text-indigo-200 text-[10px]">From $49/mo</p>
            </Link>
          </div>
        )}
        {isFree && collapsed && (
          <div className="px-2 mb-3">
            <Link href="/subscribe" title="Upgrade Plan" className="flex items-center justify-center bg-gradient-to-r from-indigo-500 to-blue-600 text-white py-3 rounded-xl shadow-lg">
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
            </Link>
          </div>
        )}

        {/* Import Button */}
        {!collapsed ? (
          <div className="px-4 mb-6">
            <Link href="/imports" className="block w-full text-center action-gradient text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20">
              + Import Leads
            </Link>
          </div>
        ) : (
          <div className="px-2 mb-6">
            <Link href="/imports" title="Import Leads" className="flex items-center justify-center action-gradient text-white py-3 rounded-xl shadow-lg">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="px-2 border-t border-outline-variant/30 pt-4 flex flex-col gap-1">
          <Link
            href="/settings"
            title={collapsed ? 'Settings' : undefined}
            className={`flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-2 text-secondary hover:bg-surface-container/50 rounded-lg transition-colors`}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            {!collapsed && <span className="text-sm">Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
