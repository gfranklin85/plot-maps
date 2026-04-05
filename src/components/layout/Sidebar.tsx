'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/constants';
import { useSidebar } from '@/lib/sidebar-context';

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <>
      <aside className={`fixed left-0 top-0 h-screen bg-slate-50 flex flex-col py-6 z-50 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
        {/* Logo + collapse toggle */}
        <div className={`flex items-center justify-between ${collapsed ? 'px-3' : 'px-6'} mb-8`}>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 font-headline">
                Plot Maps
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-label mt-1">
                VISUAL PROSPECTING CRM
              </p>
            </div>
          )}
          <button
            onClick={toggle}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
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
                    ? 'text-blue-700 font-bold border-r-4 border-blue-600 bg-slate-100'
                    : 'text-slate-500 hover:bg-slate-200/50'
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
        <div className="px-2 border-t border-slate-200/50 pt-4 flex flex-col gap-1">
          <Link
            href="/settings"
            title={collapsed ? 'Settings' : undefined}
            className={`flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-4'} py-2 text-slate-500 hover:bg-slate-200/50 rounded-lg transition-colors`}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            {!collapsed && <span className="text-sm">Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
