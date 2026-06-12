"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

// ── Map toolbar — translucent expandable button column ──────────────
//
// The map page used to render a horizontal row of opaque white pills
// across the top: search, listing filters, pin-style toggles, walk
// mode, prospect select, layers, photoreal, airplane. Reads as a
// SaaS toolbar with a map embedded inside it. Wrong frame for what
// Plot is becoming — the world should be the canvas, chrome should
// vanish into the edges.
//
// New shape: a single anchor button in the top-right. Tap it to
// expand a vertical column of contextual controls. Translucent so
// the world reads through it. The anchor itself is the only thing
// always visible; everything else materializes on demand.
//
// Each `MapToolbarItem` is a button + icon + label + optional
// active-state. The toolbar handles the expand/collapse + the
// outside-click-to-dismiss. Callers pass children; toolbar does
// no business logic.

export interface MapToolbarItem {
  key: string;
  icon: string;
  label: string;
  /** Action fires on click. */
  onClick: () => void;
  /** Active = the item is currently engaged (toggle on). */
  active?: boolean;
  /** Optional accent override (e.g. admin tint on the photoreal toggle). */
  accentClassName?: string;
  /** Small badge text on the item, e.g. "ADM" for admin-only items. */
  badge?: string;
  /** Hidden entirely when false. */
  visible?: boolean;
}

interface Props {
  items: MapToolbarItem[];
  /** Optional content rendered above the items list (e.g. the search). */
  searchSlot?: ReactNode;
}

export default function MapToolbar({ items, searchSlot }: Props) {
  const [expanded, setExpanded] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Outside-click dismiss.
  useEffect(() => {
    if (!expanded) return;
    function onDown(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setExpanded(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const visibleItems = items.filter(i => i.visible !== false);

  // Shared button surface: a soft top-lit gradient (light → dark) with a
  // hairline top highlight + drop shadow for depth. Never a flat color.
  // Greg 2026-06-12: every button gets gradient depth + pleasing light/
  // shadow, and the expanded items show LABELS so their meaning is clear.
  const restGrad = 'linear-gradient(160deg, rgba(58,68,92,0.92), rgba(20,27,44,0.92))';
  const activeGrad = 'linear-gradient(160deg, #3d7bff, #1c49c9)';

  return (
    <div
      ref={wrapperRef}
      className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2"
    >
      {searchSlot}

      {/* Anchor — always visible. Gradient + depth. */}
      <button
        onClick={() => setExpanded(v => !v)}
        title={expanded ? 'Close' : 'Map tools'}
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
        style={{
          background: expanded ? activeGrad : restGrad,
          boxShadow: '0 8px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        <MaterialIcon icon={expanded ? 'close' : 'tune'} className="text-[22px]" />
      </button>

      {/* Expanded column — each control is now a full pill: icon + LABEL,
          so the user knows what every button does. Gradient depth. */}
      {expanded && (
        <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {visibleItems.map(item => {
            const bg = item.accentClassName ? undefined : (item.active ? activeGrad : restGrad);
            return (
              <button
                key={item.key}
                onClick={() => item.onClick()}
                title={item.label}
                className={`relative flex h-12 items-center gap-3 rounded-2xl pl-3 pr-4 text-[13px] font-semibold text-white backdrop-blur-md transition-transform hover:scale-[1.03] active:scale-95 ${item.accentClassName ?? ''}`}
                style={bg ? {
                  background: bg,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
                } : { boxShadow: '0 8px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)' }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'rgba(255,255,255,0.10)' }}>
                  <MaterialIcon icon={item.icon} className="text-[20px]" />
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
                {item.badge && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
