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
const REPEAT_MS = 240; // debounce between cycles

// Collect the REAL, on-screen buttons/links to cycle — and NOTHING else.
// The blue-dot bug was focus landing on tiny/empty/invisible elements; we
// filter those out hard: must be a decent size, actually visible, and have
// real text (or opt in via data-gamepad-focusable). Cycled in visual order
// (top→bottom, left→right) so the D-pad walks the page naturally.
function collect(): HTMLElement[] {
  const out: HTMLElement[] = [];
  document.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((el) => {
    if (el.hasAttribute('data-gamepad-skip')) return;
    const r = el.getBoundingClientRect();
    // real, tappable size (kills icon-only stubs + zero-size stray elements)
    if (r.width < 40 || r.height < 24) return;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none' || style.opacity === '0') return;
    // must have a real label — text, aria-label, or explicit opt-in — so we
    // never land on an empty wrapper (the blue-dot).
    const hasLabel =
      el.hasAttribute('data-gamepad-focusable') ||
      (el.textContent?.trim().length ?? 0) > 1 ||
      !!el.getAttribute('aria-label');
    if (!hasLabel) return;
    // skip a link/button that only WRAPS another focusable (avoids duplicates
    // + landing on the outer wrapper instead of the real control)
    if (el.querySelector(FOCUSABLE)) return;
    out.push(el);
  });
  // visual order: top→bottom, then left→right within a row
  out.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    if (Math.abs(ra.top - rb.top) > 24) return ra.top - rb.top;
    return ra.left - rb.left;
  });
  return out;
}

export function useGamepadNav(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !navigator.getGamepads) return;

    let raf = 0;
    let lastMoveAt = 0;
    let prevA = false;
    let engaged = false; // any button pressed → gamepad drives the page
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
        // ── A controller is present → a button is ALWAYS highlighted ──
        // The moment a pad is connected, highlight the first button (Download)
        // so there's a starting point to cycle FROM — the user shouldn't have
        // to press anything to get a selection. D-pad cycles, A selects.
        // memory/project_lb_control_model
        if (!current) focusFirst();
        engaged = true;

        // Cycle the highlight. Read the direction from EVERY common source so
        // it works on any controller regardless of how it reports the D-pad:
        //   • D-pad buttons 12 up / 13 down / 14 left / 15 right (standard)
        //   • a hat-switch axis (axis 9 on many pads) → 8 compass values
        //   • the left/right sticks (debounced, so not touchy)
        const DZ = 0.6;
        const lx = pad.axes[0] ?? 0, ly = pad.axes[1] ?? 0;
        const rx = pad.axes[2] ?? 0, ry = pad.axes[3] ?? 0;
        const hat = pad.axes[9]; // hat: -1..~1 in 8 steps on many controllers
        const hatDown = typeof hat === 'number' && hat > 0.1 && hat < 0.6;   // down/right region
        const hatUp = typeof hat === 'number' && ((hat >= 0.6) || (hat < 0.1 && hat > -0.6)); // up/left region
        const next =
          pad.buttons[13]?.pressed || pad.buttons[15]?.pressed || // dpad down/right
          ly > DZ || lx > DZ || ry > DZ || rx > DZ ||             // stick down/right
          hatDown;
        const prev =
          pad.buttons[12]?.pressed || pad.buttons[14]?.pressed || // dpad up/left
          ly < -DZ || lx < -DZ || ry < -DZ || rx < -DZ ||         // stick up/left
          hatUp;
        const aBtn = !!pad.buttons[0]?.pressed;

        const now = performance.now();
        if (engaged && (next || prev) && now - lastMoveAt > REPEAT_MS) {
          lastMoveAt = now;
          if (!current) focusFirst();
          else cycle(next ? 1 : -1);
        }

        if (engaged && aBtn && !prevA) {
          if (!current) focusFirst();
          else current.click();
        }
        prevA = aBtn;
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
