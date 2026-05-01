'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type ButtonName,
  type StickVec,
  readStick,
  readTrigger,
  currentlyPressed,
} from './gamepadActions';

export interface GamepadFrame {
  dt: number;                          // seconds since last frame
  elapsedMs: number;                   // ms since hook mount (for time-driven effects)
  leftStick: StickVec;
  rightStick: StickVec;
  triggers: { left: number; right: number };
  pressed: Set<ButtonName>;            // buttons held this frame
  justPressed: Set<ButtonName>;        // edge-triggered (down this frame, up last frame)
  anyStickActive: boolean;             // any stick or trigger outside deadzone
}

export type GamepadCallback = (frame: GamepadFrame) => void;

interface Options {
  /** Called every animation frame while a gamepad is connected. */
  onFrame: GamepadCallback;
  /** When false, the loop is paused (useful when walk mode owns the controller). */
  enabled?: boolean;
}

interface Status {
  connected: boolean;
  label: string | null;
}

/**
 * Subscribes to the Gamepad API and runs a single requestAnimationFrame loop
 * while at least one gamepad is connected. The caller's `onFrame` receives a
 * normalized snapshot of input each frame.
 *
 * Browser quirk: Chrome won't expose a connected gamepad until the user
 * presses a button on it (security gesture requirement). We surface the
 * status reactively via `gamepadconnected`/`gamepaddisconnected` events.
 */
export function useGamepad({ onFrame, enabled = true }: Options): Status {
  const [status, setStatus] = useState<Status>({ connected: false, label: null });
  // Latest callback in a ref so we don't tear down the RAF loop on every render.
  const callbackRef = useRef<GamepadCallback>(onFrame);
  callbackRef.current = onFrame;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (typeof navigator.getGamepads !== 'function') return;

    const startMs = performance.now();
    let lastFrameMs = startMs;
    let prevPressed: Set<ButtonName> = new Set();
    let rafId = 0;
    let running = true;

    function pickGamepad(): Gamepad | null {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (p && p.connected && p.mapping === 'standard') return p;
      }
      // Fallback: any connected gamepad even if mapping is non-standard.
      for (const p of pads) if (p && p.connected) return p;
      return null;
    }

    function tick() {
      if (!running) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrameMs) / 1000); // clamp dt to 100ms to avoid jumps after tab refocus
      lastFrameMs = now;

      const pad = pickGamepad();
      if (pad) {
        if (!status.connected) {
          setStatus({ connected: true, label: pad.id });
        }

        const leftStick = readStick(pad, 'left');
        const rightStick = readStick(pad, 'right');
        const lt = readTrigger(pad, 'left');
        const rt = readTrigger(pad, 'right');
        const pressed = currentlyPressed(pad);
        const justPressed = new Set<ButtonName>();
        pressed.forEach(name => {
          if (!prevPressed.has(name)) justPressed.add(name);
        });
        prevPressed = pressed;

        const anyStickActive =
          leftStick.magnitude > 0 ||
          rightStick.magnitude > 0 ||
          lt > 0 || rt > 0;

        callbackRef.current({
          dt,
          elapsedMs: now - startMs,
          leftStick,
          rightStick,
          triggers: { left: lt, right: rt },
          pressed,
          justPressed,
          anyStickActive,
        });
      }

      rafId = requestAnimationFrame(tick);
    }

    function handleConnect(e: GamepadEvent) {
      setStatus({ connected: true, label: e.gamepad.id });
    }

    function handleDisconnect() {
      const stillConnected = pickGamepad();
      if (!stillConnected) {
        setStatus({ connected: false, label: null });
        prevPressed = new Set();
      }
    }

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    // Kick off the loop. It checks for a gamepad each frame, so it works
    // even before the user has pressed a button to "wake" the device.
    rafId = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
    };
    // status.connected reads inside the loop are intentionally stale — we only
    // call setStatus when the connected gamepad actually changes, and React
    // batches those updates. Re-running the effect on every status change
    // would tear down the RAF loop unnecessarily.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return status;
}
