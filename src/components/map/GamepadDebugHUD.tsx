'use client';

// GamepadDebugHUD — TEMPORARY diagnostic. Polls the raw browser Gamepad
// API every frame and shows what (if anything) the browser actually sees:
// whether a pad is connected, its raw axis values, and pressed buttons.
//
// This is independent of ALL flight code. It answers one question:
//   - If it shows a connected pad + moving axes when you push the stick
//     → the browser CAN see the controller; the bug is in our flight code.
//   - If it shows "no gamepad" even while OS control + fire work
//     → Steam Input has grabbed the controller exclusively; the browser
//       gets nothing. That's an OS-side config issue, not our code.
//
// Remove once flight is diagnosed.

import { useEffect, useState } from 'react';

interface PadSnapshot {
  connected: boolean;
  id: string;
  mapping: string;
  axes: number[];
  pressed: number[];   // indices of pressed buttons
}

export default function GamepadDebugHUD() {
  const [snap, setSnap] = useState<PadSnapshot | null>(null);

  useEffect(() => {
    let raf = 0;
    let running = true;
    const tick = () => {
      if (!running) return;
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let chosen: Gamepad | null = null;
      for (const p of pads) { if (p && p.connected) { chosen = p; break; } }
      if (chosen) {
        const pressed: number[] = [];
        chosen.buttons.forEach((b, i) => { if (b.pressed) pressed.push(i); });
        setSnap({
          connected: true,
          id: chosen.id,
          mapping: chosen.mapping || '(non-standard)',
          axes: chosen.axes.map((a) => Math.round(a * 100) / 100),
          pressed,
        });
      } else {
        setSnap({ connected: false, id: '', mapping: '', axes: [], pressed: [] });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.85)',
        color: '#0f0',
        font: '12px/1.4 monospace',
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid #0f0',
        pointerEvents: 'none',
        minWidth: 240,
        whiteSpace: 'pre',
      }}
    >
      {!snap || !snap.connected ? (
        <span style={{ color: '#f55' }}>NO GAMEPAD SEEN BY BROWSER{'\n'}(push a stick/button to wake it){'\n'}If fire+OS work but this stays red →{'\n'}Steam Input grabbed it exclusively.</span>
      ) : (
        <>
          {`PAD: ${snap.id.slice(0, 28)}\n`}
          {`mapping: ${snap.mapping}\n`}
          {`axes: [${snap.axes.join(', ')}]\n`}
          {`pressed: [${snap.pressed.join(', ')}]\n`}
          {`(push left stick → axes[0],axes[1] move\n right stick → axes[2],axes[3])`}
        </>
      )}
    </div>
  );
}
