'use client';

// ── GamepadCursor ─────────────────────────────────────────────────────
//
// Plug-and-play gamepad UI navigation — NO Steam, NO download. The browser
// Gamepad API ([[useGamepad]]) reads any connected controller natively;
// the one thing a browser CAN'T do is move the OS cursor. So we render our
// OWN on-screen cursor and synthesize real click/pointer events on whatever
// it's over — the app simulates the cursor instead of asking the OS.
//
// Scope: the whole UI (front page, tool grid, buttons, nav, cards). It is
// SUPPRESSED on the map surface — the map owns its own flight controls +
// reticle ([[project_gamepad_is_os_layer]] superseded: no Steam needed).
//
// Controls (off-map):
//   • Right stick (or left)  → move the cursor
//   • A                      → click the element under the cursor
//   • B                      → Escape / back (closes menus, etc.)
//   • LB / RB                → scroll up / down
//
// See memory/project_sprint_roadmap_2026_06 (no-Steam gamepad operability).

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGamepad } from '@/lib/useGamepad';

const CURSOR_SPEED = 1100;   // px/sec at full stick deflection
const SCROLL_SPEED = 900;    // px/sec while a bumper is held

export default function GamepadCursor() {
  const pathname = usePathname();
  // The map has its own controller handling (flight + reticle). Suppress the
  // UI cursor there so the two don't fight.
  const onMap = pathname.startsWith('/map');

  const [active, setActive] = useState(false);      // shown once the user moves the cursor
  const posRef = useRef({ x: 0, y: 0 });            // virtual cursor position (px)
  const cursorElRef = useRef<HTMLDivElement>(null);
  const lastHoverRef = useRef<Element | null>(null);

  // Seed cursor to screen center on first mount.
  useEffect(() => {
    posRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, []);

  useGamepad({
    enabled: !onMap,
    onFrame: ({ dt, leftStick, rightStick, justPressed, pressed }) => {
      // Aim with whichever stick the user pushes (right preferred).
      const stick = rightStick.magnitude > 0.05 ? rightStick : leftStick;

      // Move the cursor.
      if (stick.magnitude > 0.05) {
        const p = posRef.current;
        p.x = clamp(p.x + stick.x * CURSOR_SPEED * dt, 0, window.innerWidth);
        p.y = clamp(p.y + stick.y * CURSOR_SPEED * dt, 0, window.innerHeight);
        if (!active) setActive(true);
        paint();
        updateHover();
      }

      // Scroll with bumpers.
      if (pressed.has('lb')) window.scrollBy(0, -SCROLL_SPEED * dt);
      if (pressed.has('rb')) window.scrollBy(0, SCROLL_SPEED * dt);

      // A → click whatever is under the cursor.
      if (justPressed.has('a')) clickUnderCursor();

      // B → Escape (close menus, etc.).
      if (justPressed.has('b')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const el = elementUnderCursor();
        (el as HTMLElement | null)?.blur?.();
      }
    },
  });

  function paint() {
    const el = cursorElRef.current;
    if (!el) return;
    const { x, y } = posRef.current;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  function elementUnderCursor(): Element | null {
    const { x, y } = posRef.current;
    // ignore our own cursor element (pointer-events:none already, but belt+braces)
    return document.elementFromPoint(x, y);
  }

  // Drive :hover-like feedback + focus so the UI reacts as the cursor moves.
  function updateHover() {
    const el = elementUnderCursor();
    if (el === lastHoverRef.current) return;
    const prev = lastHoverRef.current as HTMLElement | null;
    if (prev) prev.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
    lastHoverRef.current = el;
    if (el) {
      el.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
      // give interactive elements focus so keyboard-style affordances show
      const focusable = (el as HTMLElement).closest('a,button,input,[tabindex],[role="button"]') as HTMLElement | null;
      focusable?.focus?.({ preventScroll: true });
    }
  }

  function clickUnderCursor() {
    const { x, y } = posRef.current;
    const el = elementUnderCursor();
    if (!el) return;
    // synthesize a real pointer/mouse click sequence so buttons, links, and
    // card handlers fire exactly as they would for a mouse.
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    // a press pulse on the cursor for tactile feedback
    cursorElRef.current?.classList.add('gp-cursor--press');
    window.setTimeout(() => cursorElRef.current?.classList.remove('gp-cursor--press'), 140);
  }

  if (onMap) return null;

  return (
    <div
      ref={cursorElRef}
      className={`gp-cursor${active ? ' gp-cursor--on' : ''}`}
      aria-hidden
    >
      <span className="gp-cursor__dot" />
      <span className="gp-cursor__ring" />
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}
