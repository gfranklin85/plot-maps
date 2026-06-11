'use client';

import { useEffect, useRef, useState } from 'react';

// ── Idle detection ────────────────────────────────────────────────
//
// When the user walks away with a controller plugged in and an
// airplane mode left on, Map3DElement keeps rendering — re-paints
// the photoreal scene every frame because the idle hover wave is
// still mutating the camera. That's GPU heat + battery drain for
// nothing.
//
// This hook watches all input surfaces (keyboard, mouse, wheel,
// touch, gamepad sticks/triggers/buttons). Any activity refreshes
// a timer; if the timer crosses the idle threshold with no input,
// `isIdle` flips true. Any subsequent input flips it back instantly.
//
// MapView3D reads `isIdle` from props. When true, it stops:
//   - Writing to el.center/heading/tilt/range (the big GPU win).
//   - Computing the hover wave (small CPU win).
//   - Emitting altitude reports (small React state win).
//
// Per Plot Performance Philosophy: zero quality loss when the user
// IS watching. Massive savings when they're not.

const IDLE_THRESHOLD_MS = 8000;            // 8 seconds of nothing = idle
const GAMEPAD_POLL_MS = 250;                // light poll for stick/trigger movement
const GAMEPAD_STICK_DEADZONE = 0.15;
const GAMEPAD_TRIGGER_DEADZONE = 0.05;

export function useIdleDetection(): boolean {
  const [isIdle, setIsIdle] = useState(false);
  const lastActivityRef = useRef<number>(typeof window !== 'undefined' ? performance.now() : 0);
  // Snapshot of last gamepad state so we can detect stick/trigger
  // movement without firing on rest-state poll cycles.
  const lastGamepadSnapshotRef = useRef<string>('');
  // Live ref of isIdle so the effect can read it without re-installing
  // listeners every time it flips. The effect dep array stays empty —
  // mount listeners once for the lifetime of the component.
  const isIdleRef = useRef<boolean>(false);
  isIdleRef.current = isIdle;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function markActive() {
      lastActivityRef.current = performance.now();
      if (isIdleRef.current) {
        isIdleRef.current = false;
        setIsIdle(false);
      }
    }

    // ── Standard DOM input listeners ────────────────────────────────
    // passive: true since we never preventDefault on these — pure
    // observers, no scroll/touch interference.
    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('mousedown', markActive, { passive: true });
    window.addEventListener('wheel', markActive, { passive: true });
    window.addEventListener('keydown', markActive, { passive: true });
    window.addEventListener('touchstart', markActive, { passive: true });
    window.addEventListener('touchmove', markActive, { passive: true });

    // ── Gamepad poll ────────────────────────────────────────────────
    // The browser doesn't fire events for stick movement — we have to
    // poll. ~250ms is plenty for "did the user touch anything" and
    // way lighter than the gamepad RAF loop.
    const pollId = window.setInterval(() => {
      const pads = navigator.getGamepads?.();
      if (!pads) return;
      let activity = false;
      let snapshot = '';
      for (const pad of pads) {
        if (!pad) continue;
        // Axes (sticks)
        for (let i = 0; i < pad.axes.length; i++) {
          const v = pad.axes[i] ?? 0;
          if (Math.abs(v) > GAMEPAD_STICK_DEADZONE) activity = true;
        }
        // Buttons (face + triggers — triggers report value, not just pressed)
        for (let i = 0; i < pad.buttons.length; i++) {
          const b = pad.buttons[i];
          if (!b) continue;
          if (b.pressed) activity = true;
          const v = b.value ?? 0;
          if (v > GAMEPAD_TRIGGER_DEADZONE) activity = true;
          snapshot += b.pressed ? '1' : '0';
        }
      }
      // ALSO mark activity if the button-press pattern changed, even
      // if everything's now released (handles "user tapped A and let go
      // between polls" — we'd miss the press otherwise).
      if (snapshot !== lastGamepadSnapshotRef.current) {
        activity = true;
        lastGamepadSnapshotRef.current = snapshot;
      }
      if (activity) markActive();
    }, GAMEPAD_POLL_MS);

    // ── Window/tab not focused → idle IMMEDIATELY ───────────────────
    // The strongest idle signal isn't "no input for 8s" — it's "the user
    // isn't even looking at this window." When you tab to VS Code, the
    // map tab blurs/hides; there's zero reason to keep flying. Flip idle
    // at once (don't wait out the threshold) so the flight loop quiets
    // the instant you leave. Returning focus flips it back via markActive.
    function forceIdle() {
      if (!isIdleRef.current) {
        isIdleRef.current = true;
        setIsIdle(true);
      }
    }
    function onVisibility() {
      if (document.hidden) forceIdle();
      else markActive();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', forceIdle);
    window.addEventListener('focus', markActive);
    // If we mount already-hidden/blurred, reflect it now.
    if (typeof document !== 'undefined' && document.hidden) forceIdle();

    // ── Idle timer ──────────────────────────────────────────────────
    // Check once a second whether we've crossed the threshold. (Only
    // flips TO idle on time; the visibility/blur path above handles the
    // immediate case. Returning-from-idle is driven by markActive.)
    const tickId = window.setInterval(() => {
      // Don't override a focus-forced idle with a "recent activity" read
      // while the window is still hidden.
      if (typeof document !== 'undefined' && document.hidden) return;
      const elapsed = performance.now() - lastActivityRef.current;
      const shouldBeIdle = elapsed > IDLE_THRESHOLD_MS;
      if (shouldBeIdle !== isIdleRef.current) {
        isIdleRef.current = shouldBeIdle;
        setIsIdle(shouldBeIdle);
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('mousedown', markActive);
      window.removeEventListener('wheel', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('touchstart', markActive);
      window.removeEventListener('touchmove', markActive);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', forceIdle);
      window.removeEventListener('focus', markActive);
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
    // Empty dep array intentional — listeners install ONCE for the
    // component lifetime. Reading isIdle through isIdleRef means we
    // never need to re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isIdle;
}
