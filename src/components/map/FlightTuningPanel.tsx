"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import type { FlightTuning } from "@/lib/useFlightTuning";

interface Props {
  visible: boolean;
  tuning: FlightTuning;
  onMultiplierChange: (multiplier: number) => void;
  onTurnRateChange: (turnRate: number) => void;
  onTiltRateChange: (tiltRate: number) => void;
  onClimbRateChange: (climbRate: number) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Flight tuning UI. Four independent sliders, no preset chips:
 *   - Flight Speed — pan (left stick).
 *   - Turn Rate — yaw (right-X horizontal rotation).
 *   - Tilt Rate — pitch (right-Y look up/down).
 *   - Climb Rate — LT/RT descent/ascent.
 *
 * Defaults all sit at 1.0× (mid-slider) — the helicopter-cruise
 * pace. Users tune from there.
 *
 * Idle hover wave compensation is NOT exposed; it's time-driven and
 * protects the "alive at rest" feel from user disruption.
 *
 * Live preview — moving any slider changes feel immediately.
 */
export default function FlightTuningPanel({
  visible,
  tuning,
  onMultiplierChange,
  onTurnRateChange,
  onTiltRateChange,
  onClimbRateChange,
  onReset,
  onClose,
}: Props) {
  if (!visible) return null;

  return (
    <div className="absolute top-4 right-16 z-20 w-80 rounded-2xl bg-surface/90 backdrop-blur-md shadow-2xl border border-card-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Flight feel</h3>
          <p className="text-[10px] text-on-surface-variant mt-0.5">Speed = pan. Turn = yaw. Tilt = look. Climb = ascend/descend.</p>
        </div>
        <button
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface"
          title="Close"
        >
          <MaterialIcon icon="close" className="text-[16px]" />
        </button>
      </div>

      <Slider
        label="Flight speed"
        value={tuning.multiplier}
        leftEnd="Slow"
        rightEnd="Fast"
        onChange={onMultiplierChange}
      />
      <Slider
        label="Turn rate"
        value={tuning.turnRate}
        leftEnd="Cinematic"
        rightEnd="Snappy"
        onChange={onTurnRateChange}
      />
      <Slider
        label="Tilt rate"
        value={tuning.tiltRate}
        leftEnd="Slow"
        rightEnd="Quick"
        onChange={onTiltRateChange}
      />
      <Slider
        label="Climb rate"
        value={tuning.climbRate}
        leftEnd="Cinematic"
        rightEnd="Rapid"
        onChange={onClimbRateChange}
      />

      <div className="flex items-center justify-between pt-1">
        <p className="text-[9px] text-on-surface-variant italic">
          Live preview — fly while you adjust.
        </p>
        <button
          onClick={onReset}
          className="text-[10px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
          title="Reset all sliders to default"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  leftEnd: string;
  rightEnd: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, leftEnd, rightEnd, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[10px] font-mono text-on-surface tabular-nums">
          {value.toFixed(2)}×
        </span>
      </div>
      <input
        type="range"
        min={0.1}
        max={2.5}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex items-center justify-between mt-0.5 text-[9px] text-on-surface-variant">
        <span>{leftEnd}</span>
        <span className="opacity-50">·</span>
        <span className="font-semibold">1×</span>
        <span className="opacity-50">·</span>
        <span>{rightEnd}</span>
      </div>
    </div>
  );
}
