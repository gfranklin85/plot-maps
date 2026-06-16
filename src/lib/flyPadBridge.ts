'use client';

// ── flyPadBridge ──────────────────────────────────────────────────────
//
// The RECEIVER half of the phone-as-controller link, running in the
// browser on the BIG SCREEN (the /fly page). It installs a synthetic
// "standard" W3C gamepad and overrides navigator.getGamepads() so Plot's
// EXISTING flight code (useGamepad → pickGamepad picks mapping:'standard')
// reads the phone's input with ZERO changes.
//
// The phone (PlotFly) sends PadFrame messages over the network link
// (WebRTC data channel, or Supabase Realtime fallback). The transport
// layer calls applyPadFrame() with each frame; this module turns that
// into the live gamepad the flight loop polls.
//
// Layout MATCHES the phone's gamepadBridge.ts and the Android
// GamepadHidDescriptor — the one unified contract:
//   axes:    [0]=LX [1]=LY [2]=RX [3]=RY        (-1..1, 0 = centered)
//   buttons: [0]=A [1]=B [2]=X [3]=Y  [6]=LT [7]=RT (analog 0..1)

export interface PadFrame {
  lx: number; ly: number; rx: number; ry: number;
  lt: number; rt: number;
  a: boolean; b: boolean; x: boolean; y: boolean;
}

export const NEUTRAL_FRAME: PadFrame = {
  lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0,
  a: false, b: false, x: false, y: false,
};

interface SyntheticPad {
  id: string;
  index: number;
  connected: boolean;
  mapping: GamepadMappingType;
  timestamp: number;
  axes: number[];
  buttons: { pressed: boolean; touched: boolean; value: number }[];
}

let installed = false;
let pad: SyntheticPad | null = null;

/** Install the synthetic pad + override getGamepads(). Idempotent. */
export function installFlyPad(): void {
  if (installed || typeof navigator === 'undefined') return;
  installed = true;

  pad = {
    id: 'Plot Pad (phone over network) — standard gamepad',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    })),
  };

  const realGetGamepads = navigator.getGamepads
    ? navigator.getGamepads.bind(navigator)
    : () => [];

  // Merge any REAL gamepad with our virtual one in slot 0 (virtual wins).
  navigator.getGamepads = function (): (Gamepad | null)[] {
    let real: (Gamepad | null)[] = [];
    try {
      real = (realGetGamepads() as (Gamepad | null)[]) || [];
    } catch {
      /* ignore */
    }
    const out: (Gamepad | null)[] = [pad as unknown as Gamepad];
    for (let i = 1; i < real.length; i++) out[i] = real[i] || null;
    return out;
  };

  // Wake up Plot's flight init (useGamepad listens for this).
  try {
    window.dispatchEvent(new Event('gamepadconnected'));
  } catch {
    /* older browsers: createEvent path not needed in our targets */
  }
}

function setBtn(i: number, pressed: boolean, value?: number) {
  if (!pad) return;
  const b = pad.buttons[i];
  b.pressed = pressed;
  b.touched = pressed;
  b.value = value == null ? (pressed ? 1 : 0) : value;
}

// Deadman switch: when did we last hear from the phone? If frames stop
// arriving (a dropped "stop" packet, the phone backgrounded, the link
// hiccuped), we force the pad to neutral so the camera CAN'T run away.
let lastFrameMs = 0;
let deadmanTimer: ReturnType<typeof setInterval> | null = null;
const DEADMAN_MS = 250;

function startDeadman() {
  if (deadmanTimer || typeof window === 'undefined') return;
  deadmanTimer = setInterval(() => {
    if (!pad) return;
    const now = performance.now();
    if (lastFrameMs && now - lastFrameMs > DEADMAN_MS) {
      // Silence → assume the user let go. Zero the sticks/triggers.
      writeFrame(NEUTRAL_FRAME);
    }
  }, 80);
}

function writeFrame(f: PadFrame): void {
  if (!pad) return;
  pad.axes[0] = f.lx || 0;
  pad.axes[1] = f.ly || 0;
  pad.axes[2] = f.rx || 0;
  pad.axes[3] = f.ry || 0;
  setBtn(0, !!f.a);
  setBtn(1, !!f.b);
  setBtn(2, !!f.x);
  setBtn(3, !!f.y);
  setBtn(6, (f.lt || 0) > 0.02, f.lt || 0);
  setBtn(7, (f.rt || 0) > 0.02, f.rt || 0);
  pad.timestamp = typeof performance !== 'undefined' ? performance.now() : 0;
}

/** Feed one frame from the phone into the synthetic pad. */
export function applyPadFrame(f: PadFrame): void {
  if (!pad) return;
  lastFrameMs = typeof performance !== 'undefined' ? performance.now() : 0;
  startDeadman();
  writeFrame(f);
}

/** Reset to neutral (on disconnect, so the camera stops drifting). */
export function neutralizeFlyPad(): void {
  lastFrameMs = 0; // don't let the deadman keep re-zeroing after a clean stop
  writeFrame(NEUTRAL_FRAME);
}
