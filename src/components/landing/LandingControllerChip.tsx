'use client';

// LandingControllerChip — quiet top-right indicator on the landing
// surfacing gamepad pairing state. Tells the visitor that Plot supports
// controller flight and prompts them to plug one in for the immersive
// experience.
//
// Three visible states:
//   1. Idle (no gamepad detected) — chip reads "Plug in a controller
//      for full flight." Editorial italic, small, doesn't compete
//      with the wordmark.
//   2. Detected (gamepad just connected) — brief celebration: chip
//      reads "Controller connected." in coral, breathes once, then
//      settles into the connected steady-state.
//   3. Connected (steady state) — chip reads "Controller ready."
//      Quiet, just enough to confirm.
//
// The Web Gamepad API doesn't dispatch events until the user presses
// a button on a connected controller (Chrome's security model), so
// we poll once per second for connected pads as a fallback. The
// gamepadconnected / gamepaddisconnected events handle the rest.

import { useEffect, useState } from 'react';

type ChipState = 'idle' | 'just_connected' | 'connected';

export default function LandingControllerChip() {
  const [state, setState] = useState<ChipState>('idle');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;

    function pollGamepads(): boolean {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const pad of pads) {
        if (pad && pad.connected) return true;
      }
      return false;
    }

    // Seed initial state.
    if (pollGamepads()) {
      // Already connected when we mounted — skip the celebration beat.
      setState('connected');
    }

    function onConnect() {
      if (!mounted) return;
      setState('just_connected');
      // After the celebration moment, settle to steady connected.
      window.setTimeout(() => {
        if (mounted) setState('connected');
      }, 2200);
    }

    function onDisconnect() {
      if (!mounted) return;
      // Verify no other pads are still connected before going idle.
      window.setTimeout(() => {
        if (!mounted) return;
        if (!pollGamepads()) setState('idle');
      }, 100);
    }

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    // Poll as a fallback for browsers that don't fire gamepadconnected
    // reliably (older Chrome, some controllers that need a button press
    // before they're visible). Lightweight — once per second.
    const pollInterval = window.setInterval(() => {
      const has = pollGamepads();
      setState((prev) => {
        if (has && prev === 'idle') return 'just_connected';
        if (!has && (prev === 'connected' || prev === 'just_connected')) {
          return 'idle';
        }
        return prev;
      });
    }, 1000);

    return () => {
      mounted = false;
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
      window.clearInterval(pollInterval);
    };
  }, []);

  return (
    <div
      className="absolute top-6 right-6 z-20 select-none"
      style={{
        animation:
          state === 'just_connected'
            ? 'plot-chip-celebrate 2200ms cubic-bezier(0.2, 0.65, 0.3, 1)'
            : undefined,
      }}
    >
      <div
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-on-surface/[0.05] backdrop-blur-sm border border-on-surface/15"
        style={{
          transition: 'all 400ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <ControllerGlyph state={state} />
        <span
          className="font-headline text-[11px] tracking-[0.18em] uppercase"
          style={{
            color:
              state === 'just_connected'
                ? '#C8553D' // coral celebration color
                : state === 'connected'
                  ? 'rgba(26, 31, 46, 0.85)'
                  : 'rgba(26, 31, 46, 0.55)',
          }}
        >
          {state === 'idle' && 'Plug in to fly'}
          {state === 'just_connected' && 'Controller paired'}
          {state === 'connected' && 'Controller ready'}
        </span>
      </div>

      <style jsx global>{`
        @keyframes plot-chip-celebrate {
          0% {
            transform: scale(1);
          }
          20% {
            transform: scale(1.08);
          }
          50% {
            transform: scale(1.04);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// Small inline glyph — minimal stylized controller silhouette. State
// drives the stroke color and opacity. Same brand-ink navy in the
// steady states, coral on the celebration.
function ControllerGlyph({ state }: { state: ChipState }) {
  const stroke =
    state === 'just_connected'
      ? '#C8553D'
      : state === 'connected'
        ? '#1A1F2E'
        : 'rgba(26, 31, 46, 0.55)';
  return (
    <svg width="16" height="11" viewBox="0 0 20 14" fill="none" aria-hidden>
      {/* Body */}
      <path
        d="M5 2C2.5 2 1.5 4 1.5 6.5C1.5 9 2.5 12 4 12C5 12 5.5 11 6 10H14C14.5 11 15 12 16 12C17.5 12 18.5 9 18.5 6.5C18.5 4 17.5 2 15 2H5Z"
        stroke={stroke}
        strokeWidth="1.1"
        fill="none"
      />
      {/* Left D-pad cross */}
      <line x1="4.6" y1="6.5" x2="6.4" y2="6.5" stroke={stroke} strokeWidth="1.1" />
      <line x1="5.5" y1="5.6" x2="5.5" y2="7.4" stroke={stroke} strokeWidth="1.1" />
      {/* Right buttons */}
      <circle cx="13.6" cy="5.8" r="0.7" fill={stroke} />
      <circle cx="15.2" cy="7" r="0.7" fill={stroke} />
    </svg>
  );
}
