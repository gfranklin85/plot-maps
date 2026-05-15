'use client';

import { useEffect, useRef, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import type { ShotChannel } from '@/lib/shotSounds';

interface Props {
  channel: ShotChannel;
  /** xFraction/yFraction of the reticle. Chip is anchored just below
   *  and right of the reticle so it's in the user's eye-line without
   *  blocking the aim point. */
  reticleXFraction: number;
  reticleYFraction: number;
  visible: boolean;
}

const CHANNEL_LABEL: Record<ShotChannel, string> = {
  text_invite: 'Text',
  direct_mail: 'Mail',
  phone_call:  'Call',
};

const CHANNEL_ICON: Record<ShotChannel, string> = {
  text_invite: 'sms',
  direct_mail: 'mail',
  phone_call:  'call',
};

const CHANNEL_COLOR: Record<ShotChannel, string> = {
  text_invite: 'bg-sky-500',
  direct_mail: 'bg-amber-500',
  phone_call:  'bg-emerald-500',
};

/**
 * Always-visible chip near the reticle showing the currently-armed
 * channel. When the user presses X to rotate, the chip plays a quick
 * swap animation so the rotate is itself a satisfying beat.
 */
export default function ChannelHUD({ channel, reticleXFraction, reticleYFraction, visible }: Props) {
  // Trigger a swap-flash whenever the channel prop changes. We track
  // the previous channel so the animation doesn't fire on the first
  // mount.
  const prevRef = useRef<ShotChannel>(channel);
  const [swapKey, setSwapKey] = useState(0);
  useEffect(() => {
    if (prevRef.current !== channel) {
      prevRef.current = channel;
      setSwapKey(k => k + 1);
    }
  }, [channel]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30"
      style={{
        left: `${reticleXFraction * 100}%`,
        top: `${reticleYFraction * 100}%`,
        transform: 'translate(28px, 14px)', // off the reticle, lower-right
      }}
    >
      <div
        key={swapKey}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[11px] font-semibold shadow-lg ${CHANNEL_COLOR[channel]}`}
        style={{ animation: 'plot-channel-swap 220ms ease-out' }}
      >
        <MaterialIcon icon={CHANNEL_ICON[channel]} className="text-[14px]" />
        <span>{CHANNEL_LABEL[channel]}</span>
      </div>
      <style jsx>{`
        @keyframes plot-channel-swap {
          0%   { opacity: 0; transform: translateY(-4px) scale(0.85); }
          40%  { opacity: 1; transform: translateY(0) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1.0); }
        }
      `}</style>
    </div>
  );
}
