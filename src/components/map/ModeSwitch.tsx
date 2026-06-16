"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import type { MapMode } from "@/lib/useMapMode";

// ── ModeSwitch — the always-visible primary map control ──────────────
//
// A translucent segmented control: 2D · 3D · Walk. This is the single
// explicit mode control. It exists because the old toolbar had NO 2D
// toggle — once you were in 3D there was no button back, and exiting
// airplane mode left you stranded in tilt. The Mode Switch makes mode
// legible and un-trappable: whatever you're in, the way out is one tap.
//
// Pure presentation. The page owns the mapMode state machine and passes
// the active mode + a tap handler. Gating (3D needs map-id support, Walk
// needs a subscription) is surfaced as disabled pills with a reason.
//
// Translucent so the world reads through, matching MapToolbar.

interface ModeOption {
  mode: MapMode;
  icon: string;
  label: string;
  /** When set, the pill is disabled and the string is its tooltip. */
  disabledReason?: string;
}

interface Props {
  active: MapMode;
  onSelect: (mode: MapMode) => void;
  /** 3D requires NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID. */
  has3DSupport: boolean;
  /** Walk (Street View prospecting) is a paid feature. */
  isSubscribed: boolean;
}

export default function ModeSwitch({ active, onSelect, has3DSupport, isSubscribed }: Props) {
  const options: ModeOption[] = [
    { mode: "WORK_2D", icon: "map", label: "2D" },
    {
      mode: "FLY_3D",
      icon: "flight",
      label: "3D",
      disabledReason: has3DSupport ? undefined : "3D needs photoreal tiles enabled",
    },
    {
      mode: "WALK",
      icon: "directions_walk",
      label: "Walk",
      disabledReason: isSubscribed ? undefined : "Walk mode is a subscriber feature",
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-2xl bg-surface/45 p-1 shadow-lg backdrop-blur-md">
      {options.map((opt) => {
        const isActive = active === opt.mode;
        const disabled = !!opt.disabledReason;
        return (
          <button
            key={opt.mode}
            onClick={() => { if (!disabled) onSelect(opt.mode); }}
            disabled={disabled}
            title={opt.disabledReason ?? opt.label}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition-all ${
              isActive
                ? "bg-primary/90 text-white shadow"
                : disabled
                  ? "cursor-not-allowed text-on-surface/35"
                  : "text-on-surface hover:bg-surface/60"
            }`}
          >
            <MaterialIcon icon={opt.icon} className="text-[18px]" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
