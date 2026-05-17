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

  return (
    <div
      ref={wrapperRef}
      className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2"
    >
      {/* Search slot — sits above the anchor only when explicitly
          rendered. Caller controls its expansion. */}
      {searchSlot}

      {/* Anchor — the only thing always visible. Translucent so the
          world reads through it. Click to expand the column. */}
      <button
        onClick={() => setExpanded(v => !v)}
        title={expanded ? 'Close' : 'Map tools'}
        className={`relative w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all backdrop-blur-md ${
          expanded
            ? 'bg-primary/85 text-white'
            : 'bg-surface/45 text-on-surface hover:bg-surface/65'
        }`}
      >
        <MaterialIcon
          icon={expanded ? 'close' : 'tune'}
          className="text-[20px]"
        />
      </button>

      {/* Expanded column — vertical strip of contextual controls.
          Anchored just below the anchor button. */}
      {expanded && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          {visibleItems.map(item => (
            <button
              key={item.key}
              onClick={() => {
                item.onClick();
                // Keep the panel open after action so the user can
                // adjust multiple things without re-tapping the anchor.
              }}
              title={item.label}
              className={`relative w-10 h-10 flex items-center justify-center rounded-xl shadow-lg transition-all backdrop-blur-md ${
                item.accentClassName
                  ? item.accentClassName
                  : item.active
                    ? 'bg-primary/85 text-white'
                    : 'bg-surface/45 text-on-surface hover:bg-surface/65'
              }`}
            >
              <MaterialIcon icon={item.icon} className="text-[20px]" />
              {item.badge && (
                <span className="absolute -top-1 -right-1 px-1 rounded-full bg-amber-500 text-white text-[8px] font-bold tracking-wider">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
