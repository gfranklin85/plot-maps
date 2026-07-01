'use client';

// ── useGamepadNav ─────────────────────────────────────────────────────
//
// Controller-driven focus navigation for NON-flight surfaces (landing page,
// menus). Plug in a pad and CYCLE a highlight through the focusable elements
// (Tab-style, in order), then press A to activate — so a user can, before
// they even have Plot Pad, use their controller to reach the Download button
// and trigger it. That's the loop: pad in → cycle to Download → A → get it.
//
// CYCLING, not spatial joystick aim: pressing a direction moves to the
// next/previous element in document order. Predictable, no hunting, no
// jumping to the wrong button. Focus starts on the highest-priority target
// (data-gamepad-primary, e.g. the Download button) so the first A is already
// on the thing that matters.
//
// Elements opt in via `data-gamepad-focusable` (plus links/buttons). The
// focused one gets `.gp-focus` (CSS lights it up) and scrolls into view.
//   D-pad down / right, or left-stick/RB → NEXT
//   D-pad up / left, or LB               → PREV
//   A → click focused    B → clear focus
//
// Reads the raw W3C Gamepad API (not the flight useGamepad). Inert until a
// real input arrives, so it never fights the mouse.
// memory/project_controller_first_class_input

import { useEffect } from 'react';

const FOCUSABLE = '[data-gamepad-focusable],a[href],button:not(:disabled)';
const DEADZONE = 0.5;
const REPEAT_MS = 240; // debounce between cycles

function collect(): HTMLElement[] {
  const out: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((el) => {
    if (el.hasAttribute('data-gamepad-skip')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') return;
    out.push(el);
  });
  return out;
}

export function useGamepadNav(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !navigator.getGamepads) return;

    let raf = 0;
    let lastMoveAt = 0;
    let prevA = false, prevB = false;
    let current: HTMLElement | null = null;

    const setFocus = (el: HTMLElement | null) => {
      if (current === el) return;
      if (current) current.classList.remove('gp-focus');
      current = el;
      if (current) {
        current.classList.add('gp-focus');
        current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    // Start on the priority target the first time we engage. If a modal
    // ([role=dialog]) is open, prefer a primary inside it (so the flow
    // continues into the modal), else the page's primary, else the first.
    const focusFirst = () => {
      const all = collect();
      if (!all.length) return;
      const dialog = document.querySelector('[role="dialog"]');
      const inDialog = dialog
        ? all.find((el) => dialog.contains(el) && el.hasAttribute('data-gamepad-primary'))
          ?? all.find((el) => dialog.contains(el))
        : undefined;
      const primary = all.find((el) => el.hasAttribute('data-gamepad-primary'));
      setFocus(inDialog ?? primary ?? all[0]);
    };

    const cycle = (delta: 1 | -1) => {
      const all = collect();
      if (!all.length) return;
      // A modal is open but focus is outside it → jump into the modal.
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog && (!current || !dialog.contains(current))) { focusFirst(); return; }
      if (!current || !all.includes(current)) { focusFirst(); return; }
      const i = all.indexOf(current);
      const next = all[(i + delta + all.length) % all.length];
      setFocus(next);
    };

    const tick = () => {
      const pads = navigator.getGamepads();
      let pad: Gamepad | null = null;
      for (const p of pads) { if (p && p.connected) { pad = p; break; } }
      if (pad) {
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        const next = pad.buttons[13]?.pressed || pad.buttons[15]?.pressed // dpad down/right
          || pad.buttons[5]?.pressed                                       // RB
          || ay > DEADZONE || ax > DEADZONE;
        const prev = pad.buttons[12]?.pressed || pad.buttons[14]?.pressed // dpad up/left
          || pad.buttons[4]?.pressed                                       // LB
          || ay < -DEADZONE || ax < -DEADZONE;
        const aBtn = !!pad.buttons[0]?.pressed;
        const bBtn = !!pad.buttons[1]?.pressed;

        const now = performance.now();
        if ((next || prev) && now - lastMoveAt > REPEAT_MS) {
          lastMoveAt = now;
          if (!current) focusFirst();
          else cycle(next ? 1 : -1);
        }

        if (aBtn && !prevA) {
          if (!current) focusFirst();
          else current.click();
        }
        if (bBtn && !prevB) setFocus(null);
        prevA = aBtn; prevB = bBtn;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (current) current.classList.remove('gp-focus');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
