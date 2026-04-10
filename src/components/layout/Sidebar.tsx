'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { useSidebar } from '@/lib/sidebar-context';
import { useProfile } from '@/lib/profile-context';

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();
  const { profile } = useProfile();
  const isFree = profile.subscriptionStatus !== 'active';

  const navContent = (
    <>
      {/* Logo + collapse toggle */}
      <div className={`flex items-center justify-between ${collapsed && !mobileOpen ? 'px-3' : 'px-6'} mb-8`}>
        {(!collapsed || mobileOpen) && (
          <div>
            <h1 className="text-xl font-bold tracking-tight text-on-surface font-headline">
              Plot Maps
            </h1>
            <p className="text-[10px] uppercase tracking-wider text-primary font-label mt-1">
              VISUAL PROSPECTING CRM
            </p>
          </div>
        )}
        {/* Desktop toggle */}
        <button
          onClick={() => { if (mobileOpen) setMobileOpen(false); else toggle(); }}
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors hidden md:block"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="material-symbols-outlined text-[20px]">
            {collapsed ? 'menu' : 'menu_open'}
          </span>
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors md:hidden"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
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
              onClick={() => setMobileOpen(false)}
              title={collapsed && !mobileOpen ? item.label : undefined}
              className={`flex items-center gap-3 ${collapsed && !mobileOpen ? 'justify-center px-2' : 'px-4'} py-3 rounded-lg transition-colors ${
                isActive
                  ? 'text-primary font-bold border-r-4 border-primary bg-surface-container'
                  : 'text-secondary hover:bg-surface-container/50'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {item.icon}
              </span>
              {(!collapsed || mobileOpen) && <span className="text-sm">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade prompt for free users */}
      {isFree && (!collapsed || mobileOpen) && (
        <div className="px-4 mb-3">
          <Link href="/subscribe" onClick={() => setMobileOpen(false)} className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-600 p-3 text-center shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all">
            <span className="material-symbols-outlined text-white text-[18px] block mb-1">rocket_launch</span>
            <p className="text-white text-xs font-bold">Upgrade Plan</p>
            <p className="text-indigo-200 text-[10px]">From $49/mo</p>
          </Link>
        </div>
      )}
      {isFree && collapsed && !mobileOpen && (
        <div className="px-2 mb-3">
          <Link href="/subscribe" title="Upgrade Plan" className="flex items-center justify-center bg-gradient-to-r from-indigo-500 to-blue-600 text-white py-3 rounded-xl shadow-lg">
            <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
          </Link>
        </div>
      )}

      {/* Import Button */}
      {(!collapsed || mobileOpen) ? (
        <div className="px-4 mb-6">
          <Link href="/imports" onClick={() => setMobileOpen(false)} className="block w-full text-center action-gradient text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20">
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
          onClick={() => setMobileOpen(false)}
          title={collapsed && !mobileOpen ? 'Settings' : undefined}
          className={`flex items-center gap-3 ${collapsed && !mobileOpen ? 'justify-center px-2' : 'px-4'} py-2 text-secondary hover:bg-surface-container/50 rounded-lg transition-colors`}
        >
          <span className="material-symbols-outlined text-[20px]">settings</span>
          {(!collapsed || mobileOpen) && <span className="text-sm">Settings</span>}
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex fixed left-0 top-0 h-screen bg-surface-container-low flex-col py-6 z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        {navContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-72 bg-surface-container-low flex flex-col py-6 shadow-2xl animate-in slide-in-from-left duration-200">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
