"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import MaterialIcon from "@/components/ui/MaterialIcon";

// ── Map page nav overlay ─────────────────────────────────────────────
//
// Replaces the global Sidebar + TopBar + BottomNav for the /map page.
// Reason: the map is becoming Plot's primary product surface (flight,
// dogfight, public-presence layer). Wrapping it in agency-app chrome
// fights the "world as canvas" framing.
//
// What this renders:
//   - Plot logo top-left, translucent, always visible.
//   - Tap-to-expand drawer with the same NAV_ITEMS the sidebar has
//     (Dashboard, Map, Leads, Imports) plus profile + sign out.
//   - Outside-click + Esc dismiss.
//
// What this does NOT render:
//   - Top-bar global search field (the destinations overlay covers
//     the address-fly use case; lead search will be the combined
//     search input top-left in the next commit).
//   - Sidebar collapse toggle (irrelevant when the sidebar isn't
//     present).
//   - BottomNav (the mobile mirror of the sidebar).

export default function MapNavOverlay() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { signOut } = useAuth();
  const { profile, initials } = useProfile();

  // Outside-click + Esc dismiss.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="absolute top-4 left-4 z-30 flex flex-col items-start gap-2 pointer-events-none"
    >
      {/* Plot logo — always visible, translucent, tappable. Doubles as
          the drawer summon button. */}
      <button
        onClick={() => setOpen(v => !v)}
        title={open ? 'Close' : 'Menu'}
        className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg backdrop-blur-md transition-all ${
          open
            ? 'bg-primary/85 text-white'
            : 'bg-surface/55 text-on-surface hover:bg-surface/75'
        }`}
      >
        <MaterialIcon icon={open ? 'close' : 'map'} className="text-[18px]" />
        <span className="text-sm font-bold tracking-tight">Plot</span>
      </button>

      {/* Expanded drawer — vertical column of nav items + profile. */}
      {open && (
        <div className="pointer-events-auto flex flex-col gap-1 w-56 rounded-2xl bg-surface/95 backdrop-blur-md shadow-2xl border border-card-border p-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Nav items */}
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`}
              >
                <MaterialIcon icon={item.icon} className="text-[18px]" />
                {item.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-1 h-px bg-card-border" />

          {/* Profile / Settings / Sign out */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all"
          >
            <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
              {initials}
            </div>
            <span className="truncate">{profile.fullName || profile.email || 'Settings'}</span>
          </Link>
          <button
            onClick={() => { setOpen(false); signOut(); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all"
          >
            <MaterialIcon icon="logout" className="text-[18px]" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
