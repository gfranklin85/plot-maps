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
// Pick the REAL controller. On Windows a phantom pad often appears in slot 0
// — e.g. Steam Input registers a "Plot Pad (Vendor 0075)" with mapping:"" and
// every button/axis frozen at 0. Grabbing the first connected pad lands on
// that dead phantom, so the D-pad (live on the real Xbox pad in another slot)
// looks like it does nothing. Prefer a standard-mapping pad; otherwise the
// first pad that actually has buttons. That was THE bug behind the frozen
// highlight. (Confirmed via gamepadtester.com: slot0 "Plot Pad" mapping n/a,
// slot1 "Xbox One Game Controller" mapping standard, D-pad → B15.)
function pickPad(): Gamepad | null {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const live = Array.from(pads).filter((p): p is Gamepad => !!p && p.connected);
  if (!live.length) return null;
  // 1) a proper standard-mapping pad wins
  const std = live.find((p) => p.mapping === 'standard');
  if (std) return std;
  // 2) else the first pad whose buttons aren't all dead (skips the phantom)
  const alive = live.find((p) => p.buttons.some((b) => b && (b.pressed || b.value > 0.05)));
  // 3) else just the first live pad (nothing pressed yet on a non-standard pad)
  return alive ?? live.find((p) => p.buttons.length > 0) ?? live[0];
}

function collect(scopeSelector?: string): HTMLElement[] {
  const out: HTMLElement[] = [];
  // When scoped (e.g. the map: only the property card + bottom dash), gather
  // focusables from the scope roots only — never the whole page. Keeps the
  // map's D-pad on real UI, never a stray flight-surface button.
  const roots: ParentNode[] = scopeSelector
    ? Array.from(document.querySelectorAll(scopeSelector))
    : [document];
  if (scopeSelector && roots.length === 0) return out;
  // When scoped we know these are real controls (card + dash), so allow
  // smaller icon buttons (2D/3D/Walk, the two dash icons). Unscoped keeps the
  // stricter size gate that killed the landing-page blue-dot.
  const minW = scopeSelector ? 20 : 40;
  const minH = scopeSelector ? 20 : 24;
  roots.forEach((root) => root.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((el) => {
    if (el.hasAttribute('data-gamepad-skip')) return;
    const r = el.getBoundingClientRect();
    // real, tappable size (kills icon-only stubs + zero-size stray elements)
    if (r.width < minW || r.height < minH) return;
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
  }));
  // visual order: top→bottom, then left→right within a row
  out.sort((a, b) => {
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    if (Math.abs(ra.top - rb.top) > 24) return ra.top - rb.top;
    return ra.left - rb.left;
  });
  return out;
}

export function useGamepadNav(opts: {
  enabled?: boolean;
  /** Restrict cycling to focusables inside these containers (e.g. the map's
   *  property card + bottom dash). Unset = whole page (landing). */
  scopeSelector?: string;
  /** D-pad only — ignore the sticks. Required on the map, where the sticks
   *  fly the camera and must never move the highlight. */
  dpadOnly?: boolean;
  /** Do NOT auto-highlight the moment a pad connects. On the map there's
   *  nothing to select during pure flight, so the highlight only appears once
   *  the user presses the D-pad (or a card opens). Landing wants the opposite
   *  (Download pre-highlighted), so it leaves this false. */
  noAutoFocus?: boolean;
} = {}) {
  const { enabled = true, scopeSelector, dpadOnly = false, noAutoFocus = false } = opts;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !navigator.getGamepads) return;

    let raf = 0;
    let lastMoveAt = 0;
    let prevA = false;
    let prevB = false;
    let current: HTMLElement | null = null;

    const setFocus = (el: HTMLElement | null) => {
      if (current === el) return;
      if (current) current.classList.remove('gp-focus');
      current = el;
      if (current) {
        current.classList.add('gp-focus');
        // scrollIntoView on the MAP flings the Map3D camera to a random place
        // (the browser scrolls the map viewport to "center" the button). The
        // card + dash are already fully on-screen, so skip scrolling when
        // scoped. Only the full-page landing needs it. [[project_no_zoom_to_ui]]
        if (!scopeSelector) current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    // Start on the priority target. If a modal ([role=dialog]) is open, prefer
    // a primary inside it, else the page's primary, else the first item.
    const focusFirst = () => {
      const all = collect(scopeSelector);
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
      const all = collect(scopeSelector);
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
      const pad = pickPad();

      if (pad) {
        // Pre-highlight the priority target on connect — UNLESS noAutoFocus
        // (the map: no stray yellow box while you're just flying).
        if (!current && !noAutoFocus) focusFirst();

        // Cycle the highlight. Standard-mapping D-pad = buttons 12 up / 13 down
        // / 14 left / 15 right. Left stick mirrors it — but only when NOT
        // dpadOnly (the map keeps the sticks for flight).
        const DZ = 0.6;
        const lx = dpadOnly ? 0 : (pad.axes[0] ?? 0);
        const ly = dpadOnly ? 0 : (pad.axes[1] ?? 0);
        const next =
          pad.buttons[13]?.pressed || pad.buttons[15]?.pressed || // dpad down/right
          ly > DZ || lx > DZ;                                     // stick down/right
        const prev =
          pad.buttons[12]?.pressed || pad.buttons[14]?.pressed || // dpad up/left
          ly < -DZ || lx < -DZ;                                   // stick up/left
        const aBtn = !!pad.buttons[0]?.pressed;

        const now = performance.now();
        if ((next || prev) && now - lastMoveAt > REPEAT_MS) {
          lastMoveAt = now;
          // First D-pad press in noAutoFocus mode: grab the first item rather
          // than move — so pressing down enters the UI from nothing.
          if (!current) focusFirst();
          else cycle(next ? 1 : -1);
        }

        // A activates the focused UI element. In scoped/map mode we ONLY act
        // when something is actually highlighted — otherwise A belongs to the
        // map (Plot Pad's real OS click to open a parcel), and we must not
        // steal it. memory/project_plot_pad_os_click_helper
        if (aBtn && !prevA && current) {
          current.click();
        }
        prevA = aBtn;

        // B → close the property card (and drop the highlight). Only when a
        // card is on screen; otherwise B is the map's own dismiss (Plot Pad
        // sends Escape). We click the card's close button so the map's own
        // teardown runs. memory/project_map_page_finished_sidebar
        const bBtn = !!pad.buttons[1]?.pressed;
        if (bBtn && !prevB) {
          const close = document.querySelector<HTMLElement>('.sb-card__close');
          if (close) { close.click(); setFocus(null); }
        }
        prevB = bBtn;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      if (current) current.classList.remove('gp-focus');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, scopeSelector, dpadOnly, noAutoFocus]);
}
