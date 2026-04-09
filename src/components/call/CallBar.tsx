'use client';

import { usePhone } from '@/lib/phone-context';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const OUTCOMES = [
  { key: 'No Answer', icon: 'phone_missed', label: 'No Answer' },
  { key: 'Left VM', icon: 'voicemail', label: 'Left VM' },
  { key: 'Spoke', icon: 'phone_in_talk', label: 'Spoke', highlight: true },
  { key: 'Follow-Up', icon: 'event_repeat', label: 'Follow-Up' },
  { key: 'Not Int.', icon: 'thumb_down', label: 'Not Int.' },
  { key: 'DNC', icon: 'block', label: 'DNC', danger: true },
];

export default function CallBar() {
  const { callState, callingName, callingNumber, callDuration, isMuted, hangUp, toggleMute, logOutcome } = usePhone();

  if (callState === 'idle') return null;

  // ACTIVE CALL state (connecting, ringing, in-call)
  if (callState !== 'ended') {
    return (
      <div className="fixed bottom-0 left-0 w-full z-[100] h-16 bg-surface-container shadow-[0_-4px_30px_rgba(0,0,0,0.6)] flex items-center justify-between px-6 border-t border-card-border">
        {/* Left: Status + Name */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-3 w-3 rounded-full bg-emerald-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-bold text-on-surface text-sm tracking-tight">
              {callState === 'connecting' ? 'Connecting...' : callState === 'ringing' ? `Ringing ${callingName}...` : `On call with ${callingName}`}
            </span>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
              {callingNumber}
            </span>
          </div>
        </div>

        {/* Center: Timer */}
        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="text-on-surface text-xl font-bold tracking-widest font-mono">
            {formatDuration(callDuration)}
          </div>
          <div className="h-1 w-24 bg-white/10 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: callState === 'in-call' ? '100%' : '33%' }} />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              isMuted ? 'bg-amber-600 text-white' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            <span className="material-symbols-outlined text-[20px]">{isMuted ? 'mic_off' : 'mic'}</span>
          </button>
          <div className="w-px h-6 bg-card-border mx-2" />
          <button
            onClick={hangUp}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-headline font-bold px-6 py-2 rounded-lg transition-all active:scale-95 shadow-lg shadow-red-900/20"
          >
            <span className="material-symbols-outlined text-[20px]">call_end</span>
            <span className="text-xs uppercase tracking-wider">Hang Up</span>
          </button>
        </div>
      </div>
    );
  }

  // ENDED state — show outcome selection
  return (
    <div className="fixed bottom-0 left-0 w-full z-[100] flex justify-center items-center gap-4 px-6 py-3 bg-surface shadow-[0_-4px_20px_rgba(0,0,0,0.4)] border-t border-card-border">
      <div className="flex gap-2 items-center mr-8">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-xs font-bold text-on-surface uppercase tracking-widest">Call Outcome: {callingName}</span>
      </div>

      {OUTCOMES.map(({ key, icon, label, highlight, danger }) => (
        <button
          key={key}
          onClick={() => logOutcome(key)}
          className={`flex flex-col items-center justify-center px-3 py-1 transition-all duration-200 group ${
            highlight
              ? 'text-white bg-primary rounded-md px-4 py-2 shadow-lg shadow-primary/20'
              : danger
              ? 'text-on-surface-variant hover:text-red-400 hover:bg-red-900/20 rounded-md'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md'
          }`}
        >
          <span className="material-symbols-outlined text-lg mb-0.5 group-hover:scale-110">{icon}</span>
          <span className="text-[10px] uppercase tracking-widest font-bold">{label}</span>
        </button>
      ))}

      <div className="ml-8 w-px h-8 bg-card-border/20" />
      <button
        onClick={() => logOutcome('Dismissed')}
        className="ml-4 text-secondary hover:text-on-surface flex items-center gap-2 text-xs font-bold uppercase tracking-tighter"
      >
        <span className="material-symbols-outlined text-base">close</span>
        Dismiss
      </button>
    </div>
  );
}
