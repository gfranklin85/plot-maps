// Pure helpers for gamepad input processing. No DOM, no React.
// Kept separate from the hook so the math can be reasoned about / tested
// without spinning up requestAnimationFrame.

export type ButtonName =
  | 'a' | 'b' | 'x' | 'y'
  | 'lb' | 'rb' | 'lt' | 'rt'
  | 'back' | 'start'
  | 'lstick' | 'rstick'
  | 'up' | 'down' | 'left' | 'right'
  | 'guide';

// Standard Xbox / "standard gamepad" button index map (W3C Gamepad spec).
// Most modern controllers (Xbox, PS, generic) map to this layout in Chrome.
export const BUTTON_INDEX: Record<ButtonName, number> = {
  a: 0, b: 1, x: 2, y: 3,
  lb: 4, rb: 5, lt: 6, rt: 7,
  back: 8, start: 9,
  lstick: 10, rstick: 11,
  up: 12, down: 13, left: 14, right: 15,
  guide: 16,
};

// Axis indices in the standard mapping.
const AXIS_LX = 0;
const AXIS_LY = 1;
const AXIS_RX = 2;
const AXIS_RY = 3;

// Anything inside the deadzone reads as zero. Xbox sticks have noticeable
// drift below ~0.12; 0.15 is comfortable.
const STICK_DEADZONE = 0.15;
const TRIGGER_DEADZONE = 0.05;

export function applyDeadzone(value: number, dz = STICK_DEADZONE): number {
  if (Math.abs(value) < dz) return 0;
  // Re-scale so output ramps from 0 at the deadzone edge to 1 at the rim,
  // not from dz upward (which would create a discontinuity).
  const sign = value < 0 ? -1 : 1;
  return sign * ((Math.abs(value) - dz) / (1 - dz));
}

export interface StickVec {
  x: number;
  y: number;
  magnitude: number;
}

export function readStick(gamepad: Gamepad, kind: 'left' | 'right'): StickVec {
  const xi = kind === 'left' ? AXIS_LX : AXIS_RX;
  const yi = kind === 'left' ? AXIS_LY : AXIS_RY;
  const rawX = gamepad.axes[xi] ?? 0;
  const rawY = gamepad.axes[yi] ?? 0;
  const x = applyDeadzone(rawX);
  const y = applyDeadzone(rawY);
  return { x, y, magnitude: Math.hypot(x, y) };
}

export function readTrigger(gamepad: Gamepad, side: 'left' | 'right'): number {
  const idx = side === 'left' ? BUTTON_INDEX.lt : BUTTON_INDEX.rt;
  const v = gamepad.buttons[idx]?.value ?? 0;
  return v < TRIGGER_DEADZONE ? 0 : v;
}

export function isButtonDown(gamepad: Gamepad, name: ButtonName): boolean {
  return gamepad.buttons[BUTTON_INDEX[name]]?.pressed ?? false;
}

// Edge-trigger detector. Pass in current and previous frame's pressed sets;
// returns the buttons that newly went down.
export function newlyPressed(
  current: ReadonlyArray<GamepadButton> | undefined,
  previousPressed: Set<ButtonName>,
): Set<ButtonName> {
  const result = new Set<ButtonName>();
  if (!current) return result;
  for (const [name, idx] of Object.entries(BUTTON_INDEX) as [ButtonName, number][]) {
    const isDown = current[idx]?.pressed ?? false;
    if (isDown && !previousPressed.has(name)) result.add(name);
  }
  return result;
}

export function currentlyPressed(gamepad: Gamepad): Set<ButtonName> {
  const set = new Set<ButtonName>();
  for (const [name, idx] of Object.entries(BUTTON_INDEX) as [ButtonName, number][]) {
    if (gamepad.buttons[idx]?.pressed) set.add(name);
  }
  return set;
}

// ── Idle hover math ──
// When all sticks are within deadzone for > IDLE_THRESHOLD_MS, we add a
// gentle continuous offset so the camera feels alive (Banshee hover).
// All offsets are time-driven so they're deterministic and don't drift.

export const IDLE_THRESHOLD_MS = 800;
const HEADING_AMPL_DEG = 1.5;
const HEADING_FREQ = 0.3;       // Hz-ish — one sway cycle every ~3.3s
const TILT_AMPL_DEG = 0.8;
const TILT_FREQ = 0.5;
const ZOOM_AMPL = 0.02;
const ZOOM_FREQ = 0.4;

export interface HoverOffsets {
  headingDelta: number;  // degrees relative to base
  tiltDelta: number;
  zoomDelta: number;
}

// `intensity` ramps 0..1 as the controller stays idle, decays back to 0 the
// moment the user touches a stick. Caller manages the ramp state.
export function idleHover(elapsedMs: number, intensity: number): HoverOffsets {
  if (intensity <= 0) return { headingDelta: 0, tiltDelta: 0, zoomDelta: 0 };
  const t = elapsedMs / 1000;
  return {
    headingDelta: Math.sin(2 * Math.PI * HEADING_FREQ * t) * HEADING_AMPL_DEG * intensity,
    tiltDelta: Math.sin(2 * Math.PI * TILT_FREQ * t) * TILT_AMPL_DEG * intensity,
    zoomDelta: Math.sin(2 * Math.PI * ZOOM_FREQ * t) * ZOOM_AMPL * intensity,
  };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
