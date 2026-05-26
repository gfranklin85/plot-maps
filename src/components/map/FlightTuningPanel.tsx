"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import { AXIS_RANGES, type FlightTuning } from "@/lib/useFlightTuning";
import { effectiveFlightValues, HELI_DEFAULT_TUNING } from "@/lib/flightBaseConstants";

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
        pivot={HELI_DEFAULT_TUNING.multiplier}
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
        pivot={HELI_DEFAULT_TUNING.climbRate}
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
  /** Optional anchor value that sits at the slider's visual midpoint.
   *  When provided, the slider maps the bottom half linearly from
   *  min..pivot and the top half linearly from pivot..max — so the
   *  user's locked default lands at the visual middle even when the
   *  upper range is much wider than the lower (e.g. flight speed
   *  0.5..11 anchored at 1.04 — slow side compact, fast side wide). */
  pivot?: number;
  /** Live effective values from the engine. Shown under the slider
   *  in monospace so Greg can dictate exact numbers back. */
  readout: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, leftEnd, rightEnd, pivot, readout, onChange }: SliderProps) {
  // When `pivot` is set, run the slider on a normalized 0..1 internal
  // position and split the mapping at 0.5. Below midpoint the mapping
  // is min..pivot; above midpoint it's pivot..max. Default lands at
  // 0.5 visually.
  const usePivot = pivot != null && pivot > min && pivot < max;

  // Convert engine value → 0..1 slider position.
  const valueToPos = (v: number): number => {
    if (!usePivot) return (v - min) / (max - min);
    if (v <= pivot!) return 0.5 * (v - min) / (pivot! - min);
    return 0.5 + 0.5 * (v - pivot!) / (max - pivot!);
  };
  // Convert 0..1 slider position → engine value.
  const posToValue = (p: number): number => {
    if (!usePivot) return min + (max - min) * p;
    if (p <= 0.5) return min + (pivot! - min) * (p / 0.5);
    return pivot! + (max - pivot!) * ((p - 0.5) / 0.5);
  };

  const pos = valueToPos(value);
  const step = 0.001; // fine resolution on the normalized axis
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
        min={0}
        max={1}
        step={step}
        value={pos}
        onChange={(e) => onChange(posToValue(parseFloat(e.target.value)))}
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
