'use client';

// ── touchPadBridge ────────────────────────────────────────────────────
//
// The BROWSER half of the unified gamepad contract, for MOBILE touch flight.
//
// Plot's flight code reads navigator.getGamepads() (W3C Gamepad API). On
// desktop that's a real Xbox pad (via Plot Pad). On a phone-in-browser there
// is no physical pad — so the on-screen TouchZonePad writes axis/button state
// and this shim makes navigator.getGamepads() return a synthetic "standard"
// gamepad. Plot's EXISTING useGamepad → onFrame → FpCam flight loop then runs
// with ZERO changes — the touch pad is just another gamepad transport,
// exactly like Plot Pad and the iOS WebView bridge.
//
// Ported from the PlotFly Expo app's gamepadBridge.ts (same axis/button
// layout so flight tuning is identical across every transport).
// memory/project_phone_as_controller, project_plot_pad_os_click_helper
//
//   axes:    [0]=LX [1]=LY [2]=RX [3]=RY   (-1..1, 0 = centered)
//   buttons: [0]=A [1]=B [2]=X [3]=Y  [6]=LT [7]=RT (analog 0..1)

export interface PadFrame {
  lx: number; ly: number; rx: number; ry: number;
  lt: number; rt: number;
  a: boolean; b: boolean; x: boolean; y: boolean;
}

export const NEUTRAL: PadFrame = {
  lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0,
  a: false, b: false, x: false, y: false,
};

interface SyntheticPad {
  id: string; index: number; connected: boolean; mapping: string;
  timestamp: number; axes: number[];
  buttons: { pressed: boolean; touched: boolean; value: number }[];
}

declare global {
  interface Window {
    __plotTouchPadInstalled?: boolean;
    __plotTouchPad?: (f: PadFrame) => void;
    __plotTouchPadObj?: SyntheticPad;
  }
}

// Install ONCE: create the synthetic pad, override navigator.getGamepads to
// merge it into slot 0, and fire gamepadconnected so Plot's flight init wakes.
export function installTouchPad(): void {
  if (typeof window === 'undefined' || window.__plotTouchPadInstalled) return;
  window.__plotTouchPadInstalled = true;

  const pad: SyntheticPad = {
    id: 'Plot Touch Pad (mobile virtual) — standard gamepad',
    index: 0,
    connected: true,
    mapping: 'standard',
    timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  window.__plotTouchPadObj = pad;

  const setBtn = (i: number, pressed: boolean, value?: number) => {
    const b = pad.buttons[i];
    b.pressed = pressed;
    b.touched = pressed;
    b.value = value == null ? (pressed ? 1 : 0) : value;
  };

  window.__plotTouchPad = (f: PadFrame) => {
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
    pad.timestamp = (typeof performance !== 'undefined' && performance.now()) || 0;
  };

  const realGetGamepads = navigator.getGamepads
    ? navigator.getGamepads.bind(navigator)
    : () => [];

  navigator.getGamepads = function (): (Gamepad | null)[] {
    let real: (Gamepad | null)[] = [];
    try { real = (realGetGamepads() as (Gamepad | null)[]) || []; } catch { /* ignore */ }
    const out: (Gamepad | null)[] = [pad as unknown as Gamepad];
    for (let i = 1; i < real.length; i++) out[i] = real[i] || null;
    return out;
  };

  try {
    window.dispatchEvent(new Event('gamepadconnected'));
  } catch { /* ignore */ }
}

// Push a frame to the synthetic pad (called by TouchZonePad each update).
export function pushTouchFrame(f: PadFrame): void {
  if (typeof window !== 'undefined') window.__plotTouchPad?.(f);
}
