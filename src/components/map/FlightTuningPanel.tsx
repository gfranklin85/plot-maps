"use client";

import MaterialIcon from "@/components/ui/MaterialIcon";
import {
  AXIS_RANGES,
  SPEED_TIERS,
  CLIMB_TIERS,
  nearestTier,
  type FlightTuning,
  type FlightTier,
} from "@/lib/useFlightTuning";
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
    <div
      className="absolute top-4 right-16 z-20 w-[22rem] rounded-2xl p-4 space-y-4 text-white backdrop-blur-md"
      style={{
        background: 'linear-gradient(160deg, rgba(40,49,70,0.95), rgba(16,22,38,0.96))',
        boxShadow: '0 16px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.14)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Flight feel</h3>
          <p className="text-[10px] text-white/55 mt-0.5">LY fly · LX strafe · RX turn · RY look · LT↓ RT↑ climb.</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/55 hover:text-white"
          title="Close"
        >
          <MaterialIcon icon="close" className="text-[16px]" />
        </button>
      </div>

      <TieredSlider
        label="Flight speed"
        tiers={SPEED_TIERS}
        value={tuning.multiplier}
        readout={`max ${eff.throttle.max.toFixed(0)} px/s (rev ${eff.throttle.reverseMax.toFixed(0)})`}
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
      <TieredSlider
        label="Climb rate"
        tiers={CLIMB_TIERS}
        value={tuning.climbRate}
        readout={`max ${eff.climb.max.toFixed(1)} m/s`}
        onChange={onClimbRateChange}
      />

      <div className="flex items-center justify-between pt-1">
        <p className="text-[9px] text-white/60 italic">
          Live preview — fly while you adjust.
        </p>
        <button
          onClick={onReset}
          className="text-[10px] font-semibold text-white/60 hover:text-white transition-colors"
          title="Reset all sliders to default"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ── TieredSlider — a slider that snaps through NAMED tiers ─────────────
// Each tier gets an equal slice of the track (so no tier is a tiny sliver).
// Dragging snaps to the nearest tier; the active tier's NAME + note + real
// speed show above/below. Greg 2026-07-16 — identifiable speeds beat abstract
// multipliers (Drone · Helicopter · Cessna · F-18 · City · Country · Space).
interface TieredSliderProps {
  label: string;
  tiers: FlightTier[];
  value: number;               // current raw multiplier
  readout: string;             // live effective numbers (e.g. "max 610 px/s")
  onChange: (mult: number) => void;
}

function TieredSlider({ label, tiers, value, readout, onChange }: TieredSliderProps) {
  const active = nearestTier(tiers, value);
  const activeIdx = Math.max(0, tiers.findIndex((t) => t.name === active.name));
  const last = tiers.length - 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[11px] font-bold text-white tabular-nums">
          {active.name}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={activeIdx}
        onChange={(e) => onChange(tiers[parseInt(e.target.value, 10)].mult)}
        className="w-full accent-primary"
      />
      {/* tier tick labels — the ladder, so you can SEE the named steps */}
      <div className="flex items-center justify-between mt-0.5 text-[8px] text-white/45 leading-tight">
        {tiers.map((t, i) => (
          <span
            key={t.name}
            className={`${i === activeIdx ? 'text-white font-bold' : ''} text-center`}
            style={{ flex: 1, textAlign: i === 0 ? 'left' : i === last ? 'right' : 'center' }}
          >
            {t.name.split(' ')[0]}
          </span>
        ))}
      </div>
      <div className="mt-1 text-[9.5px] font-mono text-white/60 tabular-nums leading-tight">
        {active.note} · {readout}
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
        <label className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[10px] font-mono text-white tabular-nums">
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
      <div className="flex items-center justify-between mt-0.5 text-[9px] text-white/60">
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
      <div className="mt-1 text-[9.5px] font-mono text-white/60 tabular-nums leading-tight">
        {readout}
      </div>
    </div>
  );
}
