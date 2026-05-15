'use client';

import { useEffect, useState } from 'react';
import type { ShotChannel } from '@/lib/shotSounds';

interface Shot {
  id: number;
  channel: ShotChannel;
  xFraction: number;
  yFraction: number;
}

interface Props {
  shot: Shot | null;
}

// Channel tints. Keep distinct enough that a glance tells the user
// which channel just fired even if their eyes are on the target.
const CHANNEL_COLOR: Record<ShotChannel, string> = {
  text_invite: '#3b82f6',   // blue — text
  direct_mail: '#f59e0b',   // amber — mail
  phone_call:  '#10b981',   // emerald — call
};

/**
 * Brief radial pulse + impact ring at the reticle position when a shot
 * fires. Channel-tinted. ~280ms total. Pure visual — sound is fired
 * separately via playShotSound() so each can fail without the other.
 *
 * Renders nothing when shot is null. Page sets a new Shot object each
 * fire; the keyed re-mount restarts the CSS animation cleanly.
 */
export default function ShotAnimation({ shot }: Props) {
  // Mount the animation as long as a shot exists. The parent clears
  // shot after the animation duration; we don't need internal timing
  // — CSS animation runs to completion and the unmount handles cleanup.
  const [active, setActive] = useState<Shot | null>(null);
  useEffect(() => {
    if (!shot) {
      setActive(null);
      return;
    }
    setActive(shot);
    // Force a remount by clearing then setting on each new shot id.
    // (Parent already gives us a new id per fire so the effect re-runs.)
  }, [shot]);

  if (!active) return null;

  const color = CHANNEL_COLOR[active.channel];

  return (
    <div
      aria-hidden
      key={active.id}
      className="pointer-events-none absolute z-40"
      style={{
        left: `${active.xFraction * 100}%`,
        top: `${active.yFraction * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Inner flash — bright burst at the reticle position. */}
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '50%',
          width: '24px',
          height: '24px',
          transform: 'translate(-50%, -50%)',
          background: color,
          boxShadow: `0 0 24px 8px ${color}`,
          animation: 'plot-shot-flash 280ms ease-out forwards',
        }}
      />
      {/* Expanding ring — propagates outward like a shock wave. */}
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '50%',
          width: '24px',
          height: '24px',
          transform: 'translate(-50%, -50%)',
          border: `2px solid ${color}`,
          animation: 'plot-shot-ring 280ms ease-out forwards',
        }}
      />
      <style jsx>{`
        @keyframes plot-shot-flash {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          25%  { opacity: 1; transform: translate(-50%, -50%) scale(1.0); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
        }
        @keyframes plot-shot-ring {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.4); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(4.5); }
        }
      `}</style>
    </div>
  );
}

export type { Shot };
