"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import {
  type FlightPreset,
  type FlightTuning,
  PRESET_MULTIPLIERS,
} from "@/lib/useFlightTuning";

interface Props {
  visible: boolean;
  tuning: FlightTuning;
  onPresetChange: (preset: FlightPreset) => void;
  onMultiplierChange: (multiplier: number) => void;
  onClimbRateChange: (climbRate: number) => void;
  onClose: () => void;
}

const PRESET_META: Record<Exclude<FlightPreset, 'custom'>, { label: string; hint: string }> = {
  newcomer: { label: 'Newcomer', hint: 'Slow, forgiving' },
  pilot:    { label: 'Pilot',    hint: 'Balanced cruise' },
  pro:      { label: 'Pro',      hint: 'Snappy, twitchy' },
};

/**
 * Flight tuning UI. Preset chips set both axes to the same preset.
 * Two independent sliders:
 *   - Flight speed — pan / yaw / tilt acceleration.
 *   - Climb rate — LB/RB descent/ascent. NOT a camera zoom; the eye
 *     moves through the world.
 *
 * Mouse-only for v1. Live-preview — moving either slider changes
 * flight feel immediately while flying.
 */
export default function FlightTuningPanel({
  visible,
  tuning,
  onPresetChange,
  onMultiplierChange,
  onClimbRateChange,
  onClose,
}: Props) {
  if (!visible) return null;

  return (
    <div className="absolute top-4 right-16 z-20 w-80 rounded-2xl bg-surface/90 backdrop-blur-md shadow-2xl border border-card-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Flight feel</h3>
          <p className="text-[10px] text-on-surface-variant mt-0.5">Speed = move/turn. Climb = descend/ascend.</p>
        </div>
        <button
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface"
          title="Close"
        >
          <MaterialIcon icon="close" className="text-[16px]" />
        </button>
      </div>

      {/* Preset chips — set both axes to the same preset for one-tap tuning. */}
      <div className="flex gap-1.5">
        {(Object.keys(PRESET_META) as Array<keyof typeof PRESET_META>).map((key) => {
          const meta = PRESET_META[key];
          const isActive = tuning.preset === key;
          return (
            <button
              key={key}
              onClick={() => onPresetChange(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-2 rounded-lg text-[11px] font-bold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span>{meta.label}</span>
              <span className="text-[9px] font-normal opacity-70">{meta.hint}</span>
            </button>
          );
        })}
      </div>

      {/* Flight speed slider — pan / yaw / tilt */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Flight speed
          </label>
          <span className="text-[10px] font-mono text-on-surface tabular-nums">
            {tuning.multiplier.toFixed(2)}×
          </span>
        </div>
        <input
          type="range"
          min={0.3}
          max={2.5}
          step={0.05}
          value={tuning.multiplier}
          onChange={(e) => onMultiplierChange(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex items-center justify-between mt-1 text-[9px] text-on-surface-variant">
          <span>Slow</span>
          <span className="opacity-50">·</span>
          <span>{PRESET_MULTIPLIERS.newcomer}×</span>
          <span className="opacity-50">·</span>
          <span className="font-semibold">{PRESET_MULTIPLIERS.pilot}×</span>
          <span className="opacity-50">·</span>
          <span>{PRESET_MULTIPLIERS.pro}×</span>
          <span className="opacity-50">·</span>
          <span>Fast</span>
        </div>
      </div>

      {/* Climb rate slider — LB/RB descent/ascent */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            Climb rate
          </label>
          <span className="text-[10px] font-mono text-on-surface tabular-nums">
            {tuning.climbRate.toFixed(2)}×
          </span>
        </div>
        <input
          type="range"
          min={0.3}
          max={2.5}
          step={0.05}
          value={tuning.climbRate}
          onChange={(e) => onClimbRateChange(parseFloat(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex items-center justify-between mt-1 text-[9px] text-on-surface-variant">
          <span>Cinematic</span>
          <span className="opacity-50">·</span>
          <span>{PRESET_MULTIPLIERS.newcomer}×</span>
          <span className="opacity-50">·</span>
          <span className="font-semibold">{PRESET_MULTIPLIERS.pilot}×</span>
          <span className="opacity-50">·</span>
          <span>{PRESET_MULTIPLIERS.pro}×</span>
          <span className="opacity-50">·</span>
          <span>Rapid</span>
        </div>
      </div>

      <p className="text-[9px] text-on-surface-variant italic">
        Live preview — fly while you adjust to feel the change.
      </p>
    </div>
  );
}
