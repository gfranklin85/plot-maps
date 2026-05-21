"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import { AXIS_RANGES, type FlightTuning } from "@/lib/useFlightTuning";
import { effectiveFlightValues } from "@/lib/flightBaseConstants";

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

  // Effective numbers the engine will actually use this frame. Wired
  // straight from flightBaseConstants so the displayed numbers and
  // the engine's numbers can never drift apart.
  const eff = effectiveFlightValues(tuning);

  return (
    <div className="absolute top-4 right-16 z-20 w-[22rem] rounded-2xl bg-surface/90 backdrop-blur-md shadow-2xl border border-card-border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-on-surface">Flight feel</h3>
          <p className="text-[10px] text-on-surface-variant mt-0.5">LY fly · LX strafe · RX turn · RY look · LT↓ RT↑ climb.</p>
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
        min={AXIS_RANGES.multiplier.min}
        max={AXIS_RANGES.multiplier.max}
        leftEnd="Slow"
        rightEnd="Fast"
        readout={`accel ${eff.throttle.accel.toFixed(0)} · max ${eff.throttle.max.toFixed(0)} px/s (rev ${eff.throttle.reverseMax.toFixed(0)})`}
        onChange={onMultiplierChange}
      />
      <Slider
        label="Turn rate"
        value={tuning.turnRate}
        min={AXIS_RANGES.turnRate.min}
        max={AXIS_RANGES.turnRate.max}
        leftEnd="Cinematic"
        rightEnd="Snappy"
        readout={`accel ${eff.yaw.accel.toFixed(0)} · max ${eff.yaw.max.toFixed(0)}°/s · 360 in ${eff.yaw.secondsPerSpin.toFixed(1)}s`}
        onChange={onTurnRateChange}
      />
      <Slider
        label="Tilt rate"
        value={tuning.tiltRate}
        min={AXIS_RANGES.tiltRate.min}
        max={AXIS_RANGES.tiltRate.max}
        leftEnd="Slow"
        rightEnd="Quick"
        readout={`accel ${eff.tilt.accel.toFixed(0)} · max ${eff.tilt.max.toFixed(1)}°/s`}
        onChange={onTiltRateChange}
      />
      <Slider
        label="Climb rate"
        value={tuning.climbRate}
        min={AXIS_RANGES.climbRate.min}
        max={AXIS_RANGES.climbRate.max}
        leftEnd="Cinematic"
        rightEnd="Rapid"
        readout={`accel ${eff.climb.accel.toFixed(0)} · max ${eff.climb.max.toFixed(1)} m/s`}
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
  min: number;
  max: number;
  leftEnd: string;
  rightEnd: string;
  /** Live effective values from the engine. Shown under the slider
   *  in monospace so Greg can dictate exact numbers back. */
  readout: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, leftEnd, rightEnd, readout, onChange }: SliderProps) {
  // Step scales with the range so wider sliders aren't gritty and
  // narrow ones aren't jumpy. ~50 steps end-to-end feels right.
  const step = Math.max(0.01, Math.round(((max - min) / 50) * 100) / 100);
  // Only show the "1×" tick if 1.0 actually falls inside the range
  // (climb's range is 0.05..1.2 so the tick sits near the right;
  // turn's range is 0.5..4.0 so the tick sits near the left).
  const oneInRange = min <= 1 && max >= 1;

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
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex items-center justify-between mt-0.5 text-[9px] text-on-surface-variant">
        <span>{leftEnd}</span>
        {oneInRange && (
          <>
            <span className="opacity-50">·</span>
            <span className="font-semibold">1×</span>
          </>
        )}
        <span className="opacity-50">·</span>
        <span>{rightEnd}</span>
      </div>
      <div className="mt-1 text-[9.5px] font-mono text-on-surface-variant tabular-nums leading-tight">
        {readout}
      </div>
    </div>
  );
}
