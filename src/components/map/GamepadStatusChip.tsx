'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  connected: boolean;
}

/**
 * Tiny toast chip that announces controller connect / disconnect events
 * and shows a short cheat sheet for the first few seconds. Always-on
 * auto-detect — no setting, no opt-in.
 */
export default function GamepadStatusChip({ connected }: Props) {
  const [show, setShow] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setShow(true);
    if (connected) {
      // Show full cheat sheet for 4s, then auto-collapse to a tiny indicator.
      setShowHelp(true);
      const t = setTimeout(() => setShowHelp(false), 4000);
      return () => clearTimeout(t);
    }
    // On disconnect, fade the whole chip out after 2.5s.
    const t = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(t);
  }, [connected]);

  if (!show) return null;

  return (
    <div
      className={`pointer-events-auto fixed bottom-4 right-4 z-40 transition-all duration-200 ${
        connected ? 'opacity-100 translate-y-0' : 'opacity-70'
      }`}
    >
      {showHelp && connected ? (
        <button
          type="button"
          onClick={() => setShowHelp(false)}
          className="flex items-center gap-3 rounded-2xl border border-card-border bg-card/95 backdrop-blur px-4 py-3 shadow-xl text-on-surface text-left"
        >
          <MaterialIcon icon="sports_esports" className="text-[20px] text-emerald-400" />
          <div className="text-xs leading-snug">
            <p className="font-bold text-sm">Controller connected</p>
            <p className="text-on-surface-variant mt-0.5">
              <span className="font-mono text-[11px]">A</span> open · <span className="font-mono text-[11px]">X</span> skiptrace · <span className="font-mono text-[11px]">Y</span> dial · <span className="font-mono text-[11px]">B</span> close · <span className="font-mono text-[11px]">LB</span> boost
            </p>
          </div>
        </button>
      ) : connected ? (
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 rounded-full border border-card-border bg-card/90 backdrop-blur px-3 py-1.5 shadow-lg text-xs font-bold text-on-surface hover:bg-card"
          title="Show controller help"
        >
          <MaterialIcon icon="sports_esports" className="text-[14px] text-emerald-400" />
          <span className="text-[11px] uppercase tracking-wider">Controller</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 rounded-full border border-card-border bg-card/90 backdrop-blur px-3 py-1.5 shadow-lg text-xs font-bold text-on-surface-variant">
          <MaterialIcon icon="sports_esports" className="text-[14px]" />
          <span className="text-[11px] uppercase tracking-wider">Controller disconnected</span>
        </div>
      )}
    </div>
  );
}
